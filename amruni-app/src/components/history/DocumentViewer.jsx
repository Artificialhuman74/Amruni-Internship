import { useEffect, useId, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { DOC_KIND_BY_ID, groupDocuments } from '../../data/history';
import { IconAttachment, IconLab, IconPrescription, IconScan, IconReport, IconHospital } from '../../icons.jsx';

/**
 * Her documents, grouped by kind, each one a row that opens in place.
 *
 * Opened in place rather than in a new tab because a doctor reading a chart
 * mid-consultation loses the patient every time the screen changes. "Open full
 * screen" is there for a scan that needs zooming — a choice, not the default.
 *
 * The file itself is fetched only when a row is opened. Documents are stored
 * as whole encrypted data URLs; loading eight scans to draw a list would be
 * slow, and would decrypt eight files nobody asked to see.
 */

const KIND_ICON = {
  prescription: IconPrescription, lab: IconLab, scan: IconScan,
  discharge: IconHospital, report: IconReport, other: IconAttachment,
};

function fmt(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function DocumentLibrary({ documents, load, onRemove, canRemove, emptyText }) {
  const groups = groupDocuments(documents);
  if (!documents.length) return <p className="dl-empty">{emptyText}</p>;
  return (
    <div className="dl">
      {groups.map((g) => (
        <section key={g.id} className="dl-group" aria-label={g.label}>
          <p className="dl-group__title">
            {g.label} <span>{g.items.length}</span>
          </p>
          <div className="dl-group__items">
            {g.items.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                load={load}
                onRemove={canRemove?.(doc) ? onRemove : null}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DocumentRow({ doc, load, onRemove }) {
  const reduce = useReducedMotion();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ status: 'idle', url: null, type: null });

  // Starts loading from the click, not from an effect watching `open`, so the
  // loading state is set by the event that caused it.
  function toggle() {
    if (!open && (state.status === 'idle' || state.status === 'error')) setState({ status: 'loading', url: null, type: null });
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (state.status !== 'loading') return undefined;
    let cancelled = false;
    let objectUrl = null;
    load(doc)
      .then(async (full) => {
        const blob = await (await fetch(full.data)).blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setState({ status: 'ready', url: objectUrl, type: blob.type });
      })
      .catch(() => { if (!cancelled) setState({ status: 'error', url: null, type: null }); });
    return () => { cancelled = true; };
  }, [state.status, load, doc]);

  // Revoke on unmount so decrypted files do not linger as live blob URLs.
  useEffect(() => () => { if (state.url) URL.revokeObjectURL(state.url); }, [state.url]);

  const Icon = KIND_ICON[doc.kind] || IconAttachment;
  const kind = DOC_KIND_BY_ID[doc.kind]?.one ?? 'Document';
  const by = doc.uploadedBy === 'patient' ? 'Added by patient' : doc.doctorName ? `Added by ${doc.doctorName}` : 'Added by a doctor';

  return (
    <div className={`dl-row${open ? ' dl-row--open' : ''}`}>
      <button
        type="button"
        className="dl-row__head"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className={`dl-row__icon dl-row__icon--${doc.kind}`} aria-hidden="true"><Icon size={18} /></span>
        <span className="dl-row__text">
          <span className="dl-row__title">{doc.title}</span>
          <span className="dl-row__meta">{kind} · {fmt(doc.createdAt)} · {by}</span>
        </span>
        <svg className="dl-row__chev" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            className="dl-row__panel"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="dl-row__body">
              {state.status === 'loading' && <div className="dl-viewer dl-viewer--loading" aria-label="Loading document"><span /></div>}
              {state.status === 'error' && <p className="dl-row__error">This document could not be opened.</p>}
              {state.status === 'ready' && state.type.startsWith('image/') && (
                <a href={state.url} target="_blank" rel="noreferrer" className="dl-viewer dl-viewer--image" aria-label={`Open ${doc.title} full size`}>
                  <img src={state.url} alt={doc.title} />
                </a>
              )}
              {state.status === 'ready' && state.type === 'application/pdf' && (
                <iframe className="dl-viewer dl-viewer--pdf" src={state.url} title={doc.title} />
              )}
              <div className="dl-row__actions">
                {state.status === 'ready' && (
                  <a href={state.url} target="_blank" rel="noreferrer" className="dl-row__action">Open full screen</a>
                )}
                {onRemove && (
                  <button type="button" className="dl-row__action dl-row__action--danger" onClick={() => onRemove(doc)}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
