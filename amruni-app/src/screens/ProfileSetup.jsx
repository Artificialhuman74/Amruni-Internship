import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { dispatch } = useApp();
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [lastPeriod, setLastPeriod] = useState('');
  const [loading, setLoading] = useState(false);

  const { state } = useApp();
  const lifeStage = state.user.lifeStage;
  const showCycleField = ['adolescent', 'reproductive'].includes(lifeStage);

  const isValid = name.trim().length >= 2 && dob;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    dispatch({ type: 'SET_USER', payload: { name: name.trim(), dob, isOnboarded: true } });
    if (lastPeriod) {
      dispatch({ type: 'SET_CYCLE', payload: { lastPeriodStart: lastPeriod } });
    }
    navigate('/home', { replace: true });
  }

  function handleBack() {
    navigate('/onboarding/stage');
  }

  return (
    <div className="screen screen--light">
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--sp-6)',
        paddingTop: 'calc(env(safe-area-inset-top) + var(--sp-6))',
        paddingBottom: 'var(--sp-8)',
      }}>
        {/* Back */}
        <button
          onClick={handleBack}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', color: 'var(--clr-ink-muted)', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start', fontSize: 'var(--text-sm)', fontWeight: 500 }}
          aria-label="Back"
        >
          <ChevronLeft />
          Back
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginTop: 'var(--sp-8)' }}
        >
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-brand)', letterSpacing: '0.02em', marginBottom: 'var(--sp-3)' }}>
            Step 2 of 2
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 600,
            color: 'var(--clr-ink)',
            lineHeight: 'var(--leading-tight)',
          }}>
            Tell us a little about you
          </h1>
          <p style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--text-base)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-base)' }}>
            This stays private and helps us personalise your experience.
          </p>
        </motion.div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginTop: 'var(--sp-8)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}
          noValidate
        >
          <div className="input-group">
            <label className="input-label" htmlFor="name">Your name</label>
            <input
              id="name"
              className="input-field"
              type="text"
              autoComplete="given-name"
              placeholder="e.g. Priya"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="dob">Date of birth</label>
            <input
              id="dob"
              className="input-field"
              type="date"
              value={dob}
              onChange={e => setDob(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          {showCycleField && (
            <motion.div
              className="input-group"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
            >
              <label className="input-label" htmlFor="last-period">
                First day of your last period
                <span style={{ marginLeft: 'var(--sp-2)', fontWeight: 400, color: 'var(--clr-ink-subtle)' }}>
                  (optional)
                </span>
              </label>
              <input
                id="last-period"
                className="input-field"
                type="date"
                value={lastPeriod}
                onChange={e => setLastPeriod(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', marginTop: 'var(--sp-1)' }}>
                Used to calculate your cycle. Add later from the Track tab.
              </p>
            </motion.div>
          )}

          <div style={{ flex: 1, minHeight: 'var(--sp-6)' }} />

          <button
            type="submit"
            className="btn btn--primary"
            disabled={!isValid || loading}
            style={{ marginTop: 'var(--sp-4)' }}
          >
            {loading ? 'Setting up…' : 'Enter Amruni'}
          </button>
        </motion.form>
      </div>
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M11 4L7 9l4 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
