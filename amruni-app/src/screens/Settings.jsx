import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { LIFE_STAGES } from '../data/mock';
import BottomSheet from '../components/BottomSheet';
import { useToast } from '../components/Toast';
import { confirm } from '../lib/haptics';

export default function Settings() {
  const navigate = useNavigate();
  const toast = useToast();
  const { state, dispatch } = useApp();
  const { name, dob, lifeStage } = state.user;
  const { notifications, anonymousMode } = state.settings;

  const [stageSheet, setStageSheet] = useState(false);
  const [caretakerSheet, setCaretakerSheet] = useState(false);
  const [logoutSheet, setLogoutSheet] = useState(false);
  const [selectedStage, setSelectedStage] = useState(lifeStage);

  const stageInfo = LIFE_STAGES.find(s => s.id === lifeStage);
  const age = dob ? Math.floor((Date.now() - new Date(dob)) / (365.25 * 86400000)) : null;

  function saveStage() {
    const changed = selectedStage !== lifeStage;
    dispatch({ type: 'SET_USER', payload: { lifeStage: selectedStage } });
    setStageSheet(false);
    if (changed) {
      confirm();
      const label = LIFE_STAGES.find(s => s.id === selectedStage)?.label;
      toast(`Switched to ${label}`, { icon: '🌿' });
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
            fontSize: 26, flexShrink: 0,
          }}>
            {stageInfo?.icon ?? '👤'}
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
              <div className="settings-item__icon">🌱</div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Life stage</div>
                <div className="settings-item__desc">{stageInfo?.label ?? 'Not set'}</div>
              </div>
              <ChevronRight />
            </div>

            <div className="settings-item" role="button" tabIndex={0}>
              <div className="settings-item__icon">📋</div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Health records</div>
                <div className="settings-item__desc">Prescriptions, reports, history</div>
              </div>
              <ChevronRight />
            </div>

            <div className="settings-item" role="button" tabIndex={0}>
              <div className="settings-item__icon">🏥</div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Linked hospitals</div>
                <div className="settings-item__desc">Manage hospital associations</div>
              </div>
              <ChevronRight />
            </div>
          </div>
        </motion.div>

        {/* Notifications & Privacy */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}>
          <div className="settings-group">
            <div className="settings-group__title">Notifications & Privacy</div>

            <div className="settings-item">
              <div className="settings-item__icon">🔔</div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Push notifications</div>
                <div className="settings-item__desc">Appointments, reminders, cycle alerts</div>
              </div>
              <button
                className={`toggle${notifications ? ' toggle--on' : ''}`}
                onClick={() => dispatch({ type: 'SET_SETTINGS', payload: { notifications: !notifications } })}
                aria-pressed={notifications}
                aria-label="Toggle notifications"
              >
                <div className="toggle__knob" />
              </button>
            </div>

            <div className="settings-item">
              <div className="settings-item__icon">🔒</div>
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
              <div className="settings-item__icon">🛡️</div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Privacy policy</div>
                <div className="settings-item__desc">How your data is used and protected</div>
              </div>
              <ChevronRight />
            </div>
          </div>
        </motion.div>

        {/* Caretaker mode */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}>
          <div className="settings-group">
            <div className="settings-group__title">Caretaker</div>
            <div className="settings-item" onClick={() => setCaretakerSheet(true)} role="button" tabIndex={0}>
              <div className="settings-item__icon">🏡</div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Elderly care mode</div>
                <div className="settings-item__desc">Set up on behalf of a family member</div>
              </div>
              <ChevronRight />
            </div>
          </div>
        </motion.div>

        {/* App */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}>
          <div className="settings-group">
            <div className="settings-group__title">App</div>
            <div className="settings-item" role="button" tabIndex={0}>
              <div className="settings-item__icon">⭐</div>
              <div style={{ flex: 1 }}>
                <div className="settings-item__label">Rate Amruni</div>
                <div className="settings-item__desc">Help us improve</div>
              </div>
              <ChevronRight />
            </div>
            <div className="settings-item" role="button" tabIndex={0}>
              <div className="settings-item__icon">📨</div>
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
              <div className="settings-item__icon">🚪</div>
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
          Amruni v1.0 · Made with care in India 🇮🇳
        </motion.p>
      </div>

      {/* Life stage sheet */}
      <BottomSheet open={stageSheet} onClose={() => setStageSheet(false)} title="Change life stage">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {LIFE_STAGES.map(stage => (
            <button
              key={stage.id}
              className={`stage-tile${selectedStage === stage.id ? ' stage-tile--active' : ''}`}
              onClick={() => setSelectedStage(stage.id)}
              style={{ width: '100%', textAlign: 'left' }}
            >
              <div className="stage-tile__icon">{stage.icon}</div>
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
            <div style={{ fontSize: 40, marginBottom: 'var(--sp-3)' }}>🏡</div>
            <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink)', marginBottom: 'var(--sp-2)' }}>
              Setting up for a family member?
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', lineHeight: 1.6, textWrap: 'pretty' }}>
              Caretaker mode lets you manage appointments and health tracking for an elderly parent or relative. Their data stays private.
            </p>
          </div>
          <button className="btn btn--primary" onClick={() => { dispatch({ type: 'SET_USER', payload: { lifeStage: 'elderly' } }); setSelectedStage('elderly'); setCaretakerSheet(false); confirm(); toast('Elderly care mode is on', { icon: '🏡' }); }}>
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
