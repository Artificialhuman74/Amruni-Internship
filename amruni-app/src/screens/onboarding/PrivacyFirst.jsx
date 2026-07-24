import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import CamelliaHero from '../../components/CamelliaHero';
import { tap, confirm as confirmHaptic } from '../../lib/haptics';

const CONSENTS = [
  { id: 'health', required: true, label: 'I agree to Amruni processing my health data to personalise my care.' },
  { id: 'terms', required: true, label: <>I agree to the <u>Privacy Policy</u> and <u>Terms of Use</u>.</> },
  { id: 'analytics', required: false, label: 'I allow anonymous usage insights to help improve Amruni. (Optional)' },
];

export default function PrivacyFirst() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState({});

  const allRequired = CONSENTS.filter((c) => c.required).every((c) => checked[c.id]);

  function toggle(id) {
    tap();
    setChecked((c) => ({ ...c, [id]: !c[id] }));
  }
  function acceptAll() {
    confirmHaptic();
    setChecked(Object.fromEntries(CONSENTS.map((c) => [c.id, true])));
  }

  return (
    <div className="screen screen--soft">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top) + var(--sp-6)) var(--sp-6) var(--sp-6)' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginTop: 'var(--sp-4)' }}
        >
          <CamelliaHero size={220} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginTop: 'var(--sp-2)', textAlign: 'center' }}
        >
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 600, color: 'var(--clr-ink)', lineHeight: 'var(--leading-tight)' }}>
            Privacy, first.
          </h1>
          <p style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-base)', maxWidth: '32ch', marginInline: 'auto' }}>
            Your health is yours alone. Here's exactly what you're agreeing to — nothing hidden, nothing sold.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginTop: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
        >
          {CONSENTS.map((c) => (
            <button key={c.id} className={`consent-row${checked[c.id] ? ' consent-row--on' : ''}`} onClick={() => toggle(c.id)} aria-pressed={!!checked[c.id]}>
              <span className="consent-row__box" aria-hidden="true">
                {checked[c.id] && (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M2.5 7l2.5 2.5 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="consent-row__label">{c.label}</span>
            </button>
          ))}
        </motion.div>

        <div style={{ flex: 1, minHeight: 'var(--sp-4)' }} />

        <button className="btn btn--ghost btn--sm" onClick={acceptAll} style={{ margin: '0 auto var(--sp-3)', color: 'var(--clr-brand)', fontWeight: 600 }}>
          Accept all
        </button>
        <button
          className="btn btn--primary"
          disabled={!allRequired}
          onClick={() => navigate('/onboarding/name')}
          style={{ opacity: allRequired ? 1 : 0.5 }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
