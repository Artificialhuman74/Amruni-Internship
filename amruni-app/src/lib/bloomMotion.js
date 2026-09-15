/**
 * Timing and geometry for the camellia bloom, from the "Camellia Bloom Login
 * Animation" design (bloom-scene.jsx and its animations runtime). Kept apart
 * from the component so the login screen can drive the same curves for the
 * flower's glide and the form's reveal.
 */

export const Easing = {
  easeOutQuad: (t) => t * (2 - t),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  easeOutBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function animate({ from = 0, to = 1, start = 0, end = 1, ease = Easing.easeInOutCubic }) {
  return (t) => {
    if (t <= start) return from;
    if (t >= end) return to;
    return from + (to - from) * ease((t - start) / (end - start));
  };
}

export const MOTION = {
  unfurl: (start, end) => animate({ from: 0, to: 1, start, end, ease: Easing.easeOutBack }),
  glide: (from, to, start, end) => animate({ from, to, start, end, ease: Easing.easeInOutCubic }),
  fade: (start, end) => animate({ from: 0, to: 1, start, end, ease: Easing.easeOutQuad }),
};

/** Rose, from the design's palette options. */
export const ROSE = {
  rings: [['#B33D58', '#EE7E86', '#FBDAD4'], ['#A2334F', '#E96C7E', '#F8C8C6'], ['#86254A', '#DC5573', '#F2ADB3']],
  deep: '#86254A',
  tip: '#EE7E86',
  shadow: '#5C1024',
};
export const GOLD = { deep: '#B8860F', mid: '#E0AC30', light: '#F6D77A' };

/** Three staggered rings of petals — outer, middle, inner. */
export const RINGS = [
  { n: 13, L: 330, w: 122, rot: 0, dur: 1.6, stag: 0.048, curl: 28 },
  { n: 10, L: 248, w: 102, rot: 15, dur: 1.5, stag: 0.05, curl: 36 },
  { n: 7, L: 158, w: 76, rot: 27, dur: 1.45, stag: 0.055, curl: 46 },
];

/** "Outward unfurl": outer ring first, the gold core last. */
export const OUTWARD = {
  delay: (ri, i) => [0.15, 0.85, 1.5][ri] + i * RINGS[ri].stag,
  curlMul: 1,
  spin: [-9, 0],
  corePop: 1.9,
};

/** The outer ring's full diameter inside the 900-unit box. */
export const FLOWER_BOX = 900;
export const FLOWER_SPAN = 660;
/** When the drawing stops changing. */
export const FLOWER_SETTLED = 3.4;

/** The design's scene cues, in seconds: Bloom → Hold → Relocate → Reveal → Rest. */
export const CUES = { Bloom: 0, Hold: 2.8, Relocate: 3.8, Reveal: 5.2, Rest: 7.1 };

/** The design is authored on a 1080 × 1920 canvas. */
export const DESIGN_W = 1080;
export const DESIGN_H = 1920;
/** Where the flower ends up as a logo, as a fraction of its full size. */
export const LOGO_SCALE = 0.135;
