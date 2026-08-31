import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { doctorApi, doctorApiError } from '../../services/doctorApi';
import { useToast } from '../../components/Toast';
import { IconLab, IconReport, IconScan, IconAttachment, IconAlert, IconClose } from '../../icons.jsx';
import { FORMS } from '../../data/intake';

const STAGE_LABEL = {
  adolescent: 'Adolescent', reproductive: 'Reproductive age',
  postpartum: 'Post-partum', menopause: 'Menopause', elderly: 'Elderly care',
};
const KIND_ICON = { lab: IconLab, report: IconReport, scan: IconScan, other: IconAttachment };

// What she chose at sign-up, in her words rather than the id it is stored as.
// Kept as a plain map so the console does not pull the whole onboarding module.
const GOAL_LABEL = {
  cycle: 'Track her cycle',
  conceive: 'Trying to conceive',
  pregnancy: 'Pregnancy',
  menopause: 'Menopause support',
  mental: 'Mental wellbeing',
  pcos: 'Managing PCOS or a condition',
  weight: 'Managing her weight',
  sleep: 'Sleep',
  body: 'Understanding her body',
  caretaker: 'Set up for a family member',
};

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(`${iso.split('T')[0]}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtShort(iso) {
  if (!iso) return '';
  return new Date(`${iso.split('T')[0]}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * One medicine, as a clinician needs to read it.
 *
 * Provenance is stated on every row rather than implied: a medicine another
 * doctor prescribed, and one she started herself, are both facts worth having
 * and are not the same fact. Unlabelled, the self-added supplement reads as
 * prescribed and the list quietly becomes untrustworthy.
 */
function MedRow({ med, past = false }) {
  const source = med.source === 'prescription'
    ? (med.doctorName ? `Prescribed by ${med.doctorName}` : 'Prescribed')
    : 'Added by the patient';
  const dates = past
    ? [med.startedOn && `from ${fmtShort(med.startedOn)}`, med.endsOn ? `to ${fmtShort(med.endsOn)}` : 'stopped'].filter(Boolean).join(' ')
    : med.startedOn && `since ${fmtShort(med.startedOn)}`;

  return (
    <div className={`med-row${past ? ' med-row--past' : ''}`}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="med-row__name">
          {med.name}
          {med.dose && <span className="med-row__dose"> {med.dose}</span>}
        </p>
        <p className="med-row__meta">
          {[med.frequency, dates].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="med-row__side">
        <span className={`med-tag med-tag--${med.source === 'prescription' ? 'rx' : 'self'}`}>{source}</span>
        {!past && med.adherence && (
          <span className="med-row__doses">{med.adherence.taken}/{med.adherence.scheduled} taken</span>
        )}
      </div>
    </div>
  );
}

export default function DoctorPatientChart() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const toast = useToast();
  const fileRef = useRef(null);

  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [expandedRecord, setExpandedRecord] = useState(null);
  const [flagInput, setFlagInput] = useState({ kind: null, value: '' }); // kind: allergy | condition
  const [docKind, setDocKind] = useState('lab');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    doctorApi.chart(userId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [userId]);

  async function saveFlags(next) {
    const prev = data.chart;
    setData({ ...data, chart: next });
    try {
      await doctorApi.updateChart(userId, {
        allergies: next.allergies, conditions: next.conditions, bloodGroup: next.bloodGroup,
      });
    } catch (err) {
      setData((d) => ({ ...d, chart: prev }));
      toast(doctorApiError(err, 'Could not update the chart.'), { icon: 'warning' });
    }
  }

  function addFlag() {
    const value = flagInput.value.trim();
    if (!value) { setFlagInput({ kind: null, value: '' }); return; }
    const key = flagInput.kind === 'allergy' ? 'allergies' : 'conditions';
    if (!data.chart[key].includes(value)) {
      saveFlags({ ...data.chart, [key]: [...data.chart[key], value] });
    }
    setFlagInput({ kind: null, value: '' });
  }

  function removeFlag(key, value) {
    saveFlags({ ...data.chart, [key]: data.chart[key].filter((v) => v !== value) });
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_500_000) {
      toast('Keep documents under 2.5 MB.', { icon: 'warning' });
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const doc = await doctorApi.uploadDocument(userId, {
          title: file.name.replace(/\.[^.]+$/, ''),
          kind: docKind,
          data: reader.result,
        });
        setData((d) => ({ ...d, documents: [doc, ...d.documents] }));
        toast('Document added to the chart', { icon: 'file' });
      } catch (err) {
        toast(doctorApiError(err, 'Upload failed.'), { icon: 'warning' });
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  }

  async function openDocument(doc) {
    try {
      const full = await doctorApi.getDocument(userId, doc.id);
      // Data URL → Blob URL so the browser's own viewer renders it safely.
      const blob = await (await fetch(full.data)).blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      toast(doctorApiError(err, 'Could not open that document.'), { icon: 'warning' });
    }
  }

  async function removeDocument(doc) {
    if (!window.confirm(`Remove “${doc.title}” from this chart?`)) return;
    try {
      await doctorApi.deleteDocument(userId, doc.id);
      setData((d) => ({ ...d, documents: d.documents.filter((x) => x.id !== doc.id) }));
    } catch (err) {
      toast(doctorApiError(err, 'Could not remove the document.'), { icon: 'warning' });
    }
  }

  if (failed) {
    return (
      <div style={{ padding: 'var(--sp-8) var(--sp-6)', textAlign: 'center' }}>
        <p style={{ fontWeight: 600, color: 'var(--clr-ink)' }}>This chart isn't available.</p>
        <button className="btn btn--secondary btn--sm" style={{ width: 'auto', margin: 'var(--sp-4) auto 0' }} onClick={() => navigate('/patients')}>
          Back to patients
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 'calc(env(safe-area-inset-top) + var(--sp-6)) var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }} aria-label="Loading chart">
        <div className="skel" style={{ height: 84 }} />
        <div className="skel" style={{ height: 120 }} />
        <div className="skel" style={{ height: 200 }} />
      </div>
    );
  }

  const {
    patient, chart, vitalsHistory, records, documents, sharedJournal = [], context,
    intakeForms = [], coverage = null,
  } = data;
  const latestVitals = vitalsHistory[vitalsHistory.length - 1] || null;
  const meds = data.medications || { current: [], past: [], adherence: null };

  return (
    <div style={{ padding: 'calc(env(safe-area-inset-top) + var(--sp-4)) var(--sp-6) var(--sp-8)' }}>
      <div className="screen-header-nav" style={{ border: 'none', padding: 0, marginBottom: 'var(--sp-4)' }}>
        <button className="nav-back-btn" onClick={() => navigate(-1)} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <span className="nav-header-title">Patient chart</span>
        <div style={{ width: 40 }} />
      </div>

      {/* Identity */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
        <span className="doc-avatar" style={{ width: 52, height: 52, fontSize: 'var(--text-base)' }} aria-hidden="true">
          {(patient.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
        </span>
        <div>
          <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-ink)' }}>{patient.name}</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', marginTop: 1 }}>
            {[patient.age != null ? `${patient.age} yrs` : null, STAGE_LABEL[patient.lifeStage], chart.bloodGroup].filter(Boolean).join(' · ') || 'Profile pending'}
          </p>
          {/* What she came for. Chosen at sign-up and, until now, stored only
              on her phone — so the one line explaining why she is here never
              reached the consultation. */}
          {patient.goal && GOAL_LABEL[patient.goal] && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', marginTop: 2 }}>
              Signed up for: {GOAL_LABEL[patient.goal]}
            </p>
          )}
        </div>
      </header>

      {/* Her situation, before anything that could be prescribed.
          Placed above the allergy chips deliberately: pregnancy and actively
          trying change what is safe more broadly than any single allergy, and
          a doctor who reads only the top of a chart should still meet it. */}
      {context && (
        <section className={`ctx-band ctx-band--${context.kind}`} aria-label="Patient situation">
          <p className="ctx-band__label">{context.label}</p>
          <p className="ctx-band__caution">{context.caution}</p>
        </section>
      )}

      {/* Who is paying, if anyone but her.
          Above the clinical sections because it changes what the doctor writes
          rather than what she prescribes: a consultation being claimed back
          needs a diagnosis recorded in terms an insurer will accept, and that
          is a decision made while writing the record, not afterwards. The
          policy number is not here and is not available to this screen. */}
      {coverage && coverage.payerType !== 'self' && (
        <section className="doc-coverage" aria-label="Insurance coverage">
          <p className="doc-coverage__label">Claiming through insurance</p>
          <p className="doc-coverage__value">
            {[coverage.insurer, coverage.planName].filter(Boolean).join(' · ')}
            {coverage.policyNumberMasked ? ` · ${coverage.policyNumberMasked}` : ''}
          </p>
          <p className="doc-coverage__note">
            Record a diagnosis on the consultation — her reimbursement claim needs one.
          </p>
        </section>
      )}

      {/* The intake form she filled in before this consultation. */}
      {intakeForms.length > 0 && (
        <section style={{ marginTop: 'var(--sp-8)' }} aria-label="Intake forms">
          <h2 className="doc-section-title">
            Intake forms
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
              {' '}— filled by the patient before consulting
            </span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {intakeForms.map((form) => (
              <IntakeCard key={form.id} form={form} />
            ))}
          </div>
        </section>
      )}

      {/* Clinical flags */}
      <section style={{ marginTop: 'var(--sp-6)' }} aria-label="Clinical flags">
        <h2 className="doc-section-title">Allergies & conditions</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', alignItems: 'center' }}>
          {chart.allergies.map((a) => (
            <span key={a} className="flag-chip flag-chip--allergy">
              <IconAlert size={14} /> {a}
              <button onClick={() => removeFlag('allergies', a)} aria-label={`Remove allergy ${a}`}><IconClose size={13} /></button>
            </span>
          ))}
          {chart.conditions.map((c) => {
            // Hers or a clinician's. "PCOS" that she reported once and "PCOS"
            // that was diagnosed are different facts, and a merged list reads
            // as though both were confirmed.
            const declared = (chart.selfDeclared || []).includes(c);
            return (
              <span key={c} className={`flag-chip flag-chip--condition${declared ? ' flag-chip--declared' : ''}`}>
                {c}
                {declared && <span className="flag-chip__src" title="Reported by the patient at sign-up">self-reported</span>}
                <button onClick={() => removeFlag('conditions', c)} aria-label={`Remove condition ${c}`}><IconClose size={13} /></button>
              </span>
            );
          })}
          {chart.allergies.length === 0 && chart.conditions.length === 0 && flagInput.kind === null && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)' }}>No known allergies or conditions recorded.</span>
          )}
        </div>
        {(chart.selfDeclared || []).length > 0 && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', marginTop: 'var(--sp-2)' }}>
            Marked entries are what she reported herself when she signed up — worth confirming
            rather than reading as diagnosed.
          </p>
        )}
        <AnimatePresence initial={false} mode="wait">
          {flagInput.kind === null ? (
            <motion.div key="btns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
              <button className="chip chip--sm" onClick={() => setFlagInput({ kind: 'allergy', value: '' })}>+ Allergy</button>
              <button className="chip chip--sm" onClick={() => setFlagInput({ kind: 'condition', value: '' })}>+ Condition</button>
            </motion.div>
          ) : (
            <motion.div key="input" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
              <input
                autoFocus
                className="input-field--sm"
                placeholder={flagInput.kind === 'allergy' ? 'e.g. Penicillin' : 'e.g. PCOS'}
                aria-label={`New ${flagInput.kind}`}
                value={flagInput.value}
                onChange={(e) => setFlagInput({ ...flagInput, value: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') addFlag(); if (e.key === 'Escape') setFlagInput({ kind: null, value: '' }); }}
              />
              <button className="btn btn--primary btn--sm" style={{ width: 'auto', flexShrink: 0 }} onClick={addFlag}>Add</button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Vitals */}
      <section style={{ marginTop: 'var(--sp-8)' }} aria-label="Vitals">
        <h2 className="doc-section-title">Vitals {latestVitals && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— last taken {fmtDate(latestVitals.date)}</span>}</h2>
        {latestVitals ? (
          <>
            <dl className="vitals-grid">
              <div className="vital-cell"><dt>BP</dt><dd>{latestVitals.bp || '—'}</dd></div>
              <div className="vital-cell"><dt>Pulse</dt><dd>{latestVitals.pulse || '—'}</dd></div>
              <div className="vital-cell"><dt>Temp °F</dt><dd>{latestVitals.temp || '—'}</dd></div>
              <div className="vital-cell"><dt>Kg</dt><dd>{latestVitals.weight || '—'}</dd></div>
            </dl>
            {vitalsHistory.length > 1 && (
              <details style={{ marginTop: 'var(--sp-3)' }}>
                <summary style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', cursor: 'pointer' }}>
                  History ({vitalsHistory.length} readings)
                </summary>
                <div style={{ marginTop: 'var(--sp-2)', fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                  {[...vitalsHistory].reverse().map((v) => (
                    <div key={v.date} style={{ display: 'flex', justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums' }}>
                      <span>{fmtDate(v.date)}</span>
                      <span>{[v.bp && `BP ${v.bp}`, v.pulse && `${v.pulse} bpm`, v.weight && `${v.weight} kg`].filter(Boolean).join(' · ')}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        ) : (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-subtle)' }}>
            Vitals recorded during consultations will build a history here.
          </p>
        )}
      </section>

      {/* Medicines.
          High in the chart, directly under vitals, because it is the section
          that changes what may safely be prescribed in the next five minutes.
          It is her whole list — other doctors' prescriptions and the tablets
          she started herself included — not this doctor's own prescribing
          history, which is already readable further down. */}
      <section style={{ marginTop: 'var(--sp-8)' }} aria-label="Medicines">
        <h2 className="doc-section-title">
          Medicines
          {meds.current.length > 0 && (
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
              {' '}— {meds.current.length} currently taken
            </span>
          )}
        </h2>

        {meds.current.length === 0 && meds.past.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-subtle)' }}>
            No medicines recorded. Anything prescribed here, or added by her, will appear on this list.
          </p>
        ) : (
          <>
            {meds.current.length === 0 && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-subtle)' }}>
                Nothing currently being taken.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {meds.current.map((m) => <MedRow key={m.id} med={m} />)}
            </div>

            {/* Doses recorded against doses due, said as two numbers rather
                than a score. A percentage invites a judgement the data can't
                support — she may have taken a tablet and not ticked it. */}
            {meds.adherence?.scheduled > 0 && (
              <p className="med-adherence">
                {meds.adherence.taken} of {meds.adherence.scheduled} doses ticked in the
                last {meds.adherence.days} days
                <span className="med-adherence__caveat"> — self-reported; ask before reading it as a missed dose</span>
              </p>
            )}

            {meds.past.length > 0 && (
              <details style={{ marginTop: 'var(--sp-3)' }}>
                <summary style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', cursor: 'pointer' }}>
                  Previously taken ({meds.past.length})
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
                  {meds.past.map((m) => <MedRow key={m.id} med={m} past />)}
                </div>
              </details>
            )}
          </>
        )}
      </section>

      {/* What the patient asked to raise. Above the record timeline on
          purpose — this is the agenda for the visit about to happen, not
          history. Only entries she flagged herself ever appear here. */}
      {sharedJournal.length > 0 && (
        <section style={{ marginTop: 'var(--sp-8)' }} aria-label="Notes the patient wants to raise">
          <h2 className="doc-section-title">
            From the patient
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
              {' '}— {sharedJournal.length} note{sharedJournal.length === 1 ? '' : 's'} she chose to share
            </span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {sharedJournal.map((entry) => (
              <article key={entry.id} className="doc-shared">
                <header className="doc-shared__head">
                  <span className="doc-shared__date">{fmtDate(entry.date)}</span>
                  {entry.mood && (
                    <span className="doc-shared__mood">
                      {entry.mood.word || `Mood ${entry.mood.valence > 0 ? '+' : ''}${entry.mood.valence}`}
                      <span className="doc-shared__scale"> ({entry.mood.valence > 0 ? '+' : ''}{entry.mood.valence} of ±3)</span>
                    </span>
                  )}
                </header>
                <p className="doc-shared__text">{entry.text}</p>
                {(entry.mood?.factors?.length > 0 || entry.context?.kind) && (
                  <p className="doc-shared__meta">
                    {[
                      entry.context?.kind === 'pregnancy' ? `Week ${entry.context.weeks}` : null,
                      entry.context?.kind === 'cycle' ? `Cycle day ${entry.context.cycleDay}` : null,
                      entry.mood?.factors?.length ? entry.mood.factors.join(', ') : null,
                    ].filter(Boolean).join(' \u00b7 ')}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Records timeline */}
      <section style={{ marginTop: 'var(--sp-8)' }} aria-label="Consultation records">
        <h2 className="doc-section-title">Consultation records</h2>
        {records.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-subtle)' }}>
            Her first consultation record will start the timeline.
          </p>
        ) : records.map((r) => {
          const open = expandedRecord === r.id;
          return (
            <div key={r.id} className="doc-record">
              <button
                onClick={() => setExpandedRecord(open ? null : r.id)}
                aria-expanded={open}
                style={{ width: '100%', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--sp-3)' }}>
                  <span className="doc-record__date">{fmtDate(r.date)} · {r.doctorName}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur-fast) var(--ease-out)' }} aria-hidden="true">▾</span>
                </div>
                <p className="doc-record__dx">{r.diagnosis || 'Consultation note'}</p>
                {!open && r.prescription.length > 0 && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-ink-muted)', marginTop: 2 }}>
                    ℞ {r.prescription.length} medicine{r.prescription.length === 1 ? '' : 's'}
                  </p>
                )}
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ paddingTop: 'var(--sp-3)' }}>
                      {r.notes && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-muted)', lineHeight: 'var(--leading-base)' }}>{r.notes}</p>}
                      {r.prescription.length > 0 && (
                        <div style={{ marginTop: 'var(--sp-3)' }}>
                          {r.prescription.map((line, i) => (
                            <div key={i} className="rx-line">
                              <span className="rx-line__name">{line.name}</span>
                              <span className="rx-line__detail">{[line.dose, line.frequency, line.duration].filter(Boolean).join(' · ')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {r.followUp && (
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-gold)', fontWeight: 600, marginTop: 'var(--sp-3)' }}>
                          Follow-up: {fmtDate(r.followUp)}
                        </p>
                      )}
                      <button
                        className="chip chip--sm"
                        style={{ marginTop: 'var(--sp-3)' }}
                        onClick={() => navigate(`/record/${r.appointmentId}`)}
                      >
                        Edit record
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </section>

      {/* Documents */}
      <section style={{ marginTop: 'var(--sp-8)' }} aria-label="Documents">
        <h2 className="doc-section-title">Documents & reports</h2>
        {documents.length === 0 && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-ink-subtle)', marginBottom: 'var(--sp-3)' }}>
            Lab reports, scans and referrals live here — attached once, available every visit.
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {documents.map((doc) => (
            <div key={doc.id} className="doc-queue-row">
              <span style={{ color: 'var(--clr-ink-muted)', display: 'flex' }} aria-hidden="true">
                {(() => { const I = KIND_ICON[doc.kind] || IconAttachment; return <I size={18} />; })()}
              </span>
              <button onClick={() => openDocument(doc)} style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--clr-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
                <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--clr-ink-subtle)' }}>{doc.kind} · {fmtDate(doc.createdAt)}</span>
              </button>
              <button onClick={() => removeDocument(doc)} aria-label={`Remove ${doc.title}`} style={{ color: 'var(--clr-ink-subtle)', padding: 'var(--sp-1)' }}><IconClose size={15} /></button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
          <select
            className="input-field--sm"
            style={{ width: 'auto' }}
            value={docKind}
            onChange={(e) => setDocKind(e.target.value)}
            aria-label="Document type"
          >
            <option value="lab">Lab result</option>
            <option value="report">Report</option>
            <option value="scan">Scan</option>
            <option value="other">Other</option>
          </select>
          <button className="btn btn--secondary btn--sm" style={{ flex: 1 }} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : '+ Attach document'}
          </button>
          <input ref={fileRef} type="file" accept="image/*,.pdf" hidden onChange={handleUpload} />
        </div>
      </section>
    </div>
  );
}

/**
 * One submitted intake form, read the way a practitioner reads a case.
 *
 * Collapsed by default and grouped by the form's own sections, because a
 * homeopathic case runs to forty answers and a chart that opens with all of
 * them buries the allergies underneath. Expanding gives the whole thing in the
 * published order — complaint, concomitants, past, family, personal, mind —
 * which is the order a repertorisation is worked up in.
 *
 * Sections the patient declined are named rather than omitted. "She skipped
 * this" and "she was never asked" are different clinical facts, and a form
 * that silently drops the difference invites the second reading of the first.
 */
function IntakeCard({ form }) {
  const [open, setOpen] = useState(false);
  const spec = FORMS[form.formId];
  if (!spec) return null;

  const answered = spec.sections.reduce(
    (n, s) => n + s.fields.filter((f) => {
      const v = form.answers[f.id];
      return Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== '';
    }).length,
    0,
  );

  return (
    <div className="doc-intake">
      <button className="doc-intake__head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <p className="doc-intake__title">{spec.label}</p>
          <p className="doc-intake__meta">
            {fmtShort(form.submittedAt)} · {answered} answers
            {form.prakriti ? ` · prakriti ${form.prakriti.label}` : ''}
            {form.skipped.length ? ` · ${form.skipped.length} section skipped` : ''}
          </p>
        </div>
        <span className={`doc-intake__chev${open ? ' is-open' : ''}`} aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="doc-intake__body">
              {form.prakriti && (
                <p className="doc-intake__prakriti">
                  Prakriti sketch: <strong>{form.prakriti.label}</strong> — vata {form.prakriti.percent.vata}%,
                  pitta {form.prakriti.percent.pitta}%, kapha {form.prakriti.percent.kapha}%
                  <span> (self-reported, {form.prakriti.answered}/{form.prakriti.total} items — confirm on examination)</span>
                </p>
              )}

              {spec.sections.map((section) => {
                if (form.skipped.includes(section.id)) {
                  return (
                    <div key={section.id} className="doc-intake__section">
                      <p className="doc-intake__section-title">{section.title}</p>
                      <p className="doc-intake__skipped">Patient chose not to answer this section.</p>
                    </div>
                  );
                }
                const rows = section.fields
                  .map((f) => [f, form.answers[f.id]])
                  .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== ''));
                if (!rows.length) return null;
                return (
                  <div key={section.id} className="doc-intake__section">
                    <p className="doc-intake__section-title">{section.title}</p>
                    {rows.map(([field, value]) => (
                      <div key={field.id} className="doc-intake__row">
                        <p className="doc-intake__q">{field.label}</p>
                        <p className="doc-intake__a">{renderAnswer(field, value)}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function renderAnswer(field, value) {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (field.kind === 'scale') return `${value} of ${field.max} — ${field.ends[1].toLowerCase()} end is ${field.max}`;
  return String(value);
}
