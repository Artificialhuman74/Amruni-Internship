import { useId } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { HISTORY_CATEGORIES, SHARE_MODES, DOC_KIND_BY_ID, countsFor } from '../../data/history';
import { tap } from '../../lib/haptics';

/**
 * What she shares with the doctor she is booking. Three choices, and the
 * doctor is told which one she made.
 *
 * Nothing is preselected on a first booking. "Share everything" as a default
 * would be consent she scrolled past, and this is the one question in the
 * booking flow whose answer a doctor will act on. Her last choice is offered
 * next time — remembering a decision is not the same as making it for her.
 *
 * `counts` shows what each section actually holds ("2 conditions"), so she is
 * choosing about her own records, not an abstract list of headings.
 */
export default function ShareChooser({ value, onChange, history, doctorName }) {
  const reduce = useReducedMotion();
  const groupId = useId();
  const counts = countsFor(history);
  const docs = history?.documents ?? [];

  function setMode(mode) {
    tap();
    onChange({
      mode,
      categories: mode === 'selected' ? (value?.categories?.length ? value.categories : []) : [],
      documentIds: mode === 'selected' ? (value?.documentIds ?? []) : [],
    });
  }

  function toggleCategory(id) {
    tap();
    const cats = value.categories.includes(id) ? value.categories.filter((c) => c !== id) : [...value.categories, id];
    onChange({ ...value, categories: cats, documentIds: cats.includes('documents') ? [] : value.documentIds });
  }

  function toggleDoc(id) {
    tap();
    const ids = value.documentIds.includes(id) ? value.documentIds.filter((d) => d !== id) : [...value.documentIds, id];
    onChange({ ...value, documentIds: ids });
  }

  const who = doctorName || 'Your doctor';
  const consequence = {
    all: `${who} sees your full health record before and during the consultation.`,
    selected: `${who} sees only what you tick, and is told you shared part of your history — so they know to ask you about the rest.`,
    none: `${who} is told you chose not to share your history, and will ask you what they need during the consultation.`,
  };

  return (
    <fieldset className="share">
      <legend className="share__legend">Your health history</legend>
      <p className="share__intro">Choose what {who.startsWith('Dr') ? who : 'this practitioner'} can see. You can change this later.</p>

      <div className="share__modes" role="radiogroup" aria-labelledby={groupId}>
        <span id={groupId} hidden>Sharing choice</span>
        {['all', 'selected', 'none'].map((mode) => {
          const on = value?.mode === mode;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={on}
              className={`share-mode share-mode--${mode}${on ? ' share-mode--on' : ''}`}
              onClick={() => setMode(mode)}
            >
              <span className="share-mode__dot" aria-hidden="true"><span /></span>
              <span className="share-mode__label">{SHARE_MODES[mode].label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false} mode="wait">
        {value?.mode && (
          <motion.p
            key={value.mode}
            className="share__consequence"
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {consequence[value.mode]}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {value?.mode === 'selected' && (
          <motion.div
            className="share__pick"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="share__list">
              {HISTORY_CATEGORIES.map((c) => {
                const on = value.categories.includes(c.id);
                const n = counts[c.id];
                return (
                  <label key={c.id} className={`share-cat${on ? ' share-cat--on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleCategory(c.id)} />
                    <span className="share-cat__box" aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                    <span className="share-cat__text">
                      <span className="share-cat__label">{c.patient}</span>
                      <span className="share-cat__hint">{n ? `${n} on your record` : c.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Individual documents, for when a whole folder is too much —
                the thyroid prescription but not the scan. */}
            {!value.categories.includes('documents') && docs.length > 0 && (
              <div className="share__docs">
                <p className="share__docs-title">Or share single documents</p>
                {docs.map((d) => {
                  const on = value.documentIds.includes(d.id);
                  return (
                    <label key={d.id} className={`share-cat share-cat--doc${on ? ' share-cat--on' : ''}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleDoc(d.id)} />
                      <span className="share-cat__box" aria-hidden="true">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                      <span className="share-cat__text">
                        <span className="share-cat__label">{d.title}</span>
                        <span className="share-cat__hint">{DOC_KIND_BY_ID[d.kind]?.one ?? 'Document'}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </fieldset>
  );
}
