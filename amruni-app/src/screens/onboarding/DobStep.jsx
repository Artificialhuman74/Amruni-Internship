import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { ageFromDob, stageFromDob } from '../../lib/lifeStage';
import { LIFE_STAGES } from '../../data/mock';
import { OnboardHeader } from './NameStep';

export default function DobStep() {
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const [dob, setDob] = useState(state.user.dob || '');

  const age = ageFromDob(dob);
  const stage = dob ? stageFromDob(dob) : null;
  const stageInfo = stage ? LIFE_STAGES.find((s) => s.id === stage) : null;
  const valid = age != null && age >= 8 && age <= 100;

  function next() {
    if (!valid) return;
    dispatch({ type: 'SET_USER', payload: { dob, lifeStage: stage } });
    navigate('/onboarding/health');
  }

  return (
    <div className="screen screen--light">
      <div className="onb-page">
        <OnboardHeader step={2} onBack={() => navigate('/onboarding/name')} />

        <div className="onb-body">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: 'center' }}
          >
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--clr-ink-muted)' }}>
              {state.user.name ? `Nice to meet you, ${state.user.name}.` : 'Nice to meet you.'}
            </p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 600, color: 'var(--clr-ink)', lineHeight: 'var(--leading-tight)', marginTop: 'var(--sp-2)', textWrap: 'balance' }}>
              When were you born?
            </h1>
            <p style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--text-sm)', color: 'var(--clr-ink-subtle)' }}>
              We tailor Amruni to your stage of life.
            </p>
          </motion.div>

          <motion.input
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="input-field"
            style={{ marginTop: 'var(--sp-6)', textAlign: 'center', fontSize: 'var(--text-lg)', fontWeight: 600 }}
            type="date"
            value={dob}
            max={new Date().toISOString().split('T')[0]}
            onChange={(e) => setDob(e.target.value)}
            aria-label="Date of birth"
          />

          <div style={{ minHeight: 64, marginTop: 'var(--sp-4)' }}>
            <AnimatePresence mode="wait">
              {stageInfo && valid && (
                <motion.div
                  key={stage}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', background: 'var(--clr-brand-soft)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-3) var(--sp-4)' }}
                >
                  <span style={{ color: 'var(--clr-brand)', display: 'flex' }} aria-hidden="true"><stageInfo.Icon size={24} /></span>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-brand)' }}>{stageInfo.label}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)' }}>Age {age} · we've set your experience to match</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <button className="btn btn--primary" onClick={next} disabled={!valid} style={{ opacity: valid ? 1 : 0.5 }}>Continue</button>
      </div>
    </div>
  );
}
