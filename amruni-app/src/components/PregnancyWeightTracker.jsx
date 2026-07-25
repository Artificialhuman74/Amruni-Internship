import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useToast } from './Toast';
import { confirm } from '../lib/haptics';
import { bmiCategory, gainCorridorAtWeek, gainCorridorBand, rollingAverage } from '../lib/pregnancyWeight';
import { IconCheck } from '../icons.jsx';

// Softened relative-to-range framing rather than clinical BMI-category labels
// (Underweight/Overweight/Obese) — this is a weight *gain* tracker, not a
// weight-loss one, and judgmental-sounding labels have no place here.
function categoryLabel(category) {
  switch (category) {
    case 'underweight':
      return 'Underweight';
    case 'overweight':
      return 'Above typical range';
    case 'obese':
      return 'Well above typical range';
    case 'normal':
    default:
      return 'Typical range';
  }
}

const FULL_TERM_WEEK = 40;
const MS_PER_DAY = 86400000;

function round1(n) {
  return Math.round(n * 10) / 10;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

const EMPTY_LOGS = [];

/* -----------------------------------------------------------------------
 * Chart: shaded target band + rolling-average line + raw entry dots.
 * Hand-rolled SVG, no charting library, following the same inline-SVG +
 * framer-motion pattern as the week-ring in screens/Pregnancy.jsx.
 * Purely decorative/supplementary — every fact it shows is also stated in
 * real text nearby, so it is aria-hidden.
 * --------------------------------------------------------------------- */

const CHART_W = 300;
const CHART_H = 170;
const PAD = { left: 30, right: 10, top: 14, bottom: 20 };

function WeightChart({ band, points, rollingPoints, currentWeek, reduceMotion }) {
  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;

  const allGains = [...band.map((b) => b.low), ...band.map((b) => b.high), ...points.map((p) => p.gain)];
  const yMax = Math.max(1, ...allGains);
  const yMin = Math.min(0, ...allGains);
  const yPad = (yMax - yMin) * 0.12 || 1;
  const yTop = yMax + yPad;
  const yBottom = yMin - yPad;

  const x = (week) => PAD.left + (Math.max(0, Math.min(week, FULL_TERM_WEEK)) / FULL_TERM_WEEK) * plotW;
  const y = (gain) => PAD.top + (1 - (gain - yBottom) / (yTop - yBottom)) * plotH;

  const topPath = band.map((b, i) => `${i === 0 ? 'M' : 'L'} ${x(b.week)} ${y(b.high)}`).join(' ');
  const bottomPath = [...band].reverse().map((b) => `L ${x(b.week)} ${y(b.low)}`).join(' ');
  const bandPath = band.length ? `${topPath} ${bottomPath} Z` : '';

  const linePath = rollingPoints.length
    ? rollingPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.week)} ${y(p.gain)}`).join(' ')
    : '';

  const zeroY = y(0);
  const cw = Math.max(0, Math.min(currentWeek, FULL_TERM_WEEK));

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      aria-hidden="true"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <line x1={PAD.left} x2={CHART_W - PAD.right} y1={zeroY} y2={zeroY} stroke="var(--clr-border)" strokeWidth="1" />

      {bandPath && (
        <path d={bandPath} fill="var(--clr-sage-soft)" stroke="var(--clr-sage)" strokeOpacity="0.25" strokeWidth="1" />
      )}

      <line
        x1={x(cw)}
        x2={x(cw)}
        y1={PAD.top}
        y2={CHART_H - PAD.bottom}
        stroke="var(--clr-ink-subtle)"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <text x={x(cw)} y={PAD.top - 4} fontSize="7" fill="var(--clr-ink-subtle)" textAnchor="middle">now</text>

      {points.map((p, i) => (
        <circle key={i} cx={x(p.week)} cy={y(p.gain)} r="2.5" fill="var(--clr-brand)" opacity="0.4" />
      ))}

      {linePath && (
        <motion.path
          d={linePath}
          fill="none"
          stroke="var(--clr-brand)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      )}

      {[0, 13, 27, 40].map((w) => (
        <text key={w} x={x(w)} y={CHART_H - 5} fontSize="8" fill="var(--clr-ink-subtle)" textAnchor="middle">
          {w}
        </text>
      ))}
      <text x={PAD.left - 4} y={zeroY + 3} fontSize="8" fill="var(--clr-ink-subtle)" textAnchor="end">0</text>
    </svg>
  );
}

/* -----------------------------------------------------------------------
 * Main component
 * --------------------------------------------------------------------- */

export default function PregnancyWeightTracker({ weeks }) {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const reduceMotion = useReducedMotion();

  const { prePregnancyWeightKg, heightCm } = state.pregnancy;
  const weightLogs = state.pregnancy.weightLogs || EMPTY_LOGS;
  const hasBaseline = Boolean(prePregnancyWeightKg && heightCm);
  const category = hasBaseline ? bmiCategory(prePregnancyWeightKg, heightCm) : null;

  const [setupWeight, setSetupWeight] = useState('');
  const [setupHeight, setSetupHeight] = useState('');
  const [logInput, setLogInput] = useState('');
  const [forceLogForm, setForceLogForm] = useState(false);

  const sortedLogs = useMemo(
    () => [...weightLogs].sort((a, b) => a.date.localeCompare(b.date)),
    [weightLogs]
  );
  const latestLog = sortedLogs[sortedLogs.length - 1] || null;

  const hasLoggedThisWeek = useMemo(() => {
    if (!latestLog) return false;
    const days = (new Date(todayStr()) - new Date(latestLog.date)) / MS_PER_DAY;
    return days < 7;
  }, [latestLog]);

  const showLogForm = !hasLoggedThisWeek || forceLogForm;

  const corridorNow = hasBaseline ? gainCorridorAtWeek(category, weeks) : null;
  // Cheap to recompute each render (band tops out at 41 points) — not worth
  // memoizing, which sidesteps a dependency-stability edge case for the
  // React Compiler's lint rule on a value derived from an imported function.
  const band = hasBaseline ? gainCorridorBand(category) : EMPTY_LOGS;
  const rolling = hasBaseline ? rollingAverage(weightLogs, 3) : EMPTY_LOGS;

  const today = useMemo(() => new Date(todayStr()), []);
  function weekForDate(dateStr) {
    const d = new Date(dateStr);
    const diffDays = (today - d) / MS_PER_DAY;
    return Math.max(0, Math.min(FULL_TERM_WEEK, weeks - diffDays / 7));
  }

  const points = hasBaseline
    ? sortedLogs.map((l) => ({ week: weekForDate(l.date), gain: round1(l.weightKg - prePregnancyWeightKg) }))
    : [];
  const rollingPoints = hasBaseline
    ? rolling.map((l) => ({ week: weekForDate(l.date), gain: round1(l.rollingKg - prePregnancyWeightKg) }))
    : [];

  const latestGain = latestLog && hasBaseline ? round1(latestLog.weightKg - prePregnancyWeightKg) : null;

  let statusLine = null;
  if (latestGain !== null && corridorNow) {
    if (latestGain < corridorNow.low) {
      statusLine = 'Below the typical range for your BMI — worth mentioning at your next visit.';
    } else if (latestGain > corridorNow.high) {
      statusLine = 'Above the typical range for your BMI — worth mentioning at your next visit.';
    } else {
      statusLine = 'Within the typical range for your BMI.';
    }
  }

  function saveBaseline() {
    const w = Number(setupWeight);
    const h = Number(setupHeight);
    if (!w || !h) return;
    dispatch({ type: 'SET_PREGNANCY', payload: { prePregnancyWeightKg: w, heightCm: h } });
    confirm();
    toast('Saved — your healthy gain range is ready', { icon: 'heart' });
    setSetupWeight('');
    setSetupHeight('');
  }

  function logWeight() {
    const w = Number(logInput);
    if (!w) return;
    dispatch({ type: 'LOG_PREGNANCY_WEIGHT', date: todayStr(), weightKg: w });
    confirm();
    toast('Weight logged', { icon: 'trend' });
    setLogInput('');
    setForceLogForm(false);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
      <p className="section-title">Weight tracking</p>
      <div
        style={{
          background: 'var(--clr-surface)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--sp-6)',
          border: '1px solid var(--clr-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-5)',
        }}
      >
        {!hasBaseline ? (
          <>
            <div>
              <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink)' }}>
                Let's set up your healthy gain range
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2, lineHeight: 'var(--leading-snug)' }}>
                Your pre-pregnancy weight and height help us show a gain range that's personal to you, not a one-size-fits-all number.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label" htmlFor="preg-weight-setup">Pre-pregnancy weight (kg)</label>
                <input
                  id="preg-weight-setup"
                  className="input-field"
                  type="number"
                  inputMode="decimal"
                  min="30"
                  max="200"
                  step="0.1"
                  placeholder="e.g. 58"
                  value={setupWeight}
                  onChange={(e) => setSetupWeight(e.target.value)}
                />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label" htmlFor="preg-height-setup">Height (cm)</label>
                <input
                  id="preg-height-setup"
                  className="input-field"
                  type="number"
                  inputMode="decimal"
                  min="120"
                  max="200"
                  step="0.1"
                  placeholder="e.g. 160"
                  value={setupHeight}
                  onChange={(e) => setSetupHeight(e.target.value)}
                />
              </div>
            </div>
            <button className="btn btn--primary" onClick={saveBaseline} disabled={!setupWeight || !setupHeight}>
              Show my healthy gain range
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 'var(--sp-5)' }}>
              <div>
                <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Gained so far
                </p>
                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--clr-brand)', marginTop: 2 }}>
                  {latestGain !== null ? `${latestGain > 0 ? '+' : ''}${latestGain} kg` : '—'}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Target at week {weeks}
                </p>
                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--clr-ink)', marginTop: 2 }}>
                  {round1(corridorNow.low)}–{round1(corridorNow.high)} kg
                </p>
              </div>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', marginTop: 'calc(-1 * var(--sp-3))' }}>
              Based on your pre-pregnancy BMI ({categoryLabel(category)}) — every body's healthy range is different.
            </p>

            <WeightChart band={band} points={points} rollingPoints={rollingPoints} currentWeek={weeks} reduceMotion={reduceMotion} />
            {points.length === 0 && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-subtle)', fontStyle: 'italic', textAlign: 'center' }}>
                Log your first weight to see your trend here.
              </p>
            )}

            {statusLine && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-snug)' }}>
                {statusLine}
              </p>
            )}

            <div style={{ borderTop: '1px solid var(--clr-border)', paddingTop: 'var(--sp-4)' }}>
              {!showLogForm ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-sage)', display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)' }}>Logged this week <IconCheck size={15} /></p>
                  <button className="btn btn--ghost btn--sm" onClick={() => setForceLogForm(true)} style={{ color: 'var(--clr-brand)' }}>
                    Log again
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  <div className="input-group">
                    <label className="input-label" htmlFor="preg-weight-log">This week's weight (kg)</label>
                    <input
                      id="preg-weight-log"
                      className="input-field"
                      type="number"
                      inputMode="decimal"
                      min="30"
                      max="200"
                      step="0.1"
                      placeholder="e.g. 61.5"
                      value={logInput}
                      onChange={(e) => setLogInput(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <button className="btn btn--primary" onClick={logWeight} disabled={!logInput}>
                    Save weight
                  </button>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', textAlign: 'center' }}>
                    Weekly check-ins give the clearest trend — no need to log daily.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
