import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useApp, useCycleData } from '../context/AppContext';
import { meApi } from '../services/api';
import CycleCalendar from '../components/CycleCalendar';
import BottomSheet from '../components/BottomSheet';
import { useToast } from '../components/Toast';
import { tap, confirm } from '../lib/haptics';
import { PHASE_INFO, CYCLE_SYMPTOMS } from '../data/mock';

function fmtShort(iso) {
  return new Date(`${iso}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const FLOW_LEVELS = [
  { id: 'none', label: 'None' },
  { id: 'spotting', label: 'Spotting' },
  { id: 'light', label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'heavy', label: 'Heavy' },
];

export default function CycleTracker() {
  const { state, dispatch } = useApp();
  const cycleData = useCycleData(state);
  const toast = useToast();
  const reduced = useReducedMotion();
  const navigate = useNavigate();
  const { loggedDays, lastPeriodStart, cycleLength } = state.cycle;

  const [selectedDate, setSelectedDate] = useState(null);
  const [logSheet, setLogSheet] = useState(false);
  const [flow, setFlow] = useState('none');
  const [symptoms, setSymptoms] = useState([]);
  const [pulseId, setPulseId] = useState(null);
  const [setupSheet, setSetupSheet] = useState(!lastPeriodStart);
  const [periodInput, setPeriodInput] = useState('');
  const [cycleLenInput, setCycleLenInput] = useState(String(cycleLength));

  // ML predictions from the server; null = loading, {ready:false} = cold start
  const [ml, setMl] = useState(null);
  const refetchTimer = useRef(null);

  const today = new Date().toISOString().split('T')[0];

  function fetchPredictions(retryOnNotReady = false) {
    meApi.cyclePredictions()
      .then((data) => {
        setMl(data);
        // Local state can be ahead of the server sync (e.g. right after
        // onboarding); give the flush a moment and look once more.
        if (retryOnNotReady && !data.ready) {
          clearTimeout(refetchTimer.current);
          refetchTimer.current = setTimeout(fetchPredictions, 2000);
        }
      })
      .catch(() => setMl({ ready: false, offline: true }));
  }

  useEffect(() => {
    fetchPredictions(true);
    return () => clearTimeout(refetchTimer.current);
  }, []);

  // After a log saves, the state provider syncs to the server (debounced
  // 700ms); refresh predictions once that flush has landed.
  function schedulePredictionRefresh() {
    clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(fetchPredictions, 1600);
  }

  function openLog(date) {
    setSelectedDate(date);
    const existing = loggedDays[date] || {};
    setFlow(existing.flow || 'none');
    setSymptoms(existing.symptoms || []);
    setLogSheet(true);
  }

  function saveLog() {
    dispatch({
      type: 'LOG_CYCLE_DAY',
      date: selectedDate,
      data: { flow, symptoms },
    });
    if (flow !== 'none' && !lastPeriodStart) {
      dispatch({ type: 'SET_CYCLE', payload: { lastPeriodStart: selectedDate } });
    }
    setLogSheet(false);
    confirm();
    toast(selectedDate === today ? 'Logged for today' : 'Day saved', { icon: '🌸' });
    schedulePredictionRefresh();
  }

  function toggleSymptom(id) {
    const adding = !symptoms.includes(id);
    setSymptoms(s => (adding ? [...s, id] : s.filter(x => x !== id)));
    if (adding) {
      setPulseId(id);
      tap();
    }
  }

  function saveSetup() {
    if (!periodInput) return;
    dispatch({ type: 'SET_CYCLE', payload: { lastPeriodStart: periodInput, cycleLength: parseInt(cycleLenInput) || 28 } });
    setSetupSheet(false);
  }

  const phase = cycleData.phase;
  const phaseInfo = phase ? PHASE_INFO[phase] : null;

  return (
    <div className="screen screen--light">
      <div style={{ padding: 'calc(env(safe-area-inset-top) + var(--sp-5)) var(--sp-6) var(--sp-8)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--clr-ink)' }}>Cycle tracker</h1>
            {cycleData.cycleDay && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>
                Day {cycleData.cycleDay} of your cycle
              </p>
            )}
          </div>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => openLog(today)}
            style={{ width: 'auto', flexShrink: 0 }}
          >
            + Log today
          </button>
        </motion.div>

        {/* Phase banner */}
        {phaseInfo && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.06 }}>
            <div className={`phase-banner phase-banner--${phaseInfo.class}`}>
              <div className="phase-banner__icon">{phaseInfo.icon}</div>
              <div style={{ flex: 1 }}>
                <div className="phase-banner__day">Day {cycleData.cycleDay}</div>
                <div className="phase-banner__name">{phaseInfo.name}</div>
                <div className="phase-banner__desc">{phaseInfo.desc}</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Flo-style calendar — predicted/fertile days come from the ML model
            once it's ready, falling back to local cycle math */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}>
          <CycleCalendar
            periodDays={cycleData.periodDays}
            predictedDays={ml?.ready ? ml.predictedDays : cycleData.predictedDays}
            fertileDays={ml?.ready ? ml.fertileDays : cycleData.fertileDays}
            ovulationDate={ml?.ready ? ml.ovulationDate : cycleData.ovulationDate}
            loggedDays={loggedDays}
            selectedDate={selectedDate}
            onSelectDate={openLog}
          />
        </motion.div>

        {/* Prediction card */}
        {lastPeriodStart && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.14 }}>
            {ml === null ? (
              <div className="skel" style={{ height: 108, borderRadius: 'var(--radius-xl)' }} aria-label="Loading prediction" />
            ) : ml.ready ? (
              <div style={{ background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-xl)', padding: 'var(--sp-5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--sp-3)' }}>
                  <p style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-brand)' }}>
                    {ml.nextPeriod.daysUntil <= 0
                      ? 'Period expected now'
                      : `Period in ${ml.nextPeriod.daysUntil} day${ml.nextPeriod.daysUntil === 1 ? '' : 's'}`}
                  </p>
                  <span className="chip chip--sm" style={{ cursor: 'default', borderColor: 'transparent', background: 'var(--clr-brand-soft)', color: 'var(--clr-brand)', fontWeight: 600 }}>
                    {ml.nextPeriod.confidence === 'high' ? 'High confidence' : ml.nextPeriod.confidence === 'medium' ? 'Fair confidence' : 'Early estimate'}
                  </span>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink)', marginTop: 'var(--sp-2)' }}>
                  {fmtShort(ml.nextPeriod.windowStart)} – {fmtShort(ml.nextPeriod.windowEnd)}, most likely <strong>{fmtShort(ml.nextPeriod.likely)}</strong>
                </p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 'var(--sp-2)', lineHeight: 'var(--leading-base)' }}>
                  {ml.nextPeriod.personalized
                    ? `Learned from your last ${ml.cyclesKnown} cycle${ml.cyclesKnown === 1 ? '' : 's'}${ml.regularity.label ? ` — ${ml.regularity.label} (±${ml.regularity.sd}d)` : ''}.`
                    : 'Based on your settings. Log each period and this becomes your personal pattern.'}
                </p>
              </div>
            ) : (
              <div style={{ background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-xl)', padding: 'var(--sp-4) var(--sp-5)' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)' }}>
                  {ml.offline ? 'Predictions will refresh when you are back online.' : ml.reason}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-3)' }}>
              <StatPill
                label="Cycle length"
                value={ml?.ready ? `${Math.round(ml.cycleLength.predicted)}d` : `${cycleLength}d`}
                color="var(--clr-ink)"
                bg="var(--clr-surface)"
              />
              <StatPill
                label="Period length"
                value={`${state.cycle.periodLength}d`}
                color="var(--clr-ink)"
                bg="var(--clr-surface)"
              />
              <StatPill
                label="Ovulation"
                value={ml?.ready ? fmtShort(ml.ovulationDate) : (cycleData.ovulationDate ? fmtShort(cycleData.ovulationDate) : '—')}
                color="var(--clr-ink)"
                bg="var(--clr-surface)"
              />
            </div>
          </motion.div>
        )}

        {/* Made for you — model insights */}
        {ml?.ready && ml.insights.length > 0 && (
          <div>
            <p className="section-title" style={{ marginBottom: 'var(--sp-3)' }}>Made for you</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {ml.insights.map((ins, i) => (
                <motion.div
                  key={ins.text}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i, 4) * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-start', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)' }}
                >
                  <span style={{ fontSize: 'var(--text-md)', lineHeight: 1 }} aria-hidden="true">{ins.icon}</span>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink)', lineHeight: 'var(--leading-base)' }}>{ins.text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Passive PCOS risk hint — from the cycle-only model, only when the
            pattern warrants it and PCOS isn't already flagged */}
        {ml?.ready && ml.pcosSignal && !ml.hasPcos && (
          <motion.button
            onClick={() => navigate('/pcos-check')}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: '100%', textAlign: 'left', display: 'flex', gap: 'var(--sp-3)', alignItems: 'center',
              background: 'var(--clr-brand-soft)', border: '1px solid var(--clr-brand-muted)',
              borderRadius: 'var(--radius-xl)', padding: 'var(--sp-4) var(--sp-5)', cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 24, flexShrink: 0 }} aria-hidden="true">🩺</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-brand)' }}>
                A quick PCOS self-check?
              </span>
              <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 2, lineHeight: 'var(--leading-base)' }}>
                Your cycle pattern shows some signs worth a 2-minute check. Not a diagnosis.
              </span>
            </span>
            <span style={{ color: 'var(--clr-brand)', fontSize: 'var(--text-lg)', flexShrink: 0 }} aria-hidden="true">→</span>
          </motion.button>
        )}

        {/* PCOS flagged — confirmation the tracker is adapting */}
        {ml?.ready && ml.hasPcos && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <span className="chip chip--sm" style={{ cursor: 'default', background: 'var(--clr-brand-soft)', borderColor: 'transparent', color: 'var(--clr-brand)', fontWeight: 600 }}>
              🌼 PCOS on record
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)' }}>
              Predictions are widened to match PCOS cycle variability.
            </span>
          </div>
        )}

        {/* What this phase may bring */}
        {ml?.ready && ml.symptomForecast[ml.phase]?.length > 0 && (
          <div>
            <p className="section-title" style={{ marginBottom: 'var(--sp-3)' }}>
              Likely in your {PHASE_INFO[ml.phase === 'ovulation' ? 'ovulation' : ml.phase]?.name?.toLowerCase() || 'current phase'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
              {ml.symptomForecast[ml.phase].map((s) => {
                const meta = CYCLE_SYMPTOMS.find((x) => x.id === s.id);
                if (!meta) return null;
                return (
                  <span key={s.id} className="chip chip--sm" style={{ cursor: 'default' }} title={s.fromYou ? 'From your own logs' : 'Common in this phase'}>
                    {meta.icon} {meta.label}
                    <span style={{ color: s.fromYou ? 'var(--clr-brand)' : 'var(--clr-ink-subtle)', fontWeight: 700 }}>
                      {Math.round(s.p * 100)}%
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Durable entry to the PCOS self-check (the hint above only appears
            when the pattern warrants it; this is always available) */}
        {!ml?.hasPcos && !ml?.pcosSignal && (
          <button
            onClick={() => navigate('/pcos-check')}
            style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)', color: 'var(--clr-ink-muted)', fontSize: 'var(--text-sm)', fontWeight: 600, padding: 'var(--sp-1) 0' }}
          >
            🩺 Screen for PCOS
            <span style={{ color: 'var(--clr-ink-subtle)' }} aria-hidden="true">→</span>
          </button>
        )}

        {/* Cycle history */}
        {ml?.ready && ml.history.length > 0 && (
          <div>
            <p className="section-title" style={{ marginBottom: 'var(--sp-3)' }}>Your cycles</p>
            <div style={{ background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              {ml.history.map((h, i) => {
                const delta = Math.round(h.length - ml.cycleLength.predicted);
                return (
                  <div key={h.start} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)', borderTop: i === 0 ? 'none' : '1px solid var(--clr-border)' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)' }}>
                      {fmtShort(h.start)} → {fmtShort(h.end)}
                    </span>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)', fontVariantNumeric: 'tabular-nums' }}>
                      {h.length} days
                      {delta !== 0 && (
                        <span style={{ fontWeight: 500, color: 'var(--clr-ink-subtle)', marginLeft: 6 }}>
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Setup prompt */}
        {!lastPeriodStart && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <button
              onClick={() => setSetupSheet(true)}
              style={{ width: '100%', padding: 'var(--sp-5)', background: 'var(--clr-surface)', border: '1.5px dashed var(--clr-brand-muted)', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 32 }}>📅</span>
              <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--clr-ink)' }}>Set up your cycle</p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)' }}>Add your last period date to see predictions</p>
            </button>
          </motion.div>
        )}

        {/* Symptoms from today's log */}
        {loggedDays[today]?.symptoms?.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="section-title">Logged today</p>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
              {loggedDays[today].symptoms.map(id => {
                const s = CYCLE_SYMPTOMS.find(x => x.id === id);
                return s ? (
                  <span key={id} className="chip chip--active chip--sm">{s.icon} {s.label}</span>
                ) : null;
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Log sheet */}
      <BottomSheet
        open={logSheet}
        onClose={() => setLogSheet(false)}
        title={selectedDate === today ? 'Log today' : `Log ${selectedDate}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          {/* Flow */}
          <div>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink-muted)', marginBottom: 'var(--sp-3)' }}>Flow</p>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              {FLOW_LEVELS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFlow(f.id)}
                  style={{
                    flex: 1, padding: 'var(--sp-3) var(--sp-2)',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${flow === f.id ? 'var(--clr-brand)' : 'var(--clr-border)'}`,
                    background: flow === f.id ? 'var(--clr-brand-soft)' : 'var(--clr-surface)',
                    fontSize: 'var(--text-xs)', fontWeight: 600,
                    color: flow === f.id ? 'var(--clr-brand)' : 'var(--clr-ink-muted)',
                    cursor: 'pointer', transition: 'all var(--dur-fast)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Symptoms */}
          <div>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink-muted)', marginBottom: 'var(--sp-3)' }}>Symptoms</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
              {CYCLE_SYMPTOMS.map(s => (
                <motion.button
                  key={s.id}
                  className={`chip${symptoms.includes(s.id) ? ' chip--active' : ''}`}
                  onClick={() => toggleSymptom(s.id)}
                  whileTap={{ scale: 0.92 }}
                  animate={pulseId === s.id ? { scale: [1, 1.14, 1] } : { scale: 1 }}
                  onAnimationComplete={() => pulseId === s.id && setPulseId(null)}
                  transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                >
                  {s.icon} {s.label}
                </motion.button>
              ))}
            </div>
          </div>

          <button className="btn btn--primary" onClick={saveLog}>Save log</button>
        </div>
      </BottomSheet>

      {/* Setup sheet */}
      <BottomSheet open={setupSheet} onClose={() => setSetupSheet(false)} title="Set up your cycle">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
          <div className="input-group">
            <label className="input-label" htmlFor="period-start">First day of your last period</label>
            <input id="period-start" className="input-field" type="date" value={periodInput} onChange={e => setPeriodInput(e.target.value)} max={new Date().toISOString().split('T')[0]} />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="cycle-len">Average cycle length (days)</label>
            <input id="cycle-len" className="input-field" type="number" min="21" max="45" value={cycleLenInput} onChange={e => setCycleLenInput(e.target.value)} />
          </div>
          <button className="btn btn--primary" onClick={saveSetup} disabled={!periodInput}>Save</button>
        </div>
      </BottomSheet>
    </div>
  );
}

function StatPill({ label, value, color, bg }) {
  return (
    <div style={{ flex: 1, background: bg, border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)', textAlign: 'center' }}>
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}
