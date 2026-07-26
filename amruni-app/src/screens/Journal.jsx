import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { journalApi } from '../services/journalApi';
import { communityApi } from '../services/communityApi';
import { apiError } from '../services/api';
import { useToast } from '../components/Toast';
import { BANDS } from '../components/MoodFlower';
import { IconJournal } from '../icons.jsx';
import { tap } from '../lib/haptics';

/**
 * The journal index.
 *
 * Grouped by month, and every row carries a dot in the colour of the mood that
 * entry holds — so the list read top to bottom is a year of feeling, and a
 * hard stretch is visible before a single entry is opened. Writing and reading
 * both happen on their own full screens; this is the way in.
 */

const EXPO = [0.16, 1, 0.3, 1];

function monthKey(iso) {
  return iso.slice(0, 7);
}

function monthLabel(key) {
  const d = new Date(`${key}-01T00:00`);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-IN', sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' });
}

function dayLabel(iso) {
  return new Date(`${iso}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function Journal() {
  const navigate = useNavigate();
  const toast = useToast();
  const reduce = useReducedMotion();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tagLabels, setTagLabels] = useState({});

  useEffect(() => {
    let cancelled = false;
    journalApi.list()
      .then((data) => { if (!cancelled) setEntries(data ?? []); })
      .catch((err) => { if (!cancelled) toast(apiError(err, 'Could not load your journal.'), { icon: 'warning' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    communityApi.getTags()
      .then((tags) => {
        if (cancelled) return;
        const map = {};
        (tags ?? []).forEach((t) => { map[t.id] = t.label; });
        setTagLabels(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const months = useMemo(() => {
    const groups = new Map();
    entries.forEach((e) => {
      const k = monthKey(e.date);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    });
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  function write() {
    tap();
    navigate('/journal/new');
  }

  return (
    <div className="screen screen--light">
      <div className="jl">
        <motion.header
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EXPO }}
        >
          <h1 className="jl__title">My journal</h1>
          <p className="jl__sub">
            Private to you. Nothing here is shared unless you choose to share it.
          </p>
        </motion.header>

        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: EXPO }}
        >
          <button className="btn btn--primary" onClick={write}>Write an entry</button>
        </motion.div>

        {loading ? (
          <div className="jl__list" aria-busy="true" aria-label="Loading your journal">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="jl__skeleton"
                animate={reduce ? undefined : { opacity: [0.5, 0.9, 0.5] }}
                transition={reduce ? undefined : { duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.08 }}
                aria-hidden="true"
              />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <motion.div
            className="jl__empty"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1, ease: EXPO }}
          >
            <span className="jl__empty-mark" aria-hidden="true"><IconJournal size={40} /></span>
            <p className="jl__empty-title">Begin your journal</p>
            <p className="jl__empty-body">
              Write down how you&rsquo;re feeling, something you noticed, or a question for your next
              visit. Each entry keeps the mood you were in, so it still means something later.
            </p>
            <button className="btn btn--primary" onClick={write}>Write your first entry</button>
          </motion.div>
        ) : (
          months.map(([key, list], mi) => (
            <section key={key} className="jl__month">
              <h2 className="jl__month-label">{monthLabel(key)}</h2>
              <div className="jl__list">
                {list.map((entry, i) => (
                  <motion.button
                    key={entry.id}
                    type="button"
                    className="jl__row"
                    onClick={() => { tap(); navigate(`/journal/${entry.id}`); }}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.32, delay: Math.min(mi * 0.04 + i * 0.03, 0.3), ease: EXPO }}
                  >
                    {/* The ribbon: one dot per entry, in that entry's own
                        colour. Scanning the column is scanning the months. */}
                    <span
                      className={`jl__dot${entry.mood ? '' : ' jl__dot--none'}`}
                      aria-hidden="true"
                      style={entry.mood ? { background: BANDS[String(entry.mood.valence)].core } : undefined}
                    />
                    <span className="jl__row-body">
                      <span className="jl__row-head">
                        <span className="jl__row-date">{dayLabel(entry.date)}</span>
                        {entry.mood?.word && <span className="jl__row-word">{entry.mood.word}</span>}
                        {entry.bringToAppointment && <span className="jl__row-flag">For my doctor</span>}
                        {entry.sharedAsPostId && <span className="jl__row-shared">Shared</span>}
                      </span>
                      <span className="jl__row-text">{entry.text}</span>
                      {entry.tags?.length > 0 && (
                        <span className="jl__row-tags">
                          {entry.tags.map((t) => (
                            <span key={t} className="chip chip--sm" style={{ cursor: 'inherit' }}>
                              {tagLabels[t] ?? t}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </motion.button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
