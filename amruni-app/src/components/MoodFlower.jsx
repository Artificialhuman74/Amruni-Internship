import { useEffect, useId } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { bloomPathAt, visualAt, clampBand } from '../lib/moodScale';

/**
 * The mood bloom.
 *
 * Four concentric layers of one polar curve (see lib/moodScale), each more
 * opaque than the one outside it, giving the petals-within-petals depth of the
 * reference.
 *
 * `band` is continuous, and everything is driven from a single spring rather
 * than from per-change tweens: geometry, gradient, halo and stroke all read the
 * same motion value, so dragging the slider moves one object with weight
 * instead of starting a queue of half-second animations that arrive after her
 * thumb has left.
 */

const SPRING = { stiffness: 240, damping: 28, mass: 0.9 };

// Outermost first. The rings stay in phase — petal nested directly inside
// petal — which is what makes the form read as one flower gaining intensity
// toward its heart rather than as stacked shapes. Rotating them apart turns
// the silhouette into a pinwheel and the depth is lost.
const LAYERS = [
  { s: 1.0, o: 0.22, stroke: 0.55 },
  { s: 0.80, o: 0.38, stroke: 0.5 },
  { s: 0.60, o: 0.64, stroke: 0.4 },
  { s: 0.40, o: 1.0, stroke: 0.0 },
];

/** One ring. Its own hook, so the shared spring drives four paths cleanly. */
function Petal({ value, layer, fill }) {
  const d = useTransform(value, (v) => bloomPathAt(v, layer.s));
  const stroke = useTransform(value, (v) => visualAt(v).edge);
  return (
    <motion.path
      d={d}
      fill={fill}
      fillOpacity={layer.o}
      stroke={stroke}
      strokeOpacity={layer.stroke}
      strokeWidth="1.1"
    />
  );
}

export default function MoodFlower({ band = 0, size = 260, breathe = true }) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const target = clampBand(band);

  const raw = useMotionValue(target);
  const springed = useSpring(raw, SPRING);
  // Reduced motion still gets every shape, just without the travel between them.
  const value = reduce ? raw : springed;

  useEffect(() => { raw.set(target); }, [target, raw]);

  const edge = useTransform(value, (v) => visualAt(v).edge);
  const core = useTransform(value, (v) => visualAt(v).core);
  const wash2 = useTransform(value, (v) => visualAt(v).wash2);

  return (
    <svg
      width={size}
      height={size}
      viewBox="-120 -120 240 240"
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <radialGradient id={`g-${uid}`} cx="50%" cy="46%" r="62%">
          <motion.stop offset="0%" stopColor={edge} />
          <motion.stop offset="58%" stopColor={core} />
          <motion.stop offset="100%" stopColor={core} />
        </radialGradient>
        <filter id={`glow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      {/* Ambient halo — the bloom sits in its own light rather than on a flat field. */}
      <motion.ellipse
        cx="0" cy="6" rx="82" ry="78"
        filter={`url(#glow-${uid})`}
        fill={edge}
        opacity={0.4}
      />

      <motion.g
        animate={reduce || !breathe ? { scale: 1 } : { scale: [1, 1.035, 1] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '0px 0px' }}
      >
        {LAYERS.map((L, i) => (
          <Petal key={i} value={value} layer={L} fill={`url(#g-${uid})`} />
        ))}

        {/* The heart — a tiny bright bud, the one place the bloom reads as a flower
            rather than a field of colour. */}
        <motion.circle cx="0" cy="0" r="4.4" fill={wash2} opacity={0.95} />
      </motion.g>
    </svg>
  );
}
