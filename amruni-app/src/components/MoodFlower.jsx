import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * The mood bloom.
 *
 * One polar curve carries every state of mind:
 *
 *     r(θ) = R · ( 1 − amp + amp · ((1 + cos nθ) / 2)^k )
 *
 *   n   petal count
 *   amp lobe depth — how far the valleys cut in
 *   k   petal character. k > 1 pinches each peak into a spike (a cold, sharp
 *       star); k < 1 fattens it into a rounded petal (an open, warm bloom).
 *
 * Because every band samples the curve at the same resolution, all seven paths
 * share an identical command structure — so framer-motion interpolates the `d`
 * attribute directly and one shape genuinely *becomes* another. Nothing
 * cross-fades; the geometry morphs.
 *
 * Four concentric layers, each more opaque than the one outside it, give the
 * petals-within-petals depth of the reference.
 */

const STEPS = 200;
const R = 96;

export function bloomPath(n, amp, k, scale = 1, rot = 0) {
  let d = '';
  for (let i = 0; i <= STEPS; i++) {
    const th = (i / STEPS) * Math.PI * 2;
    const lobe = Math.pow((1 + Math.cos(n * th)) / 2, k);
    const r = R * scale * (1 - amp + amp * lobe);
    const a = th + rot;
    d += `${i === 0 ? 'M' : 'L'}${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  }
  return `${d}Z`;
}

/**
 * The seven states of mind. Hue runs cool→warm the way the reference does.
 *
 * Two colours per band do separate jobs, which is what lets the surface be both
 * luminous and legible: `core` feeds the bloom's gradient and stays saturated,
 * while `btn` is a deepened twin used wherever white text sits on the colour —
 * at the warm end a bloom bright enough to feel good is nowhere near 4.5:1.
 * `ink` is a heavily darkened tint of the same hue, so body copy clears AA on
 * its own wash without ever going flat grey.
 */
export const BANDS = {
  '-3': {
    label: 'Very Unpleasant', n: 8, amp: 0.42, k: 2.2,
    core: '#4A2A7A', btn: '#4A2A7A', edge: '#A88BD8', ink: '#2B1750',
    wash: '#CEC3E4', wash2: '#E6E1F1',
  },
  '-2': {
    label: 'Unpleasant', n: 8, amp: 0.32, k: 1.3,
    core: '#2A34A6', btn: '#2A34A6', edge: '#8093E4', ink: '#161F5C',
    wash: '#C6CDE9', wash2: '#E1E5F4',
  },
  '-1': {
    label: 'Slightly Unpleasant', n: 7, amp: 0.26, k: 1.05,
    core: '#4257C4', btn: '#4257C4', edge: '#9BAEEC', ink: '#212E68',
    wash: '#CFD7EE', wash2: '#E7EBF7',
  },
  '0': {
    label: 'Neutral', n: 6, amp: 0.18, k: 1.0,
    core: '#5E6E82', btn: '#5E6E82', edge: '#A9B6C4', ink: '#252E37',
    wash: '#D3D9E0', wash2: '#EAEDF1',
  },
  '1': {
    label: 'Slightly Pleasant', n: 5, amp: 0.30, k: 0.75,
    core: '#6FAF2A', btn: '#50821D', edge: '#B4D775', ink: '#28400D',
    wash: '#DBE8BE', wash2: '#EEF4DC',
  },
  '2': {
    label: 'Pleasant', n: 5, amp: 0.42, k: 0.58, core: '#DAA520', btn: '#976E09',
    edge: '#F0CB63', ink: '#433105',
    wash: '#EFE1B4', wash2: '#F8F1D8',
  },
  '3': {
    label: 'Very Pleasant', n: 5, amp: 0.52, k: 0.45,
    core: '#E87B2E', btn: '#B75B1A', edge: '#F5AC6C', ink: '#542707',
    wash: '#F6DCBB', wash2: '#FCEFDE',
  },
};

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

const EXPO = [0.16, 1, 0.3, 1];

export default function MoodFlower({ band, size = 260, breathe = true }) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const b = BANDS[String(band)] ?? BANDS['0'];

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
          <motion.stop offset="0%" animate={{ stopColor: b.edge }} transition={{ duration: 0.5 }} />
          <motion.stop offset="58%" animate={{ stopColor: b.core }} transition={{ duration: 0.5 }} />
          <motion.stop offset="100%" animate={{ stopColor: b.core }} transition={{ duration: 0.5 }} />
        </radialGradient>
        <filter id={`glow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      {/* Ambient halo — the bloom sits in its own light rather than on a flat field. */}
      <motion.ellipse
        cx="0" cy="6" rx="82" ry="78"
        filter={`url(#glow-${uid})`}
        animate={{ fill: b.edge, opacity: 0.4 }}
        transition={{ duration: 0.5 }}
      />

      <motion.g
        animate={reduce || !breathe ? { scale: 1 } : { scale: [1, 1.035, 1] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '0px 0px' }}
      >
        {LAYERS.map((L, i) => (
          <motion.path
            key={i}
            initial={false}
            animate={{
              d: bloomPath(b.n, b.amp, b.k, L.s),
              fillOpacity: L.o,
              stroke: b.edge,
              strokeOpacity: L.stroke,
            }}
            transition={{ duration: reduce ? 0 : 0.62, ease: EXPO }}
            fill={`url(#g-${uid})`}
            strokeWidth="1.1"
          />
        ))}

        {/* The heart — a tiny bright bud, the one place the bloom reads as a flower
            rather than a field of colour. */}
        <motion.circle
          cx="0" cy="0" r="4.4"
          animate={{ fill: b.wash2, opacity: 0.95 }}
          transition={{ duration: 0.5 }}
        />
      </motion.g>
    </svg>
  );
}
