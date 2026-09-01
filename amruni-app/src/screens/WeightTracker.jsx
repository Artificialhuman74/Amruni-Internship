import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useApp, usePregnancyData } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import BottomSheet from '../components/ui/BottomSheet';
import WeightCorridor from '../components/pregnancy/WeightCorridor';
import {
  bmiFrom, bmiCategory, categoryLabel,
  trendOf, isPlausibleWeight, isPlausibleGain,
  pregnancyWeightView, personalWeightView,
} from '../lib/pregnancyWeight';
import { tap, confirm as confirmHaptic } from '../lib/haptics';
import { IconWeight } from '../icons.jsx';

/**
 * Weight, for everyone.
 *
 * Two readings of the same data, and the difference is not cosmetic:
 *
 *   · In pregnancy the corridor is the IOM/ACOG range — a real clinical
 *     target, where being outside it is worth raising with a doctor.
 *   · Outside pregnancy there is no target, because handing a woman a goal
 *     weight is exactly what a product whose brief names body image should
 *     not do. The band is drawn around where she has actually been, and the
 *     only claim it makes is "steady".
 *
 * The screen says which of those two it is doing, in her words, every time.
 */

const EXPO = [0.16, 1, 0.3, 1];

function todayStr() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function shortDate(iso) {
  return new Date(`${iso}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function WeightTracker() {
  const { state, dispatch } = useApp();
  const preg = usePregnancyData(state);
  const toast = useToast();
  const reduce = useReducedMotion();

  const pregnancyMode = Boolean(state.settings?.pregnancyMode) && preg.known;
  const { prePregnancyWeightKg, heightCm } = state.pregnancy;
  const logs = state.pregnancy.weightLogs ?? [];

  const [logOpen, setLogOpen] = useState(false);
  const [entry, setEntry] = useState('');
  const [baselineOpen, setBaselineOpen] = useState(false);
  const [baseW, setBaseW] = useState(prePregnancyWeightKg ? String(prePregnancyWeightKg) : '');
  const [baseH, setBaseH] = useState(heightCm ? String(heightCm) : '');

  const clean = useMemo(
    () => logs.filter((l) => isPlausibleWeight(l.weightKg)).sort((a, b) => a.date.localeCompare(b.date)),
    [logs],
  );
  const latest = clean[clean.length - 1] ?? null;

  // ── Pregnancy: gain against the clinical corridor ──
  const category = prePregnancyWeightKg && heightCm ? bmiCategory(prePregnancyWeightKg, heightCm) : null;
  const gain = latest && prePregnancyWeightKg ? latest.weightKg - prePregnancyWeightKg : null;
  // A baseline typed wrong produces an impossible gain. Saying so is far more
  // useful than rendering "-50 kg" in confident red to a pregnant woman.
  const gainSuspect = gain != null && !isPlausibleGain(gain);

  const pregView = useMemo(() => {
    if (!pregnancyMode || !category || !prePregnancyWeightKg) return null;
    return pregnancyWeightView(clean, { prePregnancyWeightKg, heightCm, currentWeek: preg.weeks });
  }, [pregnancyMode, category, prePregnancyWeightKg, heightCm, clean, preg.weeks]);

  // ── Everyone else: her own range, no target ──
  const trend = useMemo(() => trendOf(clean), [clean]);

  const personalView = useMemo(() => {
    if (pregnancyMode) return null;
    return personalWeightView(clean, shortDate);
  }, [pregnancyMode, clean]);

  const view = pregnancyMode ? pregView : personalView;

  function saveLog() {
    const kg = parseFloat(entry);
    if (!isPlausibleWeight(kg)) {
      toast('That doesn’t look like a weight in kilograms.', { icon: 'warning' });
      return;
    }
    const date = todayStr();
    dispatch({ type: 'LOG_PREGNANCY_WEIGHT', date, weightKg: Math.round(kg * 10) / 10 });
    confirmHaptic();
    setEntry('');
    setLogOpen(false);
    toast('Weight logged', { icon: 'check' });
  }

  function saveBaseline() {
    const w = parseFloat(baseW);
    const h = parseFloat(baseH);
    if (!isPlausibleWeight(w) || !(h >= 100 && h <= 220)) {
      toast('Check those numbers — weight in kg, height in cm.', { icon: 'warning' });
      return;
    }
    dispatch({ type: 'SET_PREGNANCY', payload: { prePregnancyWeightKg: w, heightCm: h } });
    confirmHaptic();
    setBaselineOpen(false);
    toast('Saved', { icon: 'check' });
  }

  return (
    <div className="wt">
      {/* What this screen is measuring against — stated, not assumed. */}
      <motion.header
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EXPO }}
      >
        <p className="wt__lede">
          {pregnancyMode
            ? `Against the range recommended for your pre-pregnancy BMI${category ? ` (${categoryLabel(category)?.toLowerCase()})` : ''}.`
            : 'Against your own recent range. There is no target here — the band is simply where you have been.'}
        </p>
      </motion.header>

      {gainSuspect && (
        <button type="button" className="wt__flag" onClick={() => { tap(); setBaselineOpen(true); }}>
          <span className="wt__flag-title">That works out to {gain > 0 ? '+' : ''}{gain.toFixed(1)} kg</span>
          <span className="wt__flag-body">
            Which isn’t possible in a pregnancy, so the starting weight is probably wrong.
            Tap to check it.
          </span>
        </button>
      )}

      {view ? (
        <WeightCorridor
          band={view.band}
          points={view.points}
          domain={view.domain}
          nowX={view.nowX}
          unit="kg"
        />
      ) : (
        <div className="wt__empty">
          <span className="wt__empty-mark" aria-hidden="true"><IconWeight size={36} /></span>
          <p className="wt__empty-title">
            {pregnancyMode && !prePregnancyWeightKg ? 'Add your starting point first' : 'Nothing logged yet'}
          </p>
          <p className="wt__empty-body">
            {pregnancyMode && !prePregnancyWeightKg
              ? 'Add your pre-pregnancy weight and height first, so the range can be the right one for you.'
              : 'Log your weight whenever suits you — weekly is plenty. Nothing here expects a daily number.'}
          </p>
        </div>
      )}

      {!pregnancyMode && clean.length >= 3 && (
        <p className="wt__trend">
          <strong>{trend.label}</strong>
          {trend.deltaKg != null && Math.abs(trend.deltaKg) >= 1
            ? ` — ${trend.deltaKg > 0 ? 'up' : 'down'} ${Math.abs(trend.deltaKg).toFixed(1)} kg across your last few readings.`
            : ' across your last few readings.'}
        </p>
      )}

      <div className="wt__actions">
        <button className="btn btn--primary" onClick={() => { tap(); setLogOpen(true); }}>
          Log your weight
        </button>
        {pregnancyMode && (
          <button className="btn btn--ghost" onClick={() => { tap(); setBaselineOpen(true); }}>
            {prePregnancyWeightKg ? 'Edit your starting weight' : 'Add your starting weight'}
          </button>
        )}
      </div>

      <BottomSheet open={logOpen} onClose={() => setLogOpen(false)} title="Log your weight">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div className="input-group">
            <label className="input-label" htmlFor="wt-kg">Weight today (kg)</label>
            <input
              id="wt-kg" className="input-field" type="number" inputMode="decimal"
              step="0.1" min="20" max="300" value={entry} placeholder="e.g. 62.5"
              onChange={(e) => setEntry(e.target.value)}
            />
          </div>
          <button className="btn btn--primary" onClick={saveLog} disabled={!entry.trim()}>Save</button>
        </div>
      </BottomSheet>

      <BottomSheet open={baselineOpen} onClose={() => setBaselineOpen(false)} title="Your starting point">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-base)', textWrap: 'pretty' }}>
            Your weight before pregnancy and your height. These set which recommended
            range applies to you — they are not a target.
          </p>
          <div className="input-group">
            <label className="input-label" htmlFor="wt-base">Pre-pregnancy weight (kg)</label>
            <input id="wt-base" className="input-field" type="number" inputMode="decimal" step="0.1"
              value={baseW} onChange={(e) => setBaseW(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="wt-h">Height (cm)</label>
            <input id="wt-h" className="input-field" type="number" inputMode="numeric"
              value={baseH} onChange={(e) => setBaseH(e.target.value)} />
          </div>
          {isPlausibleWeight(parseFloat(baseW)) && parseFloat(baseH) >= 100 && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)' }}>
              BMI {bmiFrom(parseFloat(baseW), parseFloat(baseH)).toFixed(1)} ·{' '}
              {categoryLabel(bmiCategory(parseFloat(baseW), parseFloat(baseH)))}
            </p>
          )}
          <button className="btn btn--primary" onClick={saveBaseline}>Save</button>
        </div>
      </BottomSheet>
    </div>
  );
}
