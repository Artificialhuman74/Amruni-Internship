import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { LIFE_STAGES } from '../data/mock';
import BottomSheet from '../components/BottomSheet';
import ConditionPicker from '../components/ConditionPicker';
import PregnancyBloom from '../components/PregnancyBloom';
import { AnimatePresence } from 'framer-motion';
import { useToast } from '../components/Toast';
import { confirm } from '../lib/haptics';
import { getContacts, addContact, deleteContact } from '../lib/sosService';
import { meApi } from '../services/api';
import { insuranceApi } from '../services/insuranceApi';
import { intakeApi } from '../services/intakeApi';
import { summaryLine } from '../lib/insurance';
import { FORM_LIST } from '../data/intake';
import { permissionState, requestPermission, notificationsSupported } from '../lib/reminders';
import { useEffect } from 'react';
import {
  IconUser, IconSprout, IconRecords, IconHospital, IconBell, IconLock,
  IconShield, IconPregnant, IconHome, IconPlus, IconClose, IconSettings,
  IconStar, IconSend, IconLogout, FlagIN, IconStethoscope, IconLeaf,
} from '../icons.jsx';

export default function Settings() {
  const navigate = useNavigate();
  const toast = useToast();
  const { state, dispatch } = useApp();
  const { name, dob, lifeStage } = state.user;
  const { notifications, anonymousMode, pregnancyMode, conceiveMode } = state.settings;
  const [bloom, setBloom] = useState(false);

  function togglePregnancy() {
    const next = !pregnancyMode;
    dispatch({ type: 'SET_SETTINGS', payload: { pregnancyMode: next } });
    confirm();
    if (next) {
      setBloom(true); // The Bloom plays, then we land on the reshaped Home
    } else {
      toast('Pregnancy mode off', { icon: 'bloom' });
    }
  }

  const [stageSheet, setStageSheet] = useState(false);
  const [caretakerSheet, setCaretakerSheet] = useState(false);
  const [logoutSheet, setLogoutSheet] = useState(false);
  const [selectedStage, setSelectedStage] = useState(lifeStage);
  const [healthSheet, setHealthSheet] = useState(false);
  const [conditions, setConditions] = useState(state.health?.conditions ?? []);
  const [savingHealth, setSavingHealth] = useState(false);
  const [contactSheet, setContactSheet] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRelation, setContactRelation] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const sosContacts = state.sos?.contacts ?? [];
  const phoneId = state.auth?.phone;

  // Coverage and intake summaries. Both are read-only glances — the rows they
  // label say what is on file, never a policy number, and both degrade to the
  // "not set up" copy when the request fails rather than showing an error in a
  // settings list.
  const [coverage, setCoverage] = useState(null);
  const [intakeDates, setIntakeDates] = useState({});

  useEffect(() => {
    let cancelled = false;
    insuranceApi.get()
      .then((res) => { if (!cancelled && res?.payerType) setCoverage(res); })
      .catch(() => {});
    intakeApi.list()
      .then((rows) => {
        if (cancelled) return;
        const latest = {};
        for (const row of rows) {
          if (!latest[row.formId]) {
            latest[row.formId] = new Date(row.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          }
        }
        setIntakeDates(latest);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [phoneId]);

  const coverageLine = coverage ? summaryLine(coverage) : 'Add your policy to claim consultations back';

  useEffect(() => {
    async function loadContacts() {
      if (!phoneId) return;
      try {
        const fetched = await getContacts();
        dispatch({ type: 'SET_SOS_CONTACTS', payload: fetched || [] });
      } catch (e) {
        console.error("Failed to load contacts:", e);
      }
    }
    loadContacts();
  }, [phoneId, dispatch]);

  const stageInfo = LIFE_STAGES.find(s => s.id === lifeStage);
  const age = dob ? Math.floor((Date.now() - new Date(dob)) / (365.25 * 86400000)) : null;

  function saveStage() {
    const changed = selectedStage !== lifeStage;
    dispatch({ type: 'SET_USER', payload: { lifeStage: selectedStage } });
    setStageSheet(false);
    if (changed) {
      confirm();
      const label = LIFE_STAGES.find(s => s.id === selectedStage)?.label;
      toast(`Switched to ${label}`, { icon: 'leaf' });
    }
  }

  function handleLogout() {
    dispatch({ type: 'LOGOUT' });
    navigate('/phone', { replace: true });
  }

  return (
    <div className="screen screen--light">
      <div style={{ padding: 'calc(env(safe-area-inset-top) + var(--sp-5)) var(--sp-6) var(--sp-8)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>

        {/* Profile card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: 'var(--clr-dark)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--sp-6)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-5)',
          }}
        >
          <div style={{
            width: 60, height: 60,
            borderRadius: 'var(--radius-full)',
            background: 'oklch(0.52 0.18 355 / 0.25)',
            border: '2px solid var(--clr-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--clr-brand)', flexShrink: 0,
          }}>
            {stageInfo?.Icon ? <stageInfo.Icon size={26} /> : <IconUser size={26} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-ink-on-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name || 'Your profile'}
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted-on-dark)', marginTop: 2 }}>
              {age ? `${age} years · ` : ''}{stageInfo?.label ?? 'No stage selected'}
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted-on-dark)', marginTop: 2 }}>
              +91 {state.auth.phone || '—'}
            </p>
          </div>
        </motion.div>

        {/* Account */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}>
          <div className="settings-group">
            <div className="settings-group__title">Account</div>

            <div className="settings-item" onClick={() => setStageSheet(true)} role="button" tabIndex={0}>
              <div className="settings-item__icon">{stageInfo?.Icon ? <stageInfo.Icon size={20} /> : <IconSprout size={20} />}</div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Life stage</div>
                <div className="settings-item__desc">{stageInfo?.label ?? 'Not set'}</div>
              </div>
              <ChevronRight />
            </div>

            <div className="settings-item" role="button" tabIndex={0}>
              <div className="settings-item__icon"><IconRecords size={20} /></div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Health records</div>
                <div className="settings-item__desc">Prescriptions, reports, history</div>
              </div>
              <ChevronRight />
            </div>

            {/* Sits in Account rather than under a heading of its own: to the
                woman filling it in this is a fact about her, alongside her life
                stage and her records — not a feature. */}
            <div
              className="settings-item"
              onClick={() => navigate('/insurance')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/insurance')}
            >
              <div className="settings-item__icon" style={{ background: 'var(--clr-sky-soft)', color: 'var(--clr-sky)' }}><IconShield size={20} /></div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Insurance & coverage</div>
                <div className="settings-item__desc">{coverageLine}</div>
              </div>
              <ChevronRight />
            </div>

            <div className="settings-item" role="button" tabIndex={0}>
              <div className="settings-item__icon"><IconHospital size={20} /></div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Linked hospitals</div>
                <div className="settings-item__desc">Manage hospital associations</div>
              </div>
              <ChevronRight />
            </div>
          </div>
        </motion.div>

        {/* Traditional care */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.11, ease: [0.16, 1, 0.3, 1] }}>
          <div className="settings-group">
            <div className="settings-group__title">Traditional care</div>
            <div
              className="settings-item"
              onClick={() => navigate('/therapies')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/therapies')}
            >
              <div className="settings-item__icon" style={{ background: 'var(--clr-sage-soft)', color: 'var(--clr-sage)' }}><IconLeaf size={20} /></div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Ayurveda, yoga & reiki</div>
                <div className="settings-item__desc">What each one is for, and who practises it</div>
              </div>
              <ChevronRight />
            </div>
            {FORM_LIST.map((form) => {
              const done = intakeDates[form.id];
              return (
                <div
                  key={form.id}
                  className="settings-item"
                  onClick={() => navigate(`/intake/${form.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/intake/${form.id}`)}
                >
                  <div className="settings-item__icon"><IconRecords size={20} /></div>
                  <div style={{ flex: 1 }}>
                    <div className="settings-item__label">{form.label}</div>
                    <div className="settings-item__desc">
                      {done
                        ? `Filled ${done} — fill it again before your next consultation`
                        : `${form.minutes} minutes · your practitioner reads it before you meet`}
                    </div>
                  </div>
                  <ChevronRight />
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Notifications & Privacy */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}>
          <div className="settings-group">
            <div className="settings-group__title">Notifications & Privacy</div>

            <div className="settings-item">
              <div className="settings-item__icon"><IconBell size={20} /></div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Push notifications</div>
                <div className="settings-item__desc">
                  {permissionState() === 'denied'
                    ? 'Blocked in your browser settings for this site'
                    : notificationsSupported()
                      ? 'Medicine doses, appointments and follow-ups'
                      : 'Not supported by this browser'}
                </div>
              </div>
              <button
                className={`toggle${notifications ? ' toggle--on' : ''}`}
                onClick={async () => {
                  if (notifications) {
                    dispatch({ type: 'SET_SETTINGS', payload: { notifications: false } });
                    return;
                  }
                  // Ask only here — a permission prompt on app open, before the
                  // app has done anything for her, earns a permanent block.
                  const result = await requestPermission();
                  if (result === 'granted') {
                    dispatch({ type: 'SET_SETTINGS', payload: { notifications: true } });
                    confirm();
                  } else if (result === 'denied') {
                    toast('Notifications are blocked in your browser settings for this site.', { icon: 'warning' });
                  } else if (result === 'unsupported') {
                    toast('This browser cannot show reminders.', { icon: 'warning' });
                  }
                }}
                aria-pressed={notifications}
                aria-label="Toggle notifications"
              >
                <div className="toggle__knob" />
              </button>
            </div>

            <div className="settings-item">
              <div className="settings-item__icon"><IconLock size={20} /></div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Anonymous mode</div>
                <div className="settings-item__desc">Hide identity in mental health sessions</div>
              </div>
              <button
                className={`toggle${anonymousMode ? ' toggle--on' : ''}`}
                onClick={() => dispatch({ type: 'SET_SETTINGS', payload: { anonymousMode: !anonymousMode } })}
                aria-pressed={anonymousMode}
                aria-label="Toggle anonymous mode"
              >
                <div className="toggle__knob" />
              </button>
            </div>

            <div className="settings-item" role="button" tabIndex={0}>
              <div className="settings-item__icon"><IconShield size={20} /></div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Privacy policy</div>
                <div className="settings-item__desc">How your data is used and protected</div>
              </div>
              <ChevronRight />
            </div>
          </div>
        </motion.div>

        {/* Your experience */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}>
          <div className="settings-group">
            <div className="settings-group__title">Your experience</div>
            <div
              className="settings-item"
              onClick={() => { setConditions(state.health?.conditions ?? []); setHealthSheet(true); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setHealthSheet(true)}
            >
              <div className="settings-item__icon" style={{ background: 'var(--clr-sky-soft)', color: 'var(--clr-sky)' }}><IconStethoscope size={20} /></div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Health background</div>
                <div className="settings-item__desc">
                  {state.health?.conditions?.length
                    ? `${state.health.conditions.length} condition${state.health.conditions.length === 1 ? '' : 's'} — your doctor sees these`
                    : 'Conditions you live with, shared with your doctor'}
                </div>
              </div>
              <ChevronRight />
            </div>
            {/* Above pregnancy mode, since one usually precedes the other, and
                off in one tap: a fertile-window countdown is the first thing a
                woman wants gone when trying stops — whether it stopped because
                it worked or because it didn't. */}
            <div className="settings-item">
              <div className="settings-item__icon" style={{ background: 'var(--clr-sage-soft)', color: 'var(--clr-sage)' }}><IconSprout size={20} /></div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Trying to conceive</div>
                <div className="settings-item__desc">
                  {pregnancyMode
                    ? 'Paused while pregnancy mode is on'
                    : 'Your fertile window in Track, and a nudge on the days that count'}
                </div>
              </div>
              <button
                className={`toggle${conceiveMode && !pregnancyMode ? ' toggle--on' : ''}`}
                onClick={() => {
                  if (pregnancyMode) return;
                  const next = !conceiveMode;
                  dispatch({ type: 'SET_SETTINGS', payload: { conceiveMode: next } });
                  confirm();
                  toast(next ? 'Fertile window added to Track' : 'Trying-to-conceive mode off', { icon: next ? 'check' : 'bloom' });
                }}
                aria-pressed={conceiveMode && !pregnancyMode}
                aria-label="Toggle trying to conceive mode"
                disabled={pregnancyMode}
              >
                <div className="toggle__knob" />
              </button>
            </div>
            <div className="settings-item">
              <div className="settings-item__icon" style={{ background: 'var(--clr-preg-soft)' }}><IconPregnant size={20} /></div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Pregnancy mode</div>
                <div className="settings-item__desc">Turn your Track tab into a week-by-week pregnancy journey</div>
              </div>
              <button
                className={`toggle${pregnancyMode ? ' toggle--on' : ''}`}
                onClick={togglePregnancy}
                aria-pressed={pregnancyMode}
                aria-label="Toggle pregnancy mode"
              >
                <div className="toggle__knob" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Caretaker mode */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}>
          <div className="settings-group">
            <div className="settings-group__title">Caretaker</div>
            {/* One home for care. Creating a link and seeing what was done with
                it are the same subject, and splitting them left the ledger with
                nowhere she could reach it. */}
            <div
              className="settings-item"
              onClick={() => navigate('/care-activity')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/care-activity')}
            >
              <div className="settings-item__icon" style={{ background: 'var(--clr-sage-soft)', color: 'var(--clr-sage)' }}><IconSend size={20} /></div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Care sharing</div>
                <div className="settings-item__desc">Who can see your record, and what they have done</div>
              </div>
              <ChevronRight />
            </div>
            <div className="settings-item" onClick={() => setCaretakerSheet(true)} role="button" tabIndex={0}>
              <div className="settings-item__icon"><IconHome size={20} /></div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Elderly care mode</div>
                <div className="settings-item__desc">Set up on behalf of a family member</div>
              </div>
              <ChevronRight />
            </div>
          </div>
        </motion.div>

        {/* Emergency Contacts */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}>
          <div className="settings-group">
            <div className="settings-group__title">Emergency Contacts</div>
            {sosContacts.map(c => (
              <div key={c.id} className="settings-item" style={{ cursor: 'default' }}>
                <div className="settings-item__icon" style={{ background: 'var(--clr-emergency-soft)', color: 'var(--clr-emergency)', fontWeight: 700 }}>
                  {c.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="settings-item__label">{c.name}</div>
                  <div className="settings-item__desc">{c.phone}</div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await deleteContact(c.id);
                      const updated = sosContacts.filter(contact => contact.id !== c.id);
                      dispatch({ type: 'SET_SOS_CONTACTS', payload: updated });
                      toast('Contact removed', { icon: 'trash' });
                    } catch (e) {
                      toast('Failed to remove contact', { icon: 'warning' });
                    }
                  }}
                  aria-label={`Remove ${c.name}`}
                  style={{
                    width: 36, height: 36,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--clr-surface-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--clr-ink-muted)', flexShrink: 0,
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  <IconClose size={15} />
                </button>
              </div>
            ))}
            <div
              className="settings-item"
              onClick={() => {
                if (sosContacts.length >= 5) {
                  toast('Maximum 5 emergency contacts allowed', { icon: 'warning' });
                  return;
                }
                setContactName('');
                setContactPhone('');
                setContactSheet(true);
              }}
              role="button"
              tabIndex={0}
            >
              <div className="settings-item__icon" style={{ background: 'var(--clr-emergency-soft)', color: 'var(--clr-emergency)' }}><IconPlus size={20} /></div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label" style={{ color: 'var(--clr-emergency)' }}>Add contact</div>
                <div className="settings-item__desc">{sosContacts.length}/5 contacts added</div>
              </div>
              <ChevronRight />
            </div>
          </div>
        </motion.div>

        {/* App */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}>
          <div className="settings-group">
            <div className="settings-group__title">App</div>
            <div className="settings-item" onClick={() => navigate('/admin')} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
              <div className="settings-item__icon"><IconSettings size={20} /></div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Admin Portal</div>
                <div className="settings-item__desc">Manage doctors and services</div>
              </div>
              <ChevronRight />
            </div>
            {/* DEV ONLY — stripped from production builds (import.meta.env.DEV === false).
                Tracked in PRODUCTION_CHECKLIST.md; must never ship enabled. */}
            {import.meta.env.DEV && (
              <div className="settings-item" onClick={() => navigate('/onboarding/privacy')} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
                <div className="settings-item__icon" style={{ background: 'var(--clr-gold-soft)', color: 'oklch(0.5 0.1 70)' }}><IconSprout size={20} /></div>
                <div style={{ flex: 1 }}>
                  <div className="settings-item__label">Replay onboarding <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'oklch(0.5 0.1 70)', letterSpacing: '0.04em' }}>DEV</span></div>
                  <div className="settings-item__desc">Jump back to the first-run flow · not shown in production</div>
                </div>
                <ChevronRight />
              </div>
            )}
            <div className="settings-item" role="button" tabIndex={0}>
              <div className="settings-item__icon"><IconStar size={20} /></div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Rate Amruni</div>
                <div className="settings-item__desc">Help us improve</div>
              </div>
              <ChevronRight />
            </div>
            <div className="settings-item" role="button" tabIndex={0}>
              <div className="settings-item__icon"><IconSend size={20} /></div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Send feedback</div>
                <div className="settings-item__desc">Questions, suggestions, or concerns</div>
              </div>
              <ChevronRight />
            </div>
            <div
              className="settings-item"
              onClick={() => setLogoutSheet(true)}
              role="button"
              tabIndex={0}
              style={{ cursor: 'pointer' }}
            >
              <div className="settings-item__icon" style={{ color: 'var(--clr-brand)' }}><IconLogout size={20} /></div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label" style={{ color: 'var(--clr-brand)' }}>Sign out</div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)' }}
        >
          Amruni v1.0 · Made with care in India <FlagIN size={13} style={{ verticalAlign: '-2px', marginLeft: 2 }} />
        </motion.p>
      </div>

      {/* Life stage sheet */}

      <BottomSheet open={healthSheet} onClose={() => !savingHealth && setHealthSheet(false)} title="Health background">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', minHeight: '52dvh' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-snug)', textWrap: 'pretty' }}>
            Conditions you already live with. Your doctor sees these on your chart, and your
            period predictions widen to match anything that affects your cycle.
          </p>
          <ConditionPicker selected={conditions} onChange={setConditions} />
          <button
            className="btn btn--primary"
            disabled={savingHealth}
            onClick={async () => {
              setSavingHealth(true);
              dispatch({ type: 'SET_HEALTH', payload: { conditions } });
              try {
                await meApi.putHealth({
                  conditions,
                  allergies: state.health?.allergies ?? [],
                  bloodGroup: state.health?.bloodGroup ?? null,
                });
                confirm();
                toast('Health background updated', { icon: 'check' });
                setHealthSheet(false);
              } catch {
                toast('Could not save that. Check your connection and try again.', { icon: 'warning' });
              } finally {
                setSavingHealth(false);
              }
            }}
          >
            {savingHealth ? 'Saving…' : 'Save'}
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={stageSheet} onClose={() => setStageSheet(false)} title="Change life stage">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {LIFE_STAGES.map(stage => (
            <button
              key={stage.id}
              className={`stage-tile${selectedStage === stage.id ? ' stage-tile--active' : ''}`}
              onClick={() => setSelectedStage(stage.id)}
              style={{ width: '100%', textAlign: 'left' }}
            >
              <div className="stage-tile__icon"><stage.Icon size={22} /></div>
              <div className="stage-tile__body">
                <div className="stage-tile__title">{stage.label}</div>
              </div>
              <div className="stage-tile__check">
                {selectedStage === stage.id && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </button>
          ))}
          <button className="btn btn--primary" onClick={saveStage} style={{ marginTop: 'var(--sp-2)' }}>
            Save
          </button>
        </div>
      </BottomSheet>

      {/* Caretaker sheet */}
      <BottomSheet open={caretakerSheet} onClose={() => setCaretakerSheet(false)} title="Elderly care mode">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div style={{ background: 'var(--clr-surface-2)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-5)', textAlign: 'center' }}>
            <div style={{ color: 'var(--clr-brand)', display: 'flex', justifyContent: 'center', marginBottom: 'var(--sp-3)' }}><IconHome size={40} /></div>
            <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink)', marginBottom: 'var(--sp-2)' }}>
              Setting up for a family member?
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', lineHeight: 1.6, textWrap: 'pretty' }}>
              Caretaker mode lets you manage appointments and health tracking for an elderly parent or relative. Their data stays private.
            </p>
          </div>
          <button className="btn btn--primary" onClick={() => { dispatch({ type: 'SET_USER', payload: { lifeStage: 'elderly' } }); setSelectedStage('elderly'); setCaretakerSheet(false); confirm(); toast('Elderly care mode is on', { icon: 'home' }); }}>
            Switch to elderly care mode
          </button>
          <button className="btn btn--secondary" onClick={() => setCaretakerSheet(false)}>
            Cancel
          </button>
        </div>
      </BottomSheet>

      {/* Logout confirm */}
      <BottomSheet open={logoutSheet} onClose={() => setLogoutSheet(false)} title="Sign out">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <p style={{ textAlign: 'center', fontSize: 'var(--text-base)', color: 'var(--clr-ink-muted)', lineHeight: 1.6 }}>
            Are you sure you want to sign out? Your health data will remain saved.
          </p>
          <button className="btn btn--primary" style={{ background: 'var(--clr-brand)' }} onClick={handleLogout}>
            Yes, sign out
          </button>
          <button className="btn btn--secondary" onClick={() => setLogoutSheet(false)}>
            Cancel
          </button>
        </div>
      </BottomSheet>

      {/* Add emergency contact */}
      <BottomSheet open={contactSheet} onClose={() => setContactSheet(false)} title="Add emergency contact">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div className="input-group">
            <label className="input-label">Name</label>
            <input
              className="input-field"
              type="text"
              placeholder="Contact name"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              maxLength={40}
            />
          </div>
          <div className="input-group">
            <label className="input-label">Phone number</label>
            <input
              className="input-field"
              type="tel"
              placeholder="+91 9876543210"
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              maxLength={15}
            />
          </div>
          <div className="input-group">
            <label className="input-label">Relation</label>
            <input
              className="input-field"
              type="text"
              placeholder="e.g. Husband, Mother, Friend"
              value={contactRelation}
              onChange={e => setContactRelation(e.target.value)}
              maxLength={20}
            />
          </div>
          <button
            className="btn btn--primary"
            disabled={!contactName.trim() || !contactPhone.trim() || isSaving}
            onClick={async () => {
              if (isSaving) return;
              setIsSaving(true);
              try {
                const newContact = {
                  name: contactName.trim(),
                  phone: contactPhone.trim(),
                  relation: contactRelation.trim(),
                };
                const newId = await addContact(newContact);
                const updated = [...sosContacts, { ...newContact, id: newId, userId: phoneId }];
                dispatch({ type: 'SET_SOS_CONTACTS', payload: updated });
                setContactSheet(false);
                confirm();
                toast('Contact added', { icon: 'check' });
              } catch (e) {
                toast('Failed to add contact', { icon: 'warning' });
              } finally {
                setIsSaving(false);
              }
            }}
            style={{ marginTop: 'var(--sp-2)' }}
          >
            {isSaving ? 'Saving...' : 'Save contact'}
          </button>
        </div>
      </BottomSheet>

      {/* The Bloom — plays when pregnancy mode is switched on, then opens Track */}
      <AnimatePresence>
        {bloom && <PregnancyBloom onDone={() => { setBloom(false); navigate('/home'); }} />}
      </AnimatePresence>
    </div>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color: 'var(--clr-ink-subtle)', flexShrink: 0 }}>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
