import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getAlerts } from '../lib/sosService';
import { useSOSActivation } from '../lib/useSOSActivation';
import { medicalSummary } from '../lib/sos';
import { useToast } from '../components/Toast';
import { tap } from '../lib/haptics';
import { IconPhone, IconShield } from '../icons.jsx';

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
};

export default function SOSCenter() {
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const { contacts, alerts } = state.sos;
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [testing, setTesting] = useState(false);
  const { activateSOS } = useSOSActivation();
  const toast = useToast();

  useEffect(() => {
    async function loadAlerts() {
      if (!state.auth.phone) return;
      try {
        const fetchedAlerts = await getAlerts();
        dispatch({ type: 'SET_SOS_ALERTS', payload: fetchedAlerts });
      } catch (e) {
        console.error("Failed to load alerts:", e);
      } finally {
        setLoadingAlerts(false);
      }
    }
    loadAlerts();
  }, [state.auth.phone, dispatch]);

  return (
    <div className="screen screen--light">
      <motion.div 
        variants={stagger} 
        initial="hidden" 
        animate="show"
        style={{ padding: 'var(--sp-6)', paddingTop: 'calc(env(safe-area-inset-top) + var(--sp-6))', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}
      >
        {/* 1. Page header */}
        <motion.div variants={fadeUp}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', fontWeight: 500 }}>Emergency</p>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)' }}>SOS Center</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 4 }}>
            Hold the SOS button to alert your emergency contacts instantly.
          </p>
        </motion.div>

        {/* 2. Call 112 card */}
        <motion.div variants={fadeUp} style={{ background: 'var(--clr-dark)', borderRadius: 'var(--radius-xl)', padding: 'var(--sp-5)' }}>
          <p style={{ color: 'var(--clr-gold)', fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Emergency Services</p>
          <p style={{ color: 'var(--clr-ink-on-dark)', fontSize: 'var(--text-md)', fontWeight: 600, margin: 'var(--sp-2) 0 var(--sp-4)' }}>Call 112 — India's unified emergency number</p>
          <a href="tel:112" onClick={() => tap()} className="btn btn--emergency" style={{ display: 'inline-flex', width: '100%', justifyContent: 'center', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <IconPhone size={18} /> Call 112 Now
          </a>
        </motion.div>

        {/* 3. How it works */}
        <motion.div variants={fadeUp} style={{ background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-xl)', padding: 'var(--sp-5)' }}>
          <p style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--clr-ink)', marginBottom: 'var(--sp-4)' }}>How it works</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-full)', background: 'var(--clr-brand-soft)', color: 'var(--clr-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 700, flexShrink: 0 }}>1</div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink)' }}>Hold the SOS button for 1 second</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-full)', background: 'var(--clr-brand-soft)', color: 'var(--clr-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 700, flexShrink: 0 }}>2</div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink)' }}>5-second countdown (cancel anytime)</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-full)', background: 'var(--clr-brand-soft)', color: 'var(--clr-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 700, flexShrink: 0 }}>3</div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink)' }}>Your location and medical details go to every contact</p>
            </div>
          </div>
        </motion.div>

        {/* What the alert will actually say. A woman should be able to read
            her own emergency message before she ever has to send it — and see
            what is missing from it while there is still time to add it. */}
        <motion.div variants={fadeUp} style={{ background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-xl)', padding: 'var(--sp-5)' }}>
          <p style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--clr-ink)', marginBottom: 'var(--sp-3)' }}>What your contacts will see</p>

          {(() => {
            const medical = {
              bloodGroup: state.health?.bloodGroup ?? null,
              allergies: state.health?.allergies ?? [],
              conditions: state.health?.conditions ?? [],
            };
            const lines = medicalSummary(medical);
            return lines.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)', marginBottom: 'var(--sp-4)' }}>
                {lines.map((l) => (
                  <p key={l} style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink)' }}>{l}</p>
                ))}
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', marginTop: 'var(--sp-1)' }}>
                  Sent with your live location, so a responder knows this before reaching you.
                </p>
              </div>
            ) : (
              <button
                onClick={() => { tap(); navigate('/settings'); }}
                style={{ width: '100%', textAlign: 'left', background: 'var(--clr-warning-soft)', border: 'none', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-4)', cursor: 'pointer' }}
              >
                <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink)' }}>
                  Only your location will be sent
                </span>
                <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 2, lineHeight: 'var(--leading-snug)' }}>
                  Add your blood group and any conditions so responders know them. Tap to add.
                </span>
              </button>
            );
          })()}

          <button
            className="btn btn--secondary"
            disabled={testing || contacts.length === 0}
            onClick={async () => {
              tap();
              setTesting(true);
              try {
                await activateSOS({ test: true });
              } catch {
                toast('Could not send the test. Check your connection.', { icon: 'warning' });
              } finally {
                setTesting(false);
              }
            }}
          >
            {testing ? 'Sending test…' : 'Send a test alert'}
          </button>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', marginTop: 'var(--sp-2)', lineHeight: 'var(--leading-snug)', textWrap: 'pretty' }}>
            {contacts.length === 0
              ? 'Add a contact first — there is no one to test with yet.'
              : 'Clearly marked as a test. Nothing is recorded and no emergency services are contacted.'}
          </p>
        </motion.div>

        {/* 4. Contacts preview */}
        <motion.div variants={fadeUp}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
            <p style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--clr-ink)' }}>Emergency Contacts</p>
            {contacts.length > 0 && (
              <button onClick={() => navigate('/settings')} style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-brand)', fontWeight: 600 }}>Edit</button>
            )}
          </div>
          
          {contacts.length === 0 ? (
            <div style={{ background: 'var(--clr-surface-2)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-5)', textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginBottom: 'var(--sp-3)' }}>No emergency contacts added yet.</p>
              <button onClick={() => navigate('/settings')} className="btn btn--secondary btn--sm">Add Contacts</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {contacts.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-3) var(--sp-4)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-full)', background: 'var(--clr-brand-soft)', color: 'var(--clr-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconShield size={16} /></div>
                  <div>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink)' }}>{c.name}</p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)' }}>{c.phone}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* 5. Alert history */}
        <motion.div variants={fadeUp}>
          <p style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--clr-ink)', marginBottom: 'var(--sp-4)' }}>Recent alerts</p>
          {loadingAlerts ? (
            <div className="skeleton" style={{ height: 60, width: '100%' }} />
          ) : alerts?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {alerts.slice(0, 3).map((alert, i) => (
                <div key={alert.id || i} style={{ background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-3) var(--sp-4)' }}>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink)', fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{alert.message}</p>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 4 }}>{new Date(alert.timestamp).toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)' }}>No alerts sent yet.</p>
          )}
        </motion.div>

        {/* 6. Bottom padding */}
        <div style={{ height: 'var(--sp-4)' }} />
      </motion.div>
    </div>
  );
}
