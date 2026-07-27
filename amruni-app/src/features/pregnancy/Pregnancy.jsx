import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useApp, usePregnancyData } from '../../app/providers/AppContext'
import BottomSheet from '../../components/common/BottomSheet';
import PregnancyDueDateForm from './PregnancyDueDateForm';
import PregnancySymptoms from './PregnancySymptoms';
import PregnancyKickCounter from './PregnancyKickCounter';
import MoodLogSection from '../cycle-tracker/MoodLogSection';
import { useToast } from '../../components/common/Toast';
import { confirm, warn } from '../../utils/haptics'
import { appointmentApi } from '../../services/api/appointmentApi'
import { addContact as saveContact, getContacts } from '../sos/sosService'
import { IconStar, IconLink, IconCheck, IconPill, IconAppointment, IconMood } from '../../components/common/Icons.jsx'

const BABY_SIZE = ['Poppy seed','Sesame','Blueberry','Raspberry','Green olive','Prune','Lime','Lemon','Peach','Apple','Avocado','Turnip','Bell pepper','Tomato','Onion','Sweet potato','Mango','Banana','Papaya','Carrot','Corn','Spaghetti squash','Rutabaga','Eggplant','Acorn squash','Butternut squash','Cauliflower','Cabbage','Pineapple','Coconut','Jicama','Bok choy','Celery root','Honeydew melon','Cantaloupe','Romaine lettuce','Swiss chard','Watermelon','Pumpkin','Mini watermelon'];

// scanName is only set on real medical checkpoints — those get a booking CTA;
// the others stay purely informational.
const MILESTONES = [
  { week: 8, text: 'Tiny fingers and toes are forming.' },
  { week: 12, text: 'End of first trimester. Risk of miscarriage drops significantly.', scanName: 'first-trimester scan' },
  { week: 20, text: 'Anatomy scan this week. Baby can hear your voice.', scanName: 'anatomy scan' },
  { week: 28, text: 'Third trimester begins. Baby can open her eyes.', scanName: 'third-trimester check-in' },
  { week: 36, text: 'Baby is considered early term. Time to finalise birth plan.', scanName: 'birth-plan visit' },
  { week: 40, text: 'Due week. Your baby is ready to meet the world.' },
];

export default function Pregnancy() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const reduce = useReducedMotion();
  const pregnancyData = usePregnancyData(state);
  // One circle, not two. "Trusted contacts" here and "emergency contacts" in
  // Settings were separate lists in separate stores, so the people she'd told
  // the app to call in a pregnancy emergency were not the people the SOS
  // button actually called. They are now the same list.
  const contacts = state.sos.contacts;

  const [panicState, setPanicState] = useState('idle'); // idle | confirm | triggered
  const [shareSheet, setShareSheet] = useState(false);
  const [contactSheet, setContactSheet] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [editDateSheet, setEditDateSheet] = useState(false);
  const [pregDoctorId, setPregDoctorId] = useState(null);

  // Anything still in the old pregnancy-only list is folded into the shared
  // one and cleared, so nobody she already trusted is silently dropped.
  useEffect(() => {
    const legacy = state.pregnancy.trustedContacts;
    if (!legacy?.length) return;
    const known = new Set(state.sos.contacts.map((c) => c.phone));
    const missing = legacy.filter((c) => !known.has(c.phone));
    Promise.all(missing.map((c) => saveContact({ name: c.name, phone: c.phone, relation: 'Trusted' }, state.auth.phone)))
      .then(() => getContacts())
      .then((fetched) => {
        dispatch({ type: 'SET_SOS_CONTACTS', payload: fetched || [] });
        dispatch({ type: 'SET_PREGNANCY', payload: { trustedContacts: [] } });
      })
      .catch(() => { /* keep the legacy list until it can be moved safely */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pregnancy.trustedContacts?.length]);

  // Same specialty-matching Home.jsx uses for its recommended-doctors list —
  // one doctor list, not a second one invented for this CTA.
  useEffect(() => {
    let cancelled = false;
    appointmentApi.getDoctors()
      .then((doctors) => {
        if (cancelled) return;
        const match = doctors.find((d) => d.specialty.toLowerCase() === 'pregnancy');
        setPregDoctorId(match?.id ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const weeks = pregnancyData.known ? pregnancyData.weeks : 0;

  // The week count climbs to today's value on mount — a small "you've come this
  // far" moment, synced with the ring sweeping to fill. Reduced motion skips the
  // animated state entirely and reads the final value straight from render.
  const [animatedWeeks, setAnimatedWeeks] = useState(0);
  const shownWeeks = reduce ? weeks : animatedWeeks;
  useEffect(() => {
    if (!pregnancyData.known || reduce) return;
    let raf;
    const start = performance.now();
    const dur = 950;
    const step = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedWeeks(Math.round(eased * weeks));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [weeks, reduce, pregnancyData.known]);

  const progress = Math.min(weeks / 40, 1);
  const circumference = 2 * Math.PI * 66;
  const dash = circumference * progress;

  const nextMilestone = MILESTONES.find(m => m.week >= weeks);
  const babySize = BABY_SIZE[Math.max(0, Math.min(weeks - 4, BABY_SIZE.length - 1))];

  function saveDueDate(payload) {
    dispatch({ type: 'SET_PREGNANCY', payload });
    setEditDateSheet(false);
    confirm();
    toast('Your dates are updated', { icon: 'calendar' });
  }

  function handlePanic() {
    if (panicState === 'idle') {
      setPanicState('confirm');
      setTimeout(() => setPanicState(s => s === 'confirm' ? 'idle' : s), 5000);
    } else if (panicState === 'confirm') {
      setPanicState('triggered');
      warn();
      setTimeout(() => setPanicState('idle'), 4000);
    }
  }

  async function addContact() {
    if (!contactName.trim() || !contactPhone.trim()) return;
    const name = contactName.trim();
    const phone = contactPhone.trim();
    try {
      await saveContact({ name, phone, relation: 'Trusted' });
      const fetched = await getContacts();
      dispatch({ type: 'SET_SOS_CONTACTS', payload: fetched || [] });
      setContactName('');
      setContactPhone('');
      setContactSheet(false);
      confirm();
      toast(`${name} is now in your circle, and on your SOS list`, { icon: 'heart' });
    } catch {
      toast('Could not add that contact. Check your connection and try again.', { icon: 'warning' });
    }
  }

  if (!pregnancyData.known) {
    return (
      <div className="screen screen--light preg-tint">
        <div style={{ padding: 'calc(env(safe-area-inset-top) + var(--sp-5)) var(--sp-6) var(--sp-8)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)' }}>Let's find your due date</h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>This drives everything else in your pregnancy journey.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}>
            <PregnancyDueDateForm onSave={saveDueDate} />
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen screen--light preg-tint">
      <div style={{ padding: 'calc(env(safe-area-inset-top) + var(--sp-5)) var(--sp-6) var(--sp-8)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)' }}>
              Due {formatDueDate(pregnancyData.dueDate)} · {pregnancyData.daysToGo} days to go
            </h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>Trimester {pregnancyData.trimester} · Week {weeks}</p>
          </div>
          <button
            onClick={() => setEditDateSheet(true)}
            className="btn btn--ghost btn--sm"
            style={{ color: 'var(--clr-brand)', fontSize: 'var(--text-xs)', width: 'auto', minHeight: 'auto', padding: 'var(--sp-2) var(--sp-3)', flexShrink: 0 }}
          >
            Edit
          </button>
        </motion.div>

        {/* Week ring */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-6)', background: 'var(--clr-surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--sp-6)', border: '1px solid var(--clr-border)' }}>
            <div className="week-ring" style={{ flexShrink: 0 }}>
              <svg className="week-ring__svg" width="160" height="160" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="66" fill="none" stroke="var(--clr-border)" strokeWidth="10" />
                <motion.circle
                  cx="80" cy="80" r="66"
                  fill="none"
                  stroke="var(--clr-brand)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: reduce ? circumference - dash : circumference }}
                  animate={{ strokeDashoffset: circumference - dash }}
                  transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
                />
              </svg>
              <div className="week-ring__label">
                <span className="week-ring__week">{shownWeeks}</span>
                <span className="week-ring__sub">weeks</span>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--sp-2)' }}>
                Baby is the size of a
              </p>
              <p style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-ink)' }}>
                {babySize}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Your moods — the same log Track shows outside pregnancy mode, so
            the record is continuous across the whole journey rather than
            restarting when pregnancy mode goes on or off. */}
        <MoodLogSection />

        {/* Today's check-in — mood read-back + physical symptom chips */}
        <PregnancySymptoms />

        {/* Kick counter — only meaningful once movement is reliably felt */}
        {weeks >= 28 && <PregnancyKickCounter />}

        {/* Next milestone */}
        {nextMilestone && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <div style={{ background: 'var(--clr-gold-soft)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4) var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--clr-gold)', display: 'flex', flexShrink: 0 }}><IconStar size={22} fill="currentColor" strokeWidth={0} /></span>
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                    Week {nextMilestone.week} milestone
                  </p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink)', fontWeight: 500, lineHeight: 'var(--leading-snug)' }}>
                    {nextMilestone.text}
                  </p>
                </div>
              </div>
              {nextMilestone.scanName && (
                <button
                  className="btn btn--primary btn--sm"
                  style={{ width: 'auto', alignSelf: 'flex-start', marginLeft: 38 }}
                  onClick={() => navigate(pregDoctorId ? `/doctor/${pregDoctorId}` : '/consult')}
                >
                  Book your {nextMilestone.scanName}
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Share with loved one */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.34, ease: [0.16, 1, 0.3, 1] }}>
          <p className="section-title">Share with a loved one</p>
          <button
            onClick={() => setShareSheet(true)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', padding: 'var(--sp-4) var(--sp-5)', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--clr-fertile-soft)', color: 'var(--clr-fertile)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconLink size={22} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink)' }}>Share health updates</p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>Appointments, mood, and medicine with family</p>
            </div>
            <ChevronRight />
          </button>
        </motion.div>

        {/* Trusted contacts */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.38, ease: [0.16, 1, 0.3, 1] }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
            <p className="section-title" style={{ marginBottom: 0 }}>Trusted contacts</p>
            <button className="btn btn--ghost btn--sm" onClick={() => setContactSheet(true)} style={{ color: 'var(--clr-brand)', fontSize: 'var(--text-sm)' }}>
              + Add
            </button>
          </div>
          {contacts.length === 0 ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-subtle)' }}>
              No one here yet. Add a partner or family member to keep them in the loop —
              they&rsquo;ll also be who your SOS button reaches.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {contacts.map((c, i) => (
                <div key={c.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-full)', background: 'var(--clr-brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--clr-brand)', flexShrink: 0 }}>
                    {c.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink)' }}>{c.name}</p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)' }}>{c.phone}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Panic button */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.42, ease: [0.16, 1, 0.3, 1] }}>
          <p className="section-title">Emergency</p>
          <button
            className={`panic-btn${panicState === 'confirm' ? ' panic-btn--confirming' : ''}`}
            onClick={handlePanic}
            aria-live="polite"
          >
            {panicState === 'idle' && <><AlertIcon /> Emergency alert</>}
            {panicState === 'confirm' && <><AlertIcon /> Tap again to confirm</>}
            {panicState === 'triggered' && <><IconCheck size={18} /> Contacts notified</>}
          </button>
          <p style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', marginTop: 'var(--sp-3)', lineHeight: 1.6 }}>
            {panicState === 'idle' && 'Notifies your trusted contacts and pre-booked hospital.'}
            {panicState === 'confirm' && 'Tap once more to send the alert to your contacts.'}
            {panicState === 'triggered' && 'Your contacts have been alerted. Stay calm.'}
          </p>
        </motion.div>
      </div>

      {/* Share sheet */}
      <BottomSheet open={shareSheet} onClose={() => setShareSheet(false)} title="Share with loved one">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {[
            { Icon: IconPill, label: 'Medicine schedule', desc: 'Prescriptions and reminders' },
            { Icon: IconAppointment, label: 'Appointments', desc: 'Upcoming consultations and follow-ups' },
            { Icon: IconMood, label: 'Mood updates', desc: 'Daily emotional check-ins' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', padding: 'var(--sp-4)', background: 'var(--clr-surface-2)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ color: 'var(--clr-brand)', display: 'flex' }}><item.Icon size={22} /></span>
              <div>
                <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink)' }}>{item.label}</p>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)' }}>{item.desc}</p>
              </div>
            </div>
          ))}
          <button className="btn btn--primary" onClick={() => setShareSheet(false)}>
            Generate share link
          </button>
        </div>
      </BottomSheet>

      {/* Add contact sheet */}
      <BottomSheet open={contactSheet} onClose={() => setContactSheet(false)} title="Add trusted contact">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div className="input-group">
            <label className="input-label" htmlFor="contact-name">Name</label>
            <input id="contact-name" className="input-field" type="text" placeholder="e.g. Rahul" value={contactName} onChange={e => setContactName(e.target.value)} autoFocus />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="contact-phone">Mobile number</label>
            <input id="contact-phone" className="input-field" type="tel" inputMode="tel" placeholder="98765 43210" value={contactPhone} onChange={e => setContactPhone(e.target.value.replace(/\D/g,'').slice(0,10))} />
          </div>
          <button className="btn btn--primary" onClick={addContact} disabled={!contactName.trim() || contactPhone.length < 10}>
            Add contact
          </button>
        </div>
      </BottomSheet>

      {/* Edit due date sheet */}
      <BottomSheet open={editDateSheet} onClose={() => setEditDateSheet(false)} title="Edit your dates">
        <PregnancyDueDateForm
          defaultMethod={state.pregnancy.dueDateOverride ? 'doctor' : 'lmp'}
          defaultDate={state.pregnancy.dueDateOverride || state.pregnancy.lastPeriodStart || ''}
          onSave={saveDueDate}
          onCancel={() => setEditDateSheet(false)}
        />
      </BottomSheet>
    </div>
  );
}

function formatDueDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function AlertIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" fill="currentColor" fillOpacity="0.2" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color: 'var(--clr-ink-subtle)', flexShrink: 0 }}>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
