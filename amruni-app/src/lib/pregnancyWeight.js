/**
 * IOM/ACOG total gestational weight gain by pre-pregnancy BMI category.
 * First-trimester gain is small and roughly flat across categories (~0.5–2kg
 * by week 13); the rest of each category's total is distributed across the
 * remaining weeks, weighted toward 2nd/3rd trimester as IOM guidance intends.
 */
const CATEGORIES = {
  underweight: { label: 'Underweight', bmiMax: 18.5, totalLowKg: 12.5, totalHighKg: 18 },
  normal: { label: 'Normal weight', bmiMax: 25, totalLowKg: 11.5, totalHighKg: 16 },
  overweight: { label: 'Overweight', bmiMax: 30, totalLowKg: 7, totalHighKg: 11.5 },
  obese: { label: 'Obese', bmiMax: Infinity, totalLowKg: 5, totalHighKg: 9 },
};

const FIRST_TRI_LOW_KG = 0.5;
const FIRST_TRI_HIGH_KG = 2;
const FIRST_TRI_WEEKS = 13;
const TERM_WEEKS = 40;

export function bmiFrom(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(weightKg, heightCm) {
  const bmi = bmiFrom(weightKg, heightCm);
  if (bmi == null) return null;
  if (bmi < CATEGORIES.underweight.bmiMax) return 'underweight';
  if (bmi < CATEGORIES.normal.bmiMax) return 'normal';
  if (bmi < CATEGORIES.overweight.bmiMax) return 'overweight';
  return 'obese';
}

export function categoryLabel(category) {
  return CATEGORIES[category]?.label ?? null;
}

/** Cumulative recommended gain range (kg) at a given week, for one category. */
export function gainCorridorAtWeek(category, week) {
  const cat = CATEGORIES[category];
  if (!cat) return null;
  const w = Math.max(0, Math.min(TERM_WEEKS, week));
  if (w <= FIRST_TRI_WEEKS) {
    const t = w / FIRST_TRI_WEEKS;
    return { low: FIRST_TRI_LOW_KG * t, high: FIRST_TRI_HIGH_KG * t };
  }
  const remLow = cat.totalLowKg - FIRST_TRI_LOW_KG;
  const remHigh = cat.totalHighKg - FIRST_TRI_HIGH_KG;
  const t = (w - FIRST_TRI_WEEKS) / (TERM_WEEKS - FIRST_TRI_WEEKS);
  return { low: FIRST_TRI_LOW_KG + remLow * t, high: FIRST_TRI_HIGH_KG + remHigh * t };
}

/** The full shaded-band series, one point per week, for charting. */
export function gainCorridorBand(category, maxWeek = TERM_WEEKS) {
  const points = [];
  for (let w = 0; w <= maxWeek; w++) {
    points.push({ week: w, ...gainCorridorAtWeek(category, w) });
  }
  return points;
}

/** Simple trailing rolling average so one heavy-meal day doesn't read as alarming. */
export function rollingAverage(weightLogs, windowSize = 3) {
  const sorted = [...weightLogs].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((entry, i) => {
    const windowStart = Math.max(0, i - windowSize + 1);
    const window = sorted.slice(windowStart, i + 1);
    const avg = window.reduce((sum, w) => sum + w.weightKg, 0) / window.length;
    return { ...entry, rollingKg: avg };
  });
}

/* ─────────────────────────────────────────────────────────────
   Weight outside pregnancy.

   The pregnancy corridor above is a clinical instrument: IOM/ACOG say how
   much a body *should* gain, by week, and being outside it is a finding worth
   raising with a doctor.

   Nothing equivalent exists for everyone else, and inventing one would be
   worse than useless — a target weight aimed at a sixteen-year-old is the
   thing this product's own brief warns about under "body image". So the
   general corridor is not a goal. It is a band drawn around where she has
   actually been: her own recent range. Staying inside it means steady, and
   steady is the only thing being asserted.
   ───────────────────────────────────────────────────────────── */

/** A weight a human being can have. Anything outside this is a typo. */
export const WEIGHT_MIN_KG = 20;
export const WEIGHT_MAX_KG = 300;

export function isPlausibleWeight(kg) {
  return typeof kg === 'number' && Number.isFinite(kg) && kg >= WEIGHT_MIN_KG && kg <= WEIGHT_MAX_KG;
}

/**
 * A gain no pregnancy produces. Used to catch a baseline that was entered
 * wrong rather than a body that did something remarkable — a "-50 kg gain" is
 * always a mistyped starting weight, and rendering it as a confident red
 * number tells a pregnant woman something alarming and false.
 */
export const GAIN_MIN_KG = -15;
export const GAIN_MAX_KG = 40;

export function isPlausibleGain(kg) {
  return typeof kg === 'number' && Number.isFinite(kg) && kg >= GAIN_MIN_KG && kg <= GAIN_MAX_KG;
}

/**
 * Her own steady range, from her own logs: the median of the recent window,
 * plus or minus a band that widens with how much she actually fluctuates.
 *
 * Median rather than mean, and a floor on the half-width, so one heavy day or
 * one dehydrated morning neither moves the centre nor pinches the band shut
 * and reports her as "out of range" for ordinary daily variation.
 */
export function personalRange(logs, { windowDays = 90, minHalfKg = 1.2 } = {}) {
  const usable = (logs ?? [])
    .filter((l) => isPlausibleWeight(l.weightKg))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (usable.length < 2) return null;

  const cutoff = new Date(Date.now() - windowDays * 86400000).toISOString().slice(0, 10);
  const recent = usable.filter((l) => l.date >= cutoff);
  const sample = recent.length >= 2 ? recent : usable.slice(-8);

  const values = sample.map((l) => l.weightKg).sort((a, b) => a - b);
  const median = values.length % 2
    ? values[(values.length - 1) / 2]
    : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;

  // Median absolute deviation: robust to the one bad reading that a standard
  // deviation would let dominate the whole band.
  const deviations = values.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  const mad = deviations.length % 2
    ? deviations[(deviations.length - 1) / 2]
    : (deviations[deviations.length / 2 - 1] + deviations[deviations.length / 2]) / 2;

  const half = Math.max(minHalfKg, mad * 1.8);
  return { low: median - half, high: median + half, median, samples: sample.length };
}

/** Which way it has been going, stated only when the run is long enough to mean it. */
export function trendOf(logs, { minPoints = 3 } = {}) {
  const usable = (logs ?? [])
    .filter((l) => isPlausibleWeight(l.weightKg))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8);
  if (usable.length < minPoints) return { id: 'new', label: 'Getting started' };

  const first = usable[0].weightKg;
  const last = usable[usable.length - 1].weightKg;
  const delta = last - first;
  // Under a kilo across the window is noise — clothes, water, time of day.
  if (Math.abs(delta) < 1) return { id: 'steady', label: 'Steady', deltaKg: delta };
  return delta > 0
    ? { id: 'rising', label: 'Gently rising', deltaKg: delta }
    : { id: 'falling', label: 'Gently falling', deltaKg: delta };
}
