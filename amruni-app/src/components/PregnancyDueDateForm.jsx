import { useState } from 'react';
import { motion } from 'framer-motion';
import { IconStethoscope, IconCycle } from '../icons.jsx';

// ACOG-ordered: a doctor-given date (usually from a dating scan) is the most
// accurate and is offered first; LMP is the fallback for someone early on who
// hasn't been scanned yet. Conception/IVF-transfer date is out of scope for v1.
const METHODS = [
  {
    id: 'doctor',
    Icon: IconStethoscope,
    title: 'My doctor already gave me a due date',
    desc: "If you've had a dating scan, use that — it's usually the most accurate.",
  },
  {
    id: 'lmp',
    Icon: IconCycle,
    title: 'First day of my last period',
    desc: "We'll estimate your due date from this if you haven't had a scan yet.",
  },
];

const TODAY = new Date().toISOString().split('T')[0];
const EARLIEST_LMP = new Date(Date.now() - 300 * 86400000).toISOString().split('T')[0];
const LATEST_DUE = new Date(Date.now() + 300 * 86400000).toISOString().split('T')[0];

export default function PregnancyDueDateForm({ defaultMethod = null, defaultDate = '', onSave, onCancel }) {
  const [method, setMethod] = useState(defaultMethod);
  const [date, setDate] = useState(defaultDate);

  function chooseMethod(id) {
    setMethod(id);
    setDate('');
  }

  function handleSave() {
    if (!date) return;
    if (method === 'doctor') onSave({ dueDateOverride: date, lastPeriodStart: null });
    else onSave({ lastPeriodStart: date, dueDateOverride: null });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`goal-tile${method === m.id ? ' goal-tile--on' : ''}`}
            onClick={() => chooseMethod(m.id)}
            aria-pressed={method === m.id}
          >
            <div className="goal-tile__icon" aria-hidden="true"><m.Icon size={22} /></div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <span className="goal-tile__title">{m.title}</span>
              <span className="goal-tile__desc">{m.desc}</span>
            </div>
            <div className={`goal-tile__check${method === m.id ? ' goal-tile__check--on' : ''}`}>
              {method === m.id && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2 6l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>

      {method && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{ overflow: 'hidden' }}
        >
          <div className="input-group">
            <label className="input-label" htmlFor="preg-date-input">
              {method === 'doctor' ? 'Due date' : 'First day of last period'}
            </label>
            <input
              id="preg-date-input"
              className="input-field"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={method === 'doctor' ? TODAY : EARLIEST_LMP}
              max={method === 'doctor' ? LATEST_DUE : TODAY}
              autoFocus
            />
          </div>
        </motion.div>
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
        {onCancel && (
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="button" className="btn btn--primary" onClick={handleSave} disabled={!method || !date}>
          Save
        </button>
      </div>
    </div>
  );
}
