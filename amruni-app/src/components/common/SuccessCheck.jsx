import { motion, useReducedMotion } from 'framer-motion';

/*
  A checkmark that draws itself: the ring sweeps in, then the tick strokes on,
  with a single soft bloom ring expanding behind it. Calm, not celebratory —
  tuned for a health app where confirmation should reassure, not cheer.

  Reduced motion: rests at the final drawn state instantly, bloom suppressed.
*/
export default function SuccessCheck({ size = 64, stroke = 'var(--clr-success)', bloom = true }) {
  const reduce = useReducedMotion();

  const ring = reduce
    ? { hidden: { pathLength: 1 }, show: { pathLength: 1 } }
    : {
        hidden: { pathLength: 0 },
        show: { pathLength: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
      };

  const tick = reduce
    ? { hidden: { pathLength: 1, opacity: 1 }, show: { pathLength: 1, opacity: 1 } }
    : {
        hidden: { pathLength: 0, opacity: 0 },
        show: {
          pathLength: 1,
          opacity: 1,
          transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1], delay: 0.34 },
        },
      };

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: size,
        height: size,
      }}
    >
      {bloom && !reduce && (
        <motion.span
          aria-hidden="true"
          initial={{ scale: 0.3, opacity: 0.45 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: stroke,
            opacity: 0.18,
          }}
        />
      )}
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 52 52"
        fill="none"
        role="img"
        aria-label="Success"
        initial="hidden"
        animate="show"
        style={{ position: 'relative' }}
      >
        <motion.circle
          cx="26"
          cy="26"
          r="23"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
          variants={ring}
          style={{ transformOrigin: 'center', rotate: -90 }}
        />
        <motion.path
          d="M16 27.5l6.5 6.5L37 19"
          stroke={stroke}
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          variants={tick}
        />
      </motion.svg>
    </span>
  );
}
