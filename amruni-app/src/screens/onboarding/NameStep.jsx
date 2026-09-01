import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';

export default function NameStep() {
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const [name, setName] = useState(state.user.name || '');

  const isValid = name.trim().length > 0;

  function next() {
    if (!isValid) return;
    dispatch({ type: 'SET_USER', payload: { name: name.trim() } });
    navigate('/onboarding/dob');
  }

  return (
    <div className="screen screen--light">
      <div className="onb-page">
        <OnboardHeader step={1} onBack={() => navigate('/onboarding/privacy')} />

        <div className="onb-body">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: 'center' }}
          >
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--clr-ink-muted)' }}>Let's get to know each other.</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 600, color: 'var(--clr-ink)', lineHeight: 'var(--leading-tight)', marginTop: 'var(--sp-2)', textWrap: 'balance' }}>
              What should Amruni call you?
            </h1>
          </motion.div>

          <motion.input
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="onboard-name-input"
            type="text"
            autoComplete="given-name"
            autoFocus
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && isValid) next(); }}
            aria-label="Your name"
          />
        </div>

        <button className="btn btn--primary" onClick={next} disabled={!isValid} style={{ opacity: isValid ? 1 : 0.5 }}>Continue</button>
      </div>
    </div>
  );
}

// Shared header: back chevron + step dots + skip.
export function OnboardHeader({ step, total = 4, onBack, onSkip }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }}>
      {onBack ? (
        <button onClick={onBack} aria-label="Back" style={{ display: 'flex', color: 'var(--clr-ink-muted)', background: 'none', border: 'none', padding: 'var(--sp-1)', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      ) : <span style={{ width: 28 }} />}
      <div style={{ display: 'flex', gap: 6 }} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} style={{ width: i + 1 === step ? 20 : 6, height: 6, borderRadius: 'var(--radius-full)', background: i + 1 === step ? 'var(--clr-brand)' : 'var(--clr-border)' }} />
        ))}
      </div>
      {onSkip ? (
        <button onClick={onSkip} style={{ color: 'var(--clr-ink-subtle)', background: 'none', border: 'none', fontSize: 'var(--text-sm)', fontWeight: 500, cursor: 'pointer' }}>Skip</button>
      ) : <span style={{ width: 28 }} />}
    </div>
  );
}
