import { motion, useReducedMotion } from 'framer-motion';
import { tap } from '../../lib/haptics';

/**
 * The switch at the top of Track.
 *
 * One shared indicator that slides between segments rather than two states
 * that swap — the movement is what tells you the two panes are siblings in
 * one place, instead of two screens that happen to look alike. `layoutId`
 * gives framer the shared element; the spring gives it weight.
 */
export default function TrackSwitch({ value, onChange, options }) {
  const reduce = useReducedMotion();
  return (
    <div className="tsw" role="tablist" aria-label="What to track">
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={on}
            className={`tsw__seg${on ? ' tsw__seg--on' : ''}`}
            onClick={() => { if (!on) { tap(); onChange(o.id); } }}
          >
            {on && (
              <motion.span
                layoutId="tsw-indicator"
                className="tsw__ind"
                aria-hidden="true"
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 38, mass: 0.8 }}
              />
            )}
            <span className="tsw__label">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
