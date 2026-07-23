import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { doctorApi, doctorApiError } from '../../services/doctorApi';
import SuccessCheck from '../../components/SuccessCheck';
import { confirm as confirmHaptic } from '../../lib/haptics';

const EMPTY_LINE = { name: '', dose: '', frequency: '', duration: '' };

export default function DoctorRecordEditor() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const reduced = useReducedMotion();

  const [context, setContext] = useState(null); // { appointment, patient, record }
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [vitals, setVitals] = useState({ bp: '', pulse: '', temp: '', weight: '' });
  const [rx, setRx] = useState([{ ...EMPTY_LINE }]);
  const [followUp, setFollowUp] = useState('');

  useEffect(() => {
    let cancelled = false;
    doctorApi.getRecord(appointmentId)
      .then((data) => {
        if (cancelled) return;
        setContext(data);
        if (data.record) {
          setDiagnosis(data.record.diagnosis || '');
          setNotes(data.record.notes || '');
          setVitals({ bp: '', pulse: '', temp: '', weight: '', ...data.record.vitals });
          setRx(data.record.prescription.length ? data.record.prescription : [{ ...EMPTY_LINE }]);
          setFollowUp(data.record.followUp || '');
        }
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [appointmentId]);

  function setRxLine(i, patch) {
    setRx((prev) => prev.map((line, idx) => (idx === i ? { ...line, ...patch } : line)));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await doctorApi.saveRecord(appointmentId, {
        diagnosis: diagnosis.trim() || null,
        notes: notes.trim() || null,
        vitals,
        prescription: rx,
        followUp: followUp || null,
      });
      confirmHaptic();
      setSaved(true);
      setTimeout(() => navigate(-1), 1500);
    } catch (err) {
      setError(doctorApiError(err, 'Could not save the record.'));
      setSaving(false);
    }
  }

  if (failed) {
    return (
      <div style={{ padding: 'var(--sp-8) var(--sp-6)', textAlign: 'center' }}>
        <p style={{ fontWeight: 600, color: 'var(--clr-ink)' }}>This consultation isn't available.</p>
        <button className="btn btn--secondary btn--sm" style={{ width: 'auto', margin: 'var(--sp-4) auto 0' }} onClick={() => navigate('/today')}>
          Back to Today
        </button>
      </div>
    );
  }

  if (!context) {
    return (
      <div style={{ padding: 'calc(env(safe-area-inset-top) + var(--sp-6)) var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }} aria-label="Loading consultation">
        <div className="skel" style={{ height: 64 }} />
        <div className="skel" style={{ height: 320 }} />
      </div>
    );
  }

  const { appointment, patient, record } = context;
  const rxCount = rx.filter((l) => l.name.trim()).length;

  const field = {
    padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--clr-border)', background: 'var(--clr-surface)',
    color: 'var(--clr-ink)', fontSize: 'var(--text-sm)', width: '100%',
    fontFamily: 'inherit', lineHeight: 1.5,
  };

  return (
    <div style={{ padding: 'calc(env(safe-area-inset-top) + var(--sp-4)) var(--sp-6) var(--sp-24)' }}>
      <div className="screen-header-nav" style={{ border: 'none', padding: 0, marginBottom: 'var(--sp-4)' }}>
        <button className="nav-back-btn" onClick={() => navigate(-1)} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <span className="nav-header-title">{record ? 'Edit record' : 'Consultation record'}</span>
        <div style={{ width: 40 }} />
      </div>

      {/* Consultation context */}
      <div style={{ background: 'var(--clr-surface-2)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-3) var(--sp-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <div>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)' }}>{patient.name}</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)' }}>
            {appointment.date} · {appointment.time}{appointment.reason ? ` · “${appointment.reason}”` : ''}
          </p>
        </div>
        <button className="chip chip--sm" onClick={() => navigate(`/patients/${patient.id}`)}>Chart</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', marginTop: 'var(--sp-6)' }}>
        <div className="input-group">
          <label className="input-label" htmlFor="rec-dx" style={{ fontWeight: 700, color: 'var(--clr-ink)' }}>Diagnosis</label>
          <input id="rec-dx" style={field} placeholder="e.g. Primary dysmenorrhea"
            value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="rec-notes" style={{ fontWeight: 700, color: 'var(--clr-ink)' }}>Clinical notes</label>
          <textarea id="rec-notes" rows={4} style={{ ...field, resize: 'none' }}
            placeholder="Findings, advice, red flags ruled out…"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="input-group">
          <span className="input-label" style={{ fontWeight: 700, color: 'var(--clr-ink)' }}>Vitals</span>
          <div className="vitals-grid">
            {[
              { key: 'bp', label: 'BP', placeholder: '120/80' },
              { key: 'pulse', label: 'Pulse', placeholder: '72' },
              { key: 'temp', label: 'Temp °F', placeholder: '98.6' },
              { key: 'weight', label: 'Kg', placeholder: '56' },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="vital-cell" style={{ padding: 'var(--sp-2)' }}>
                <dt style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--clr-ink-subtle)' }}>{label}</dt>
                <input
                  aria-label={label}
                  placeholder={placeholder}
                  value={vitals[key]}
                  onChange={(e) => setVitals({ ...vitals, [key]: e.target.value })}
                  style={{ width: '100%', textAlign: 'center', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="input-group">
          <span className="input-label" style={{ fontWeight: 700, color: 'var(--clr-ink)' }}>
            Prescription {rxCount > 0 && <span style={{ fontWeight: 400, color: 'var(--clr-ink-subtle)' }}>· {rxCount} medicine{rxCount === 1 ? '' : 's'}</span>}
          </span>
          <div style={{ background: 'var(--clr-surface)', border: '1.5px solid var(--clr-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)' }}>
            <AnimatePresence initial={false}>
              {rx.map((line, i) => (
                <motion.div
                  key={i}
                  className="rx-edit-row"
                  initial={reduced ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="rx-edit-row__fields">
                    <input className="input-field--sm" placeholder="Medicine" aria-label={`Medicine ${i + 1}`}
                      value={line.name} onChange={(e) => setRxLine(i, { name: e.target.value })} />
                    <input className="input-field--sm" placeholder="Dose · 500mg" aria-label={`Dose ${i + 1}`}
                      value={line.dose} onChange={(e) => setRxLine(i, { dose: e.target.value })} />
                    <input className="input-field--sm" placeholder="Frequency · twice daily" aria-label={`Frequency ${i + 1}`}
                      value={line.frequency} onChange={(e) => setRxLine(i, { frequency: e.target.value })} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                    <input className="input-field--sm" placeholder="5 days" aria-label={`Duration ${i + 1}`}
                      value={line.duration} onChange={(e) => setRxLine(i, { duration: e.target.value })} />
                    {rx.length > 1 && (
                      <button
                        onClick={() => setRx((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label={`Remove medicine ${i + 1}`}
                        style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', padding: 'var(--sp-1)' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <button
              className="chip chip--sm"
              style={{ marginTop: 'var(--sp-3)' }}
              onClick={() => setRx((prev) => [...prev, { ...EMPTY_LINE }])}
            >
              + Add medicine
            </button>
          </div>
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="rec-fu" style={{ fontWeight: 700, color: 'var(--clr-ink)' }}>Follow-up <span style={{ fontWeight: 400, color: 'var(--clr-ink-subtle)' }}>(optional)</span></label>
          <input id="rec-fu" type="date" min={new Date().toISOString().split('T')[0]} style={field}
            value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
        </div>

        {error && <p role="alert" style={{ fontSize: 'var(--text-sm)', color: 'oklch(0.55 0.18 24)' }}>{error}</p>}
      </div>

      {/* Save footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, background: 'var(--clr-surface)',
        borderTop: '1px solid var(--clr-border)',
        padding: 'var(--sp-4) var(--sp-6) calc(env(safe-area-inset-bottom) + var(--sp-4))',
        zIndex: 'var(--z-sticky)',
      }}>
        <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : record ? 'Update record' : 'Save record'}
        </button>
      </div>

      {/* The one celebration moment */}
      <AnimatePresence>
        {saved && (
          <motion.div
            className="doc-saved-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.01 : 0.25 }}
            role="status"
          >
            <SuccessCheck size={56} />
            <div>
              <p style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-ink)' }}>Record saved</p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 'var(--sp-1)' }}>
                {rxCount > 0
                  ? `${patient.name.split(' ')[0]}'s prescription is on her consultation summary.`
                  : 'Filed to the patient chart.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
