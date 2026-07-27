import { motion, useReducedMotion } from 'framer-motion';
import { useApp } from '../../../context/AppContext';
import { tap } from '../../../lib/haptics';
import { IconFootprints } from '../../../icons.jsx';

// Medically, ten kicks in a couple of hours is the commonly cited reassuring
// benchmark — but this component intentionally doesn't time or gate on that.
// It's a single quiet acknowledgment once the day's count reaches it, not a
// goal, streak, or score.
const MILESTONE_COUNT = 10;
const EASE_EXPO = [0.16, 1, 0.3, 1];
const EASE_OUT = [0.0, 0.0, 0.2, 1];

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

export default function PregnancyKickCounter() {
  const { state, dispatch } = useApp();
  const reduce = useReducedMotion();

  const date = todayKey();
  const count = state.pregnancy.kickCounts?.[date] || 0;
  const reachedMilestone = count >= MILESTONE_COUNT;

  function handleTap() {
    tap();
    dispatch({ type: 'INC_KICK_COUNT', date });
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE_EXPO }}>
      <p className="section-title">Kick counter</p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--sp-5)',
          background: 'var(--clr-surface)',
          border: '1px solid var(--clr-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--sp-6)',
        }}
      >
        <div
          aria-live="polite"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
        >
          <p
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--clr-ink-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 'var(--sp-2)',
            }}
          >
            Today&rsquo;s kicks
          </p>
          <motion.span
            key={count}
            initial={reduce ? false : { opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22, ease: EASE_EXPO }}
            style={{
              display: 'inline-block',
              fontSize: 'var(--text-4xl)',
              fontWeight: 700,
              lineHeight: 1,
              color: 'var(--clr-brand)',
            }}
          >
            {count}
          </motion.span>
        </div>

        <motion.button
          type="button"
          onClick={handleTap}
          aria-label="Log a kick"
          className="kick-counter__btn"
          whileTap={reduce ? undefined : { scale: 0.97 }}
          transition={{ duration: 0.15, ease: EASE_OUT }}
          style={{
            width: '100%',
            minHeight: 96,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--sp-2)',
            padding: 'var(--sp-6)',
            border: 'none',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--clr-brand)',
            color: 'white',
            boxShadow: 'var(--shadow-brand)',
            cursor: 'pointer',
          }}
        >
          <span aria-hidden="true" style={{ display: 'flex' }}><IconFootprints size={24} /></span>
          <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Log a kick</span>
        </motion.button>

        {reachedMilestone && (
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: EASE_OUT }}
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--clr-ink-muted)',
              textAlign: 'center',
              lineHeight: 'var(--leading-snug)',
              textWrap: 'pretty',
            }}
          >
            Ten kicks logged today — a reassuring pattern of movement.
          </motion.p>
        )}
      </div>

      {/* Scoped :active feedback — mirrors the codebase's scale(0.97) tactile
          convention (see .panic-btn:active). A plain CSS transition here
          means the app's global prefers-reduced-motion rule (which collapses
          all transition-durations to ~0) applies automatically. */}
      <style>{`
        .kick-counter__btn { transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out); }
        .kick-counter__btn:active { transform: scale(0.97); box-shadow: none; }
      `}</style>
    </motion.div>
  );
}
