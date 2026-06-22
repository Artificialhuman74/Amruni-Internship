import { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp, useCycleData } from '../context/AppContext';
import CycleCalendar from '../components/CycleCalendar';
import BottomSheet from '../components/BottomSheet';
import { useToast } from '../components/Toast';
import { tap, confirm } from '../lib/haptics';
import { PHASE_INFO, CYCLE_SYMPTOMS } from '../data/mock';

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
  const { loggedDays, lastPeriodStart, cycleLength } = state.cycle;

  const [selectedDate, setSelectedDate] = useState(null);
  const [logSheet, setLogSheet] = useState(false);
  const [flow, setFlow] = useState('none');
  const [symptoms, setSymptoms] = useState([]);
  const [pulseId, setPulseId] = useState(null);
  const [setupSheet, setSetupSheet] = useState(!lastPeriodStart);
  const [periodInput, setPeriodInput] = useState('');
  const [cycleLenInput, setCycleLenInput] = useState(String(cycleLength));

  const today = new Date().toISOString().split('T')[0];

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

  // Days until next period
  let daysUntilPeriod = null;
  if (cycleData.predictedDays?.length) {
    const next = new Date(cycleData.predictedDays[0]);
    const now = new Date(); now.setHours(0,0,0,0);
    daysUntilPeriod = Math.round((next - now) / 86400000);
  }

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

        {/* Flo-style calendar */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}>
          <CycleCalendar
            periodDays={cycleData.periodDays}
            predictedDays={cycleData.predictedDays}
            fertileDays={cycleData.fertileDays}
            ovulationDate={cycleData.ovulationDate}
            loggedDays={loggedDays}
            selectedDate={selectedDate}
            onSelectDate={openLog}
          />
        </motion.div>

        {/* Predictions strip */}
        {lastPeriodStart && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.14 }}>
            <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
              <StatPill
                label="Next period"
                value={daysUntilPeriod !== null ? (daysUntilPeriod <= 0 ? 'Now' : `${daysUntilPeriod}d`) : '—'}
                color="var(--clr-brand)"
                bg="var(--clr-brand-soft)"
              />
              <StatPill
                label="Cycle length"
                value={`${cycleLength}d`}
                color="var(--clr-ink)"
                bg="var(--clr-surface)"
              />
              <StatPill
                label="Period length"
                value={`${state.cycle.periodLength}d`}
                color="var(--clr-ink)"
                bg="var(--clr-surface)"
              />
            </div>
          </motion.div>
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
