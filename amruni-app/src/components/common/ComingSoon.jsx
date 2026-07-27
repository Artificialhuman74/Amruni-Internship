import { useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import CamelliaHero from '../../features/dashboard/CamelliaHero';
import { GOALS } from '../../utils/lifeStage'
import { IconSprout } from './Icons.jsx'

/**
 * Shown after onboarding when the chosen goal's dedicated feature isn't built
 * yet (weight, sleep, understand-my-body). Honest, warm, and gives a clear way
 * into everything that *is* ready. Reachable at /coming-soon with router state
 * { feature, icon }.
 */
export default function ComingSoon() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const feature = state?.feature || 'This';
  const ChipIcon = GOALS.find((g) => g.id === state?.goalId)?.Icon || IconSprout;

  return (
    <div className="screen screen--soft" style={{ overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--sp-8) var(--sp-6)' }}>
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <CamelliaHero size={200} variant="gold" />
        </motion.div>

        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="chip chip--sm"
          style={{ marginTop: 'var(--sp-2)', cursor: 'default', background: 'var(--clr-gold-soft)', borderColor: 'transparent', color: 'oklch(0.5 0.1 70)', fontWeight: 700 }}
        >
          <ChipIcon size={14} /> Coming soon
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
          style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 600, color: 'var(--clr-ink)', lineHeight: 'var(--leading-tight)', marginTop: 'var(--sp-4)', textWrap: 'balance' }}
        >
          {feature} is on the way.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--text-base)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-base)', maxWidth: '34ch' }}
        >
          We're building it with the same care as everything else in Amruni. Meanwhile, there's plenty here for you today.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginTop: 'var(--sp-8)', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
        >
          <button className="btn btn--primary" onClick={() => navigate('/home', { replace: true })}>
            Explore Amruni
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/track', { replace: true })} style={{ color: 'var(--clr-ink-muted)' }}>
            Start with cycle tracking
          </button>
        </motion.div>
      </div>
    </div>
  );
}
