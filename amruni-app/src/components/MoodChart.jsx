import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import MoodFlower from './MoodFlower';
import { BANDS } from '../lib/moodScale';
import { useBodyOverlay } from '../lib/useBodyOverlay';
import { tap } from '../lib/haptics';
import { IconClose } from '../icons.jsx';

/**
 * The mood log as a chart, full screen.
 *
 * A single line: mood is one continuous thing that rises and falls, and a line
 * shows that far better than a row of separate columns did.
 *
 * The line is continuous, but it is drawn in two weights. Between consecutive
 * logged days it is solid — that stretch is measured. Across days she didn't
 * log it is dashed and faint — that stretch is a connection between two real
 * points, not a claim about the mood in between. She gets a line she can
 * actually read, and the chart still never invents a feeling.
 *
 * Y is mood level, 1 (very unpleasant) to 7 (very pleasant), from a zero
 * baseline up to the highest level in range but never below Neutral. X is the
 * day.
 *
 * Each marker keeps the app's own mood colour — the same ramp as the blooms —
 * so the chart and the flower she picked are visibly one language. Level is
 * never carried by colour alone: the point's height, its position against a
 * labelled axis and its accessible name all state it, which is what that
 * palette's low contrast against the surface obliges.
 */

const EXPO = [0.16, 1, 0.3, 1];

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

// Level 1..7 rather than valence −3..+3: the axis reads as a scale that starts
// at the bottom, which is how she asked for it and how a bar from a baseline
// is read anyway.
const toLevel = (valence) => valence + 4;
const LEVEL_LABEL = {
  7: 'Very pleasant',
  6: 'Pleasant',
  5: 'Slightly pleasant',
  4: 'Neutral',
  3: 'Slightly unpleasant',
  2: 'Unpleasant',
  1: 'Very unpleasant',
};

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function dayNum(iso) {
  return new Date(`${iso}T00:00`).getDate();
}

/** A smooth path through the points, with the curve damped so it never
 *  overshoots past a value she actually logged. */
function linePath(pts) {
  if (pts.length === 1) return `M${pts[0].x} ${pts[0].y}`;
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const c = pts[i];
    const mx = (p.x + c.x) / 2;
    d += ` C${mx} ${p.y}, ${mx} ${c.y}, ${c.x} ${c.y}`;
  }
  return d;
}

function areaPath(pts) {
  return `${linePath(pts)} L${pts[pts.length - 1].x} 100 L${pts[0].x} 100 Z`;
}

function fullDay(iso) {
  return new Date(`${iso}T00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

function timeOf(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export default function MoodChart({ open, onClose, logs }) {
  const reduce = useReducedMotion();
  const [range, setRange] = useState(30);
  const [selected, setSelected] = useState(null);

  useBodyOverlay(open);

  const { days, topLevel, logged } = useMemo(() => {
    const byDate = new Map();
    logs.forEach((m) => {
      if (!byDate.has(m.date)) byDate.set(m.date, []);
      byDate.get(m.date).push(m);
    });
    const out = Array.from({ length: range }, (_, i) => {
      const date = isoDaysAgo(range - 1 - i);
      const entries = byDate.get(date) ?? [];
      const day = entries.find((m) => m.scope === 'day') ?? null;
      const moments = entries.filter((m) => m.scope === 'moment');
      return { date, entries, day, moments, lead: day ?? moments[0] ?? null };
    });
    // The axis stops at the best day she actually had, so a range where
    // nothing got past "neutral" doesn't leave two thirds of the plot empty
    // pretending there was headroom.
    //
    // Floored at Neutral, though, and that floor matters: scaled purely to the
    // maximum, a week whose best day was "very unpleasant" would draw that day
    // as a full-height bar — the worst possible mood rendered as a chart-topping
    // result. Keeping neutral on the axis means a low stretch always reads low.
    const max = out.reduce((hi, d) => (d.lead ? Math.max(hi, toLevel(d.lead.valence)) : hi), 0);
    return {
      days: out,
      topLevel: Math.max(max, 4),
      logged: out.filter((d) => d.entries.length).length,
    };
  }, [logs, range]);

  // Ticks from the baseline to the top of the data, thinned out on tall scales
  // so the labels never collide on a phone.
  const ticks = useMemo(() => {
    const all = Array.from({ length: topLevel }, (_, i) => topLevel - i);
    return all.length > 5 ? all.filter((l) => l === topLevel || l === 1 || l % 2 === (topLevel % 2)) : all;
  }, [topLevel]);

  // X position of a day, in percent. Half-step insets keep the first and last
  // markers fully inside the plot instead of half-clipped at the edges.
  const xAt = (i) => (days.length <= 1 ? 50 : ((i + 0.5) / days.length) * 100);
  const yAt = (level) => 100 - (level / topLevel) * 100;

  // Runs of consecutive logged days. The line breaks at a gap rather than
  // spanning it — joining across a week she didn't log would draw a mood she
  // never recorded, which is the one thing a chart of her own feelings must
  // not invent.
  // Every logged point, in order, tagged with the day it belongs to.
  const points = useMemo(
    () => days
      .map((d, i) => (d.lead ? { i, x: xAt(i), y: yAt(toLevel(d.lead.valence)) } : null))
      .filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days, topLevel],
  );

  // The line is drawn twice, and the split is the honest part.
  //
  // `runs` are stretches of consecutive logged days — that line is measured,
  // and it is solid. `bridges` span days she didn't log; the mood between them
  // is unknown, so those pieces are drawn dashed and faint. She gets a
  // continuous line to read, and the chart still never claims a feeling she
  // never recorded.
  const { runs, bridges } = useMemo(() => {
    const r = [];
    const b = [];
    let run = [];
    points.forEach((p, k) => {
      if (k === 0) { run = [p]; return; }
      const prev = points[k - 1];
      if (p.i - prev.i === 1) {
        run.push(p);
      } else {
        if (run.length) r.push(run);
        b.push([prev, p]);
        run = [p];
      }
    });
    if (run.length) r.push(run);
    return { runs: r, bridges: b };
  }, [points]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="mc"
          role="dialog"
          aria-modal="true"
          aria-label="Your moods over time"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: reduce ? 0.18 : 0.4, ease: EXPO }}
        >
          <header className="mc__bar">
            <div>
              <h2 className="mc__title">Your moods</h2>
              <p className="mc__sub">{logged} of the last {range} days logged</p>
            </div>
            <button type="button" className="mc__circle" onClick={onClose} aria-label="Close the chart">
              <IconClose size={17} strokeWidth={2} />
            </button>
          </header>

          {/* Filters in one row above the plot. */}
          <div className="mc__ranges" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                className={`mc__range${range === r.days ? ' mc__range--on' : ''}`}
                aria-pressed={range === r.days}
                onClick={() => { tap(); setRange(r.days); setSelected(null); }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="mc__plotwrap">
            {/* Y axis — mood, labelled, so level never rests on colour. */}
            <div className="mc__yaxis" aria-hidden="true">
              {ticks.map((level) => (
                <span key={level} className="mc__ytick" style={{ bottom: `${(level / topLevel) * 100}%` }}>
                  {LEVEL_LABEL[level]}
                </span>
              ))}
              <span className="mc__ytick mc__ytick--zero" style={{ bottom: 0 }}>0</span>
            </div>

            <div className="mc__plot">
              {/* Recessive gridlines. */}
              <div className="mc__grid" aria-hidden="true">
                {ticks.map((level) => (
                  <span key={level} className="mc__gridline" style={{ bottom: `${(level / topLevel) * 100}%` }} />
                ))}
              </div>

              {/* The line.
                  Drawn in SVG on a 0–100 viewBox in both axes with
                  preserveAspectRatio="none", so it stretches to whatever box
                  the phone gives it without any measuring in JS.
                  Vector strokes stay hairline-crisp under that stretch; the
                  markers are drawn as separate absolutely-positioned dots
                  precisely because circles would be squashed into ellipses
                  by the same non-uniform scale. */}
              <svg
                className="mc__svg"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="mc-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--clr-brand)" stopOpacity="0.20" />
                    <stop offset="100%" stopColor="var(--clr-brand)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* The wash under the whole shape, so the chart reads as one
                    continuous thing even where the line is inferred. */}
                {points.length > 1 && (
                  <motion.path
                    d={areaPath(points)}
                    fill="url(#mc-fill)"
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: reduce ? 0 : 0.5, ease: EXPO }}
                  />
                )}

                {/* Bridges: dashed, faint — a connection, not a measurement. */}
                {bridges.map((seg, i) => (
                  <motion.path
                    key={`b${i}`}
                    d={linePath(seg)}
                    fill="none"
                    stroke="var(--clr-brand)"
                    strokeWidth="2"
                    strokeOpacity="0.32"
                    strokeDasharray="3 4"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: reduce ? 0 : 0.6, delay: reduce ? 0 : 0.35, ease: EXPO }}
                  />
                ))}

                {/* Measured stretches: solid. */}
                {runs.filter((r) => r.length > 1).map((seg, i) => (
                  <motion.path
                    key={`r${i}`}
                    d={linePath(seg)}
                    fill="none"
                    stroke="var(--clr-brand)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: reduce ? 0 : 0.9, ease: EXPO }}
                  />
                ))}
              </svg>

              {/* One marker per logged day, in that day's own colour, and one
                  hit target per day whether logged or not. */}
              <div className="mc__points">
                {days.map((d, i) => {
                  const b = d.lead ? BANDS[String(d.lead.valence)] : null;
                  const level = d.lead ? toLevel(d.lead.valence) : 0;
                  const isSel = selected?.date === d.date;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      className={`mc__point-hit${isSel ? ' mc__point-hit--on' : ''}`}
                      disabled={!d.entries.length}
                      onClick={() => { tap(); setSelected(d); }}
                      style={{ left: `${xAt(i)}%` }}
                      aria-label={d.entries.length
                        ? `${fullDay(d.date)}: ${d.lead.word || b.label}, level ${level} of 7`
                        : `${fullDay(d.date)}: nothing logged`}
                    >
                      {d.lead && (
                        <motion.span
                          className={`mc__point${isSel ? ' mc__point--on' : ''}`}
                          style={{ background: b.core, bottom: `${(level / topLevel) * 100}%` }}
                          initial={reduce ? false : { scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: reduce ? 0 : 0.35, delay: reduce ? 0 : Math.min(i * 0.01, 0.4), ease: EXPO }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* X axis — day. Thinned so the numbers never collide. */}
          <div className="mc__xaxis" aria-hidden="true">
            {days.map((d, i) => {
              const every = range <= 7 ? 1 : range <= 30 ? 5 : 15;
              const show = i === days.length - 1 || i % every === 0;
              return <span key={d.date} className="mc__xtick">{show ? dayNum(d.date) : ''}</span>;
            })}
          </div>
          <p className="mc__axis-name">Day</p>

          {/* The selected day, read out in full. */}
          <div className="mc__detail">
            {selected ? (
              <>
                <p className="mc__detail-date">{fullDay(selected.date)}</p>
                {selected.entries.map((m) => (
                  <div key={m.id} className="mc__detail-row">
                    <MoodFlower band={m.valence} size={40} breathe={false} />
                    <div>
                      <p className="mc__detail-word">{m.word || BANDS[String(m.valence)].label}</p>
                      <p className="mc__detail-meta">
                        {m.scope === 'day' ? 'How the day felt' : timeOf(m.loggedAt)}
                        {m.source === 'journal' ? ' · from a journal entry' : ''}
                      </p>
                      {m.factors?.length > 0 && (
                        <div className="mc__detail-factors">
                          {m.factors.map((f) => (
                            <span key={f} className="chip chip--sm" style={{ cursor: 'default' }}>{f}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p className="mc__detail-hint">Tap any day to see what you logged.</p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
