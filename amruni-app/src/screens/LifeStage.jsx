import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { tap } from '../lib/haptics';
import { LIFE_STAGES } from '../data/mock';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

export default function LifeStage() {
  const navigate = useNavigate();
  const { dispatch } = useApp();
  const [selected, setSelected] = useState(null);

  function handleContinue() {
    if (!selected) return;
    dispatch({ type: 'SET_USER', payload: { lifeStage: selected } });
    navigate('/onboarding/profile');
  }

  return (
    <div className="screen screen--light">
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--sp-6)',
        paddingTop: 'calc(env(safe-area-inset-top) + var(--sp-8))',
        paddingBottom: 'var(--sp-8)',
      }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--clr-brand)',
            letterSpacing: '0.02em',
            marginBottom: 'var(--sp-3)',
          }}>
            Step 1 of 2
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 600,
            color: 'var(--clr-ink)',
            lineHeight: 'var(--leading-tight)',
            textWrap: 'balance',
          }}>
            Who are you here for?
          </h1>
          <p style={{
            marginTop: 'var(--sp-3)',
            fontSize: 'var(--text-base)',
            color: 'var(--clr-ink-muted)',
            lineHeight: 'var(--leading-base)',
          }}>
            Amruni adapts to your life stage. You can change this any time.
          </p>
        </motion.div>

        {/* Stage tiles */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: 'var(--sp-8)' }}
        >
          {LIFE_STAGES.map(stage => (
            <motion.div key={stage.id} variants={item}>
              <button
                className={`stage-tile${selected === stage.id ? ' stage-tile--active' : ''}`}
                onClick={() => { setSelected(stage.id); tap(); }}
                aria-pressed={selected === stage.id}
                style={{ width: '100%', textAlign: 'left' }}
              >
                <motion.div
                  className="stage-tile__icon"
                  animate={{ scale: selected === stage.id ? [1, 1.12, 1] : 1 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  {stage.icon}
                </motion.div>
                <div className="stage-tile__body">
                  <div className="stage-tile__title">{stage.label}</div>
                  <div className="stage-tile__desc">{stage.desc}</div>
                </div>
                <div className="stage-tile__check" aria-hidden="true">
                  {selected === stage.id && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <motion.path
                        d="M2 6l3 3 5-5"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </svg>
                  )}
                </div>
              </button>
            </motion.div>
          ))}
        </motion.div>

        <div style={{ flex: 1, minHeight: 'var(--sp-8)' }} />

        {/* CTA */}
        <motion.button
          className="btn btn--primary"
          onClick={handleContinue}
          disabled={!selected}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: selected ? 1 : 0.4, y: 0 }}
          transition={{ duration: 0.3, delay: 0.6 }}
        >
          Continue
          <ArrowRight />
        </motion.button>
      </div>
    </div>
  );
}

function ArrowRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
