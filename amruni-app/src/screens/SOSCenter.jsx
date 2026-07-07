import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getAlerts } from '../lib/sosService';
import { tap } from '../lib/haptics';

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

  useEffect(() => {
    async function loadAlerts() {
      if (!state.auth.phone) return;
      try {
        const fetchedAlerts = await getAlerts(state.auth.phone);
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
          <a href="tel:112" onClick={() => tap()} className="btn btn--emergency" style={{ display: 'inline-flex', width: '100%', justifyContent: 'center' }}>
            📞 Call 112 Now
          </a>
        </motion.div>

        {/* 3. How it works */}
        <motion.div variants={fadeUp} style={{ background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-xl)', padding: 'var(--sp-5)' }}>
          <p style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--clr-ink)', marginBottom: 'var(--sp-4)' }}>How it works</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-full)', background: 'var(--clr-brand-soft)', color: 'var(--clr-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 700, flexShrink: 0 }}>1</div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink)' }}>Hold SOS button for 0.5s</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-full)', background: 'var(--clr-brand-soft)', color: 'var(--clr-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 700, flexShrink: 0 }}>2</div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink)' }}>5-second countdown (cancel anytime)</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-full)', background: 'var(--clr-brand-soft)', color: 'var(--clr-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 700, flexShrink: 0 }}>3</div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink)' }}>SMS + call sent to all contacts</p>
            </div>
          </div>
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
                  <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-full)', background: 'var(--clr-brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🛡️</div>
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
