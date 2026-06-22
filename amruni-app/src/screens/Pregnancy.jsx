import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import BottomSheet from '../components/BottomSheet';
import { useToast } from '../components/Toast';
import { confirm, warn } from '../lib/haptics';

const BABY_SIZE = ['Poppy seed','Sesame','Blueberry','Raspberry','Green olive','Prune','Lime','Lemon','Peach','Apple','Avocado','Turnip','Bell pepper','Tomato','Onion','Sweet potato','Mango','Banana','Papaya','Carrot','Corn','Spaghetti squash','Rutabaga','Eggplant','Acorn squash','Butternut squash','Cauliflower','Cabbage','Pineapple','Coconut','Jicama','Bok choy','Celery root','Honeydew melon','Cantaloupe','Romaine lettuce','Swiss chard','Watermelon','Pumpkin','Mini watermelon'];

const MILESTONES = [
  { week: 8, text: 'Tiny fingers and toes are forming.' },
  { week: 12, text: 'End of first trimester. Risk of miscarriage drops significantly.' },
  { week: 20, text: 'Anatomy scan this week. Baby can hear your voice.' },
  { week: 28, text: 'Third trimester begins. Baby can open her eyes.' },
  { week: 36, text: 'Baby is considered early term. Time to finalise birth plan.' },
  { week: 40, text: 'Due week. Your baby is ready to meet the world.' },
];

export default function Pregnancy() {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const reduce = useReducedMotion();
  const weeks = state.pregnancy.weeksPregnant || 16;
  const contacts = state.pregnancy.trustedContacts;

  const [panicState, setPanicState] = useState('idle'); // idle | confirm | triggered
  const [shareSheet, setShareSheet] = useState(false);
  const [contactSheet, setContactSheet] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // The week count climbs to today's value on mount — a small "you've come this
  // far" moment, synced with the ring sweeping to fill.
  const [shownWeeks, setShownWeeks] = useState(reduce ? weeks : 0);
  useEffect(() => {
    if (reduce) return; // initial state already rests at the final value
    let raf;
    const start = performance.now();
    const dur = 950;
    const step = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setShownWeeks(Math.round(eased * weeks));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [weeks, reduce]);

  const progress = Math.min(weeks / 40, 1);
  const circumference = 2 * Math.PI * 66;
  const dash = circumference * progress;

  const nextMilestone = MILESTONES.find(m => m.week >= weeks);
  const babySize = BABY_SIZE[Math.max(0, Math.min(weeks - 4, BABY_SIZE.length - 1))];

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

  function addContact() {
    if (!contactName.trim() || !contactPhone.trim()) return;
    const name = contactName.trim();
    dispatch({ type: 'SET_PREGNANCY', payload: { trustedContacts: [...contacts, { name, phone: contactPhone.trim() }] } });
    setContactName('');
    setContactPhone('');
    setContactSheet(false);
    confirm();
    toast(`${name} is now in your circle`, { icon: '🤍' });
  }

  const trimester = weeks <= 12 ? 1 : weeks <= 27 ? 2 : 3;

  return (
    <div className="screen screen--light">
      <div style={{ padding: 'calc(env(safe-area-inset-top) + var(--sp-5)) var(--sp-6) var(--sp-8)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)' }}>Pregnancy mode</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>Trimester {trimester} · Week {weeks}</p>
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
              <p style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-ink)', marginBottom: 'var(--sp-3)' }}>
                {babySize}
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-snug)', textWrap: 'pretty' }}>
                {40 - weeks} weeks to go
              </p>
            </div>
          </div>
        </motion.div>

        {/* Next milestone */}
        {nextMilestone && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}>
            <div style={{ background: 'var(--clr-gold-soft)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4) var(--sp-5)', display: 'flex', gap: 'var(--sp-4)', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>⭐</span>
              <div>
                <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                  Week {nextMilestone.week} milestone
                </p>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink)', fontWeight: 500, lineHeight: 'var(--leading-snug)' }}>
                  {nextMilestone.text}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Share with loved one */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.12 }}>
          <p className="section-title">Share with a loved one</p>
          <button
            onClick={() => setShareSheet(true)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', padding: 'var(--sp-4) var(--sp-5)', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--clr-fertile-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🔗</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink)' }}>Share health updates</p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>Appointments, mood, and medicine with family</p>
            </div>
            <ChevronRight />
          </button>
        </motion.div>

        {/* Trusted contacts */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.15 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
            <p className="section-title" style={{ marginBottom: 0 }}>Trusted contacts</p>
            <button className="btn btn--ghost btn--sm" onClick={() => setContactSheet(true)} style={{ color: 'var(--clr-brand)', fontSize: 'var(--text-sm)' }}>
              + Add
            </button>
          </div>
          {contacts.length === 0 ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-subtle)', fontStyle: 'italic' }}>
              No contacts yet. Add a partner or family member to keep them in the loop.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {contacts.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-md)' }}>
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
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.18 }}>
          <p className="section-title">Emergency</p>
          <button
            className={`panic-btn${panicState === 'confirm' ? ' panic-btn--confirming' : ''}`}
            onClick={handlePanic}
            aria-live="polite"
          >
            {panicState === 'idle' && <><AlertIcon /> Emergency alert</>}
            {panicState === 'confirm' && <><AlertIcon /> Tap again to confirm</>}
            {panicState === 'triggered' && <>✅ Contacts notified</>}
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
            { icon: '💊', label: 'Medicine schedule', desc: 'Prescriptions and reminders' },
            { icon: '📅', label: 'Appointments', desc: 'Upcoming consultations and follow-ups' },
            { icon: '😊', label: 'Mood updates', desc: 'Daily emotional check-ins' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', padding: 'var(--sp-4)', background: 'var(--clr-surface-2)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
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
    </div>
  );
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
