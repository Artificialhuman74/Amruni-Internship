import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { CONDITION_GROUPS, searchConditions, conditionLabel } from '../../data/conditions';
import { tap } from '../../lib/haptics';
import { IconCheck, IconClose } from '../../icons.jsx';

/**
 * Choosing what she already lives with.
 *
 * Search first, browse second. A woman who knows she has PCOS wants to type
 * three letters and be done; a woman who isn't sure what counts needs to see
 * the categories. Neither should have to scroll a list of ninety conditions.
 *
 * Search matches lay words as well as clinical ones — "sugar" finds diabetes,
 * "BP" finds blood pressure — because the person answering is not a clinician
 * and the label she recognises is rarely the one on the chart.
 */

const EXPO = [0.16, 1, 0.3, 1];

export default function ConditionPicker({ selected, onChange, autoFocus = false }) {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState('');
  const [openGroup, setOpenGroup] = useState(null);
  const inputRef = useRef(null);

  const results = useMemo(() => searchConditions(query), [query]);

  function toggle(id) {
    tap();
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div className="cp">
      <div className="cp__search">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          className="cp__input"
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search — try “thyroid”, “sugar”, “BP”"
          aria-label="Search conditions"
        />
        {query && (
          <button type="button" className="cp__clear" onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="Clear search">
            <IconClose size={15} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* What she's picked so far, always visible so it never gets lost
          behind a search she's in the middle of. */}
      {selected.length > 0 && (
        <div className="cp__selected" role="group" aria-label="Conditions you've added">
          <AnimatePresence initial={false}>
            {selected.map((id) => (
              <motion.button
                key={id}
                type="button"
                className="cp__pill"
                onClick={() => toggle(id)}
                aria-label={`Remove ${conditionLabel(id)}`}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.86 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.86 }}
                transition={{ duration: reduce ? 0.12 : 0.24, ease: EXPO }}
                layout={!reduce}
              >
                {conditionLabel(id)}
                <IconClose size={13} strokeWidth={2.4} />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      {results ? (
        results.length === 0 ? (
          <p className="cp__none">
            Nothing matched “{query}”. You can add it later, or tell your doctor directly —
            it doesn&rsquo;t have to be on this list to matter.
          </p>
        ) : (
          <div className="cp__results">
            {results.map((c) => (
              <Row key={c.id} c={c} on={selected.includes(c.id)} onToggle={() => toggle(c.id)} showGroup />
            ))}
          </div>
        )
      ) : (
        <div className="cp__groups">
          {CONDITION_GROUPS.map((g) => {
            const count = g.items.filter((c) => selected.includes(c.id)).length;
            const open = openGroup === g.id;
            return (
              <div key={g.id} className="cp__group">
                <button
                  type="button"
                  className="cp__group-head"
                  aria-expanded={open}
                  onClick={() => { tap(); setOpenGroup(open ? null : g.id); }}
                >
                  <span className="cp__group-label">{g.label}</span>
                  {count > 0 && <span className="cp__group-count">{count}</span>}
                  <svg
                    width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"
                    style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform var(--dur-base) var(--ease-expo)' }}
                  >
                    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      key="items"
                      initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                      exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: reduce ? 0.12 : 0.3, ease: EXPO }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="cp__results">
                        {g.items.map((c) => (
                          <Row key={c.id} c={c} on={selected.includes(c.id)} onToggle={() => toggle(c.id)} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ c, on, onToggle, showGroup = false }) {
  return (
    <button
      type="button"
      className={`cp__row${on ? ' cp__row--on' : ''}`}
      aria-pressed={on}
      onClick={onToggle}
    >
      <span className="cp__box" aria-hidden="true">{on && <IconCheck size={13} />}</span>
      <span className="cp__row-text">
        <span className="cp__row-label">{c.label}</span>
        {showGroup && <span className="cp__row-group">{c.groupLabel}</span>}
      </span>
    </button>
  );
}
