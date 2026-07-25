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
