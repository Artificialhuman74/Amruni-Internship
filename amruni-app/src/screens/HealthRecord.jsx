import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { historyApi } from '../services/historyApi';
import { meApi, apiError } from '../services/api';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/Toast';
import BottomSheet from '../components/BottomSheet';
import { DocumentLibrary } from '../components/history/DocumentViewer';
import HistoryRequestCard from '../components/history/HistoryRequestCard';
import { DOC_KINDS } from '../data/history';
import { IconLock, IconPlus, IconClose } from '../icons.jsx';
import { tap, confirm as confirmHaptic } from '../lib/haptics';

/**
 * My health record — everything a doctor would want to know, entered once.
 *
 * Built as one long, calm page rather than a hub of sub-screens, because the
 * question she is answering is "what would a new doctor need to know about
 * me?", and that is easiest to answer while seeing all of it at once. Each
 * section edits in place; adding something never takes her away from the rest.
 *
 * Nothing here is shared by being written. Sharing happens per booking, and
 * the line under the title says so, because a woman who believes that typing
 * "miscarriage, 2022" publishes it to every doctor will reasonably leave it out.
 */

const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];
const RELATIONS = ['Mother', 'Father', 'Sister', 'Brother', 'Grandmother', 'Grandfather', 'Aunt', 'Uncle', 'Child'];
const MAX_FILE = 2_800_000;

export default function HealthRecord() {
  const navigate = useNavigate();
  const toast = useToast();
  const { dispatch } = useApp();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState(null); // { category, item? } | { upload: true }

  const refresh = useCallback(
    () => historyApi.get().then(setData).catch(() => setFailed(true)),
    [],
  );
  useEffect(() => { refresh(); }, [refresh]);

  async function saveHealth(patch) {
    const next = { conditions: data.conditions, allergies: data.allergies, bloodGroup: data.bloodGroup, ...patch };
    const prev = data;
    setData({ ...data, ...next });
    try {
      await meApi.putHealth(next);
      dispatch({ type: 'SET_HEALTH', payload: next });
    } catch (err) {
      setData(prev);
      toast(apiError(err, 'That didn’t save. Try again.'), { icon: 'warning' });
    }
  }

  async function removeItem(item) {
    if (!window.confirm('Remove this from your health record?')) return;
    try {
      await historyApi.removeItem(item.id);
      setData((d) => ({ ...d, [item.category]: d[item.category].filter((x) => x.id !== item.id) }));
    } catch (err) {
      toast(apiError(err, 'Could not remove it.'), { icon: 'warning' });
    }
  }

  async function removeDocument(doc) {
    if (!window.confirm(`Remove “${doc.title}”?`)) return;
    try {
      await historyApi.removeDocument(doc.id);
      setData((d) => ({ ...d, documents: d.documents.filter((x) => x.id !== doc.id) }));
    } catch (err) {
      toast(apiError(err, 'Could not remove it.'), { icon: 'warning' });
    }
  }

  const loadDocument = useCallback((doc) => historyApi.getDocument(doc.id), []);

  if (failed) {
    return (
      <div className="screen screen--light">
        <p className="hr-empty" style={{ padding: 'var(--sp-10) var(--sp-6)' }}>Your health record couldn’t load. Check your connection and try again.</p>
      </div>
    );
  }

  return (
    <div className="screen screen--light">
      <div className="screen-header-nav">
        <button className="nav-back-btn" onClick={() => navigate(-1)} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <span className="nav-header-title">My health record</span>
        <div style={{ width: 40 }} />
      </div>

      <div className="hr">
        <header className="hr-intro">
          <h1 className="hr-intro__title">Everything a doctor should know, written once.</h1>
          <p className="hr-intro__body">
            <IconLock size={14} /> Encrypted before it is stored. Nothing here is shared until you choose
            to share it when you book — all of it, part of it, or none.
          </p>
        </header>

        {data?.requests?.length > 0 && (
          <section className="hr-requests" aria-label="Requests from your doctors">
            {data.requests.map((r) => (
              <HistoryRequestCard key={r.id} request={r} onDone={() => refresh()} />
            ))}
          </section>
        )}

        {!data ? (
          <div className="hr-skel" aria-label="Loading"><span /><span /><span /></div>
        ) : (
          <>
            <Section title="Health conditions" count={data.conditions.length + (data.bloodGroup ? 1 : 0)}>
              <ChipEditor
                items={data.conditions}
                placeholder="e.g. PCOS, hypothyroidism"
                empty="Conditions you live with — diagnosed or suspected."
                onChange={(conditions) => saveHealth({ conditions })}
              />
              <div className="hr-blood">
                <span className="hr-blood__label">Blood group</span>
                <div className="hr-blood__opts" role="radiogroup" aria-label="Blood group">
                  {BLOOD_GROUPS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      role="radio"
                      aria-checked={data.bloodGroup === g}
                      className={`hr-blood__opt${data.bloodGroup === g ? ' hr-blood__opt--on' : ''}`}
                      onClick={() => { tap(); saveHealth({ bloodGroup: data.bloodGroup === g ? null : g }); }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Allergies" count={data.allergies.length}>
              <ChipEditor
                items={data.allergies}
                tone="allergy"
                placeholder="e.g. Penicillin, peanuts"
                empty="Medicines, foods or anything else you react to. Say ‘none known’ by leaving this empty."
                onChange={(allergies) => saveHealth({ allergies })}
              />
            </Section>

            <Section
              title="Medicines"
              count={data.medications.current.length}
              action={<button type="button" className="hr-link" onClick={() => navigate('/medicines')}>Manage</button>}
            >
              {data.medications.current.length === 0 && data.medications.past.length === 0 ? (
                <p className="hr-empty">Nothing yet. Add what you take in <button type="button" className="hr-link" onClick={() => navigate('/medicines')}>Medicines</button> — it appears here too.</p>
              ) : (
                <ul className="hr-list">
                  {data.medications.current.map((m) => (
                    <li key={m.id} className="hr-item">
                      <span className="hr-item__main">{m.name}{m.dose ? ` · ${m.dose}` : ''}</span>
                      <span className="hr-item__sub">{[m.frequency, m.source === 'prescription' ? `Prescribed${m.doctorName ? ` by ${m.doctorName}` : ''}` : 'Added by you'].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                  {data.medications.past.length > 0 && (
                    <li className="hr-item hr-item--quiet">
                      <span className="hr-item__sub">{data.medications.past.length} taken before: {data.medications.past.map((m) => m.name).join(', ')}</span>
                    </li>
                  )}
                </ul>
              )}
            </Section>

            <ItemSection
              title="Surgeries & hospital stays"
              items={data.procedures}
              empty="Operations, admissions, deliveries — with the year, if you remember it."
              render={(i) => ({ main: i.name, sub: [i.year, i.hospital, i.notes].filter(Boolean).join(' · ') })}
              onAdd={() => setSheet({ category: 'procedures' })}
              onEdit={(item) => setSheet({ category: 'procedures', item })}
              onRemove={removeItem}
            />

            <ItemSection
              title="Family history"
              items={data.family}
              empty="Illnesses in your family — diabetes, heart disease, cancers, thyroid, mental health."
              render={(i) => ({ main: i.condition, sub: [i.relation, i.notes].filter(Boolean).join(' · ') })}
              onAdd={() => setSheet({ category: 'family' })}
              onEdit={(item) => setSheet({ category: 'family', item })}
              onRemove={removeItem}
            />

            <Section
              title="Documents"
              count={data.documents.length}
              action={
                <button type="button" className="hr-add" onClick={() => { tap(); setSheet({ upload: true }); }}>
                  <IconPlus size={15} /> Upload
                </button>
              }
            >
              <DocumentLibrary
                documents={data.documents}
                load={loadDocument}
                canRemove={(d) => d.uploadedBy === 'patient'}
                onRemove={removeDocument}
                emptyText="Photograph a prescription, or upload a lab report or scan. Opened only by the doctors you share it with."
              />
            </Section>

            <ItemSection
              title="Anything else"
              items={data.notes}
              empty="Whatever else you’d want a new doctor to know."
              render={(i) => ({ main: i.text })}
              onAdd={() => setSheet({ category: 'notes' })}
              onEdit={(item) => setSheet({ category: 'notes', item })}
              onRemove={removeItem}
            />
          </>
        )}
      </div>

      <BottomSheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        title={sheet?.upload ? 'Upload a document' : sheet?.item ? 'Edit' : { procedures: 'Add a surgery or hospital stay', family: 'Add family history', notes: 'Add a note' }[sheet?.category]}
      >
        {sheet?.upload && (
          <UploadForm
            onDone={(doc) => { setData((d) => ({ ...d, documents: [doc, ...d.documents] })); setSheet(null); }}
          />
        )}
        {sheet?.category && (
          <ItemForm
            key={sheet.item?.id ?? sheet.category}
            category={sheet.category}
            item={sheet.item}
            onDone={(saved) => {
              setData((d) => ({
                ...d,
                [saved.category]: sheet.item
                  ? d[saved.category].map((x) => (x.id === saved.id ? saved : x))
                  : [...d[saved.category], saved],
              }));
              setSheet(null);
            }}
          />
        )}
      </BottomSheet>
    </div>
  );
}

/* ── pieces ───────────────────────────────────────────────────────────── */

function Section({ title, count, action, children }) {
  return (
    <section className="hr-section" aria-label={title}>
      <div className="hr-section__head">
        <h2 className="hr-section__title">
          {title}
          {count > 0 && <span className="hr-section__count">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ItemSection({ title, items, empty, render, onAdd, onEdit, onRemove }) {
  const reduce = useReducedMotion();
  return (
    <Section
      title={title}
      count={items.length}
      action={<button type="button" className="hr-add" onClick={() => { tap(); onAdd(); }}><IconPlus size={15} /> Add</button>}
    >
      {items.length === 0 ? (
        <p className="hr-empty">{empty}</p>
      ) : (
        <ul className="hr-list">
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const r = render(item);
              return (
                <motion.li
                  key={item.id}
                  className="hr-item hr-item--editable"
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                >
                  <button type="button" className="hr-item__body" onClick={() => onEdit(item)}>
                    <span className="hr-item__main">{r.main}</span>
                    {r.sub && <span className="hr-item__sub">{r.sub}</span>}
                  </button>
                  <button type="button" className="hr-item__x" onClick={() => onRemove(item)} aria-label={`Remove ${r.main}`}>
                    <IconClose size={14} />
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </Section>
  );
}

function ChipEditor({ items, onChange, placeholder, empty, tone }) {
  const [draft, setDraft] = useState('');
  function add() {
    const v = draft.trim().replace(/\s+/g, ' ');
    if (!v) return;
    if (!items.some((i) => i.toLowerCase() === v.toLowerCase())) onChange([...items, v]);
    setDraft('');
    tap();
  }
  return (
    <div className="hr-chips">
      {items.length === 0 && <p className="hr-empty">{empty}</p>}
      {items.length > 0 && (
        <div className="hr-chips__row">
          {items.map((i) => (
            <span key={i} className={`hr-chip${tone ? ` hr-chip--${tone}` : ''}`}>
              {i}
              <button type="button" onClick={() => onChange(items.filter((x) => x !== i))} aria-label={`Remove ${i}`}>
                <IconClose size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="hr-chips__add">
        <input
          className="hr-input"
          value={draft}
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={60}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button type="button" className="hr-add hr-add--solid" onClick={add} disabled={!draft.trim()}>Add</button>
      </div>
    </div>
  );
}

function ItemForm({ category, item, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({ ...(item ?? {}) }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const fields = {
    procedures: [['name', 'What was it?', 'e.g. C-section, appendix removal', true], ['year', 'Year', 'e.g. 2021'], ['hospital', 'Hospital', 'Optional'], ['notes', 'Anything to add', 'Complications, recovery…', false, true]],
    family: [['condition', 'Condition', 'e.g. Type 2 diabetes', true], ['notes', 'Anything to add', 'Age it started, treatment…', false, true]],
    notes: [['text', 'Note', 'Whatever you want a doctor to know', true, true]],
  }[category];

  const ready = fields.filter((f) => f[3]).every((f) => (form[f[0]] || '').trim()) && (category !== 'family' || form.relation);

  async function save() {
    setBusy(true);
    const payload = Object.fromEntries(
      Object.entries(form).filter(([k]) => !['id', 'category', 'updatedAt'].includes(k)),
    );
    try {
      const saved = item
        ? await historyApi.updateItem(item.id, category, payload)
        : await historyApi.addItem(category, payload);
      confirmHaptic();
      onDone(saved);
    } catch (err) {
      toast(apiError(err, 'That didn’t save. Try again.'), { icon: 'warning' });
      setBusy(false);
    }
  }

  return (
    <div className="hr-form">
      {category === 'family' && (
        <div className="hr-field">
          <span className="hr-field__label">Who?</span>
          <div className="hr-blood__opts">
            {RELATIONS.map((r) => (
              <button
                key={r}
                type="button"
                className={`hr-blood__opt${form.relation === r ? ' hr-blood__opt--on' : ''}`}
                aria-pressed={form.relation === r}
                onClick={() => { tap(); setForm((f) => ({ ...f, relation: r })); }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
      {fields.map(([key, label, placeholder, required, long]) => (
        <label key={key} className="hr-field">
          <span className="hr-field__label">{label}{required ? '' : ' (optional)'}</span>
          {long ? (
            <textarea className="hr-input hr-input--area" rows={3} value={form[key] || ''} placeholder={placeholder} onChange={set(key)} maxLength={800} />
          ) : (
            <input className="hr-input" value={form[key] || ''} placeholder={placeholder} onChange={set(key)} maxLength={120} />
          )}
        </label>
      ))}
      <button type="button" className="btn btn--primary" onClick={save} disabled={!ready || busy}>
        {busy ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

function UploadForm({ onDone }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [kind, setKind] = useState('prescription');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  function pick(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE) { toast('Keep files under about 2.5 MB — a phone photo usually is.', { icon: 'warning' }); return; }
    if (!(f.type.startsWith('image/') || f.type === 'application/pdf')) { toast('Upload a photo or a PDF.', { icon: 'warning' }); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(f);
  }

  async function upload() {
    if (!preview) return;
    setBusy(true);
    try {
      const doc = await historyApi.uploadDocument({ title: title.trim() || 'Document', kind, data: preview });
      confirmHaptic();
      toast('Added to your health record', { icon: 'check' });
      onDone(doc);
    } catch (err) {
      toast(apiError(err, 'Upload failed. Try again.'), { icon: 'warning' });
      setBusy(false);
    }
  }

  return (
    <div className="hr-form">
      <div className="hr-field">
        <span className="hr-field__label">What is it?</span>
        <div className="hr-blood__opts">
          {DOC_KINDS.filter((k) => k.id !== 'report').map((k) => (
            <button key={k.id} type="button" aria-pressed={kind === k.id} className={`hr-blood__opt${kind === k.id ? ' hr-blood__opt--on' : ''}`} onClick={() => setKind(k.id)}>
              {k.one}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className={`hr-drop${preview ? ' hr-drop--filled' : ''}`} onClick={() => fileRef.current?.click()}>
        {preview && file?.type.startsWith('image/') ? (
          <img src={preview} alt="" />
        ) : preview ? (
          <span className="hr-drop__pdf">PDF · {file.name}</span>
        ) : (
          <>
            <span className="hr-drop__big">Take a photo or choose a file</span>
            <span className="hr-drop__small">Photo or PDF, up to about 2.5 MB</span>
          </>
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={pick} />

      <label className="hr-field">
        <span className="hr-field__label">Name</span>
        <input className="hr-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Thyroid prescription, March" maxLength={120} />
      </label>

      <button type="button" className="btn btn--primary" onClick={upload} disabled={!preview || busy}>
        {busy ? 'Encrypting and uploading…' : 'Add to my record'}
      </button>
    </div>
  );
}
