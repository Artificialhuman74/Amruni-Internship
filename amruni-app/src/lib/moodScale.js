/**
 * The mood scale.
 *
 * The seven named states, the polar curve that draws each of them, and the
 * arithmetic for standing anywhere between two of them. Kept apart from the
 * component that renders it because these are also the numbers the chart, the
 * journal and the check-in read — a shared vocabulary, not a detail of one
 * SVG.
 *
 * The curve:
 *
 *     r(θ) = R · ( 1 − amp + amp · ((1 + cos nθ) / 2)^k )
 *
 *   n   petal count
 *   amp lobe depth — how far the valleys cut in
 *   k   petal character. k > 1 pinches each peak into a spike (a cold, sharp
 *       star); k < 1 fattens it into a rounded petal (an open, warm bloom).
 *
 * `band` is continuous anywhere in −3…3, and the seven named states are only
 * its anchors. Between them the bloom is built petal by petal rather than as
 * one waveform — see radiiFor, which is where the petal count changes without
 * anything jumping.
 */

const STEPS = 168;
const R = 96;
export const MIN_BAND = -3;
export const MAX_BAND = 3;

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

const COLOUR_KEYS = ['core', 'btn', 'edge', 'ink', 'wash', 'wash2'];

// One quarter turn, so a petal points straight up.
//
// The curve is built from cos(nθ), which puts its first peak at θ = 0 —
// pointing right. Five petals arranged from there sit at 0°, 72°, 144°… and
// the flower has no axis of symmetry anywhere near vertical, which the eye
// reads as a bloom knocked off its stem. Rotated so a peak leads at the top,
// every band becomes mirror-symmetric about the vertical: r(θ) is even in θ,
// so the petals either side of the top one match exactly.
const ROT = -Math.PI / 2;

const TH = new Float64Array(STEPS + 1);
const COS = new Float64Array(STEPS + 1);
const SIN = new Float64Array(STEPS + 1);

for (let i = 0; i <= STEPS; i++) {
  const th = (i / STEPS) * Math.PI * 2;
  TH[i] = th;
  COS[i] = Math.cos(th + ROT);
  SIN[i] = Math.sin(th + ROT);
}

export function clampBand(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_BAND, Math.max(MIN_BAND, n));
}

/** The two anchor bands a continuous value sits between, and how far along. */
function anchors(value) {
  const v = clampBand(value);
  const lo = Math.floor(v);
  const hi = Math.min(MAX_BAND, lo + 1);
  return { lo, hi, t: v - lo };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixHex(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const ai = parseInt(a.slice(1), 16);
  const bi = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((ai >> 16) & 255, (bi >> 16) & 255, t));
  const g = Math.round(lerp((ai >> 8) & 255, (bi >> 8) & 255, t));
  const bl = Math.round(lerp(ai & 255, bi & 255, t));
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

const TWO_PI = Math.PI * 2;

/** Signed angular difference, folded into (−π, π]. */
function wrapPi(x) {
  let y = x % TWO_PI;
  if (y > Math.PI) y -= TWO_PI;
  else if (y < -Math.PI) y += TWO_PI;
  return y;
}

/**
 * Where a count's petals sit, indexed outward from the one at the top.
 *
 * Slot 0 is the top petal; ±1 are its neighbours, and so on. An even count has
 * one more petal at the very bottom, which lives in the outermost slot pair at
 * ±π — the same point, reached from either side, so the pair describes a single
 * petal. An odd count leaves that slot empty (weight 0), because an odd flower
 * has a valley at the bottom, not a petal.
 *
 * Indexing outward from the top like this is what makes every transition
 * symmetric about the vertical: whatever happens to slot +j happens to −j.
 */
function slotsFor(m, J, angles, weights) {
  const arms = Math.floor((m - 1) / 2);
  const hasBottom = m % 2 === 0;
  for (let j = -J; j <= J; j++) {
    const i = j + J;
    if (Math.abs(j) <= arms) {
      angles[i] = (TWO_PI * j) / m;
      weights[i] = 1;
    } else {
      angles[i] = Math.sign(j) * Math.PI;
      weights[i] = hasBottom && Math.abs(j) === arms + 1 ? 1 : 0;
    }
  }
}

function slotReach(m) {
  return Math.floor((m - 1) / 2) + (m % 2 === 0 ? 1 : 0);
}

/**
 * Petals as individual bumps, so a count change is a movement rather than a cut.
 *
 * Two earlier attempts at this both failed, and for opposite reasons worth
 * recording. Averaging the two neighbouring curves point by point is a beat —
 * cos(7θ) plus cos(6θ) grows thirteen lumps of alternating size, and the bloom
 * read as melting. Snapping the count to the nearest band fixed the melting and
 * bought a jerk instead: seven petals became six between one frame and the next.
 *
 * The mistake shared by both was treating the outline as one waveform. It is
 * not — it is a ring of petals, and petals are things that can move. Each is
 * given its own angle and its own height, the outline is their upper envelope,
 * and a count change becomes something the petals do to each other:
 *
 *   8 → 7   the bottom petal shrinks back into the flower
 *   7 → 6   the two lowest petals slide together and fuse into one
 *   6 → 5   the bottom petal shrinks back into the flower
 *
 * Taking the envelope rather than the sum is what keeps the merge honest: two
 * overlapping petals stay one petal tall, and the notch between them fills in
 * as they close, which is what fusing actually looks like. Summing them would
 * pile one on top of the other into a spike twice the height of the rest.
 *
 * At a named band the petals sit evenly spaced and their bumps meet exactly at
 * zero, so the envelope is identical to the closed form the seven anchors were
 * originally drawn with. Nothing about the seven states has changed.
 */
const MAX_SLOTS = 11;
const SLOT_A = new Float64Array(MAX_SLOTS);
const SLOT_B = new Float64Array(MAX_SLOTS);
const WEIGHT_A = new Float64Array(MAX_SLOTS);
const WEIGHT_B = new Float64Array(MAX_SLOTS);

let cacheKey = '';
const cacheRadii = new Float64Array(STEPS + 1);

function radiiFor(value) {
  const v = clampBand(value);
  const key = String(v);
  if (key === cacheKey) return cacheRadii;
  cacheKey = key;

  const { lo, hi, t } = anchors(v);
  const a = BANDS[String(lo)];
  const b = BANDS[String(hi)];
  const amp = lerp(a.amp, b.amp, t);
  const k = lerp(a.k, b.k, t);

  const J = Math.max(slotReach(a.n), slotReach(b.n));
  const count = 2 * J + 1;
  slotsFor(a.n, J, SLOT_A, WEIGHT_A);
  slotsFor(b.n, J, SLOT_B, WEIGHT_B);

  // Bump half-width tracks the spacing, so petals always just touch.
  const half = Math.PI / lerp(a.n, b.n, t);
  const exponent = 2 * k;

  for (let i = 0; i <= STEPS; i++) {
    let peak = 0;
    for (let sIdx = 0; sIdx < count; sIdx++) {
      const w = lerp(WEIGHT_A[sIdx], WEIGHT_B[sIdx], t);
      if (w <= 0) continue;
      const d = wrapPi(TH[i] - lerp(SLOT_A[sIdx], SLOT_B[sIdx], t));
      const u = Math.abs(d) / half;
      if (u >= 1) continue;
      const h = w * Math.pow(Math.cos(u * (Math.PI / 2)), exponent);
      if (h > peak) peak = h;
    }
    cacheRadii[i] = 1 - amp + amp * peak;
  }
  return cacheRadii;
}

/** The bloom's outline at any point on the scale. */
export function bloomPathAt(value, scale = 1) {
  const radii = radiiFor(value);
  const size = R * scale;
  let d = '';
  for (let i = 0; i <= STEPS; i++) {
    const r = radii[i] * size;
    d += `${i === 0 ? 'M' : 'L'}${(r * COS[i]).toFixed(2)} ${(r * SIN[i]).toFixed(2)}`;
  }
  return `${d}Z`;
}

/** Every colour of the field at any point on the scale. */
export function visualAt(value) {
  const { lo, hi, t } = anchors(value);
  const a = BANDS[String(lo)];
  const b = BANDS[String(hi)];
  const out = { label: BANDS[String(Math.round(clampBand(value)))].label };
  for (const key of COLOUR_KEYS) out[key] = mixHex(a[key], b[key], t);
  return out;
}

/** The named band a continuous value reads as. */
export function labelAt(value) {
  return BANDS[String(Math.round(clampBand(value)))].label;
}
