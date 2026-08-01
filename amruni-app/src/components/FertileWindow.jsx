import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { tierWeight } from '../lib/fertility';

/**
 * Six days, drawn as one thing.
 *
 * The first version of this was six bars and a legend, which is the chart a
 * spreadsheet would have drawn: it said the window is six separate quantities
 * to be compared. It isn't. It is one continuous phenomenon with a shape, and
 * the shape is the whole finding — the chance climbs from the day sperm can
 * start waiting, crests on the two days before ovulation, and then stops dead,
 * because the egg is gone within a day of arriving.
 *
 * So: a single band that opens gently and is cut off hard at the right. The
 * cliff is not a styling choice, it is the biology, and it is the one thing a
 * woman timing this needs to feel rather than read.
 *
 * Colour comes from the cycle calendar sitting one swipe away in the same tab
 * — the same teal for fertile days, the same green for ovulation. Two views of
 * the same six days in two different palettes is how an app stops feeling like
 * one app.
 */

const EXPO = [0.16, 1, 0.3, 1];
const HEADROOM = 0.86;   // leaves the crest clear of the top edge

/** Smoothing damped so the curve never rises above a day it is drawn through. */
function smooth(pts) {
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const c = pts[i];
    const mx = (p.x + c.x) / 2;
    d += ` C${mx} ${p.y}, ${mx} ${c.y}, ${c.x} ${c.y}`;
  }
  return d;
}

function heightAt(tier) {
  return tierWeight(tier) * HEADROOM;
}

function weekday(iso) {
  return new Date(`${iso}T00:00`).toLocaleDateString('en-IN', { weekday: 'short' });
}

function dayNum(iso) {
  return new Date(`${iso}T00:00`).toLocaleDateString('en-IN', { day: 'numeric' });
}

export default function FertileWindow({ days, today }) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const n = days.length;

  // Day centres, plus an edge point at each end: the band eases in from
  // nothing on the left and is sheared off vertically on the right.
  const centres = days.map((d, i) => ({
    x: ((i + 0.5) / n) * 100,
    y: 100 - heightAt(d.tier) * 100,
  }));
  const curve = [
    { x: 0, y: 100 - heightAt(days[0].tier) * 0.62 * 100 },
    ...centres,
    { x: 100, y: centres[centres.length - 1].y },
  ];
  const line = smooth(curve);
  const area = `${line} L100 100 L0 100 Z`;

  const firstPeak = days.findIndex((d) => d.tier === 'peak');
  const peakCount = days.filter((d) => d.tier === 'peak').length;
  const todayIndex = days.findIndex((d) => d.date === today);

  return (
    <figure className="ttc-win">
      {/* Naming the crest in place, with a bracket that spans exactly the days
          it refers to. This is what replaced the legend: a key underneath asks
          her to hold three colours in her head and look back up. */}
      {firstPeak >= 0 && (
        <div
          className="ttc-win__peak"
          style={{ left: `${(firstPeak / n) * 100}%`, width: `${(peakCount / n) * 100}%` }}
        >
          <span className="ttc-win__peak-label">Best days</span>
          <span className="ttc-win__peak-rule" aria-hidden="true" />
        </div>
      )}

      <div className="ttc-win__band">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`ttc-fill-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--clr-fertile-soft)" />
              <stop offset="58%" stopColor="var(--clr-fertile)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--clr-ovulation)" />
            </linearGradient>
            {/* Revealed by a moving clip rather than by animating the path, so
                the shape is never briefly a lie about her chances. */}
            <clipPath id={`ttc-wipe-${uid}`}>
              <motion.rect
                x="0" y="0" width="100" height="100"
                initial={reduce ? false : { width: 0 }}
                animate={{ width: 100 }}
                transition={{ duration: reduce ? 0 : 0.7, ease: EXPO }}
              />
            </clipPath>
          </defs>
          <g clipPath={`url(#ttc-wipe-${uid})`}>
            <path d={area} fill={`url(#ttc-fill-${uid})`} />
            <path
              d={line}
              fill="none"
              stroke="var(--clr-ovulation)"
              strokeOpacity="0.5"
              strokeWidth="1.25"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </svg>

        {/* Today: a plumb line dropped from the curve, so where she stands is
            read against the shape rather than against the axis. */}
        {todayIndex >= 0 && (
          <motion.span
            className="ttc-win__now-line"
            aria-hidden="true"
            style={{
              left: `${((todayIndex + 0.5) / n) * 100}%`,
              top: `${100 - heightAt(days[todayIndex].tier) * 100}%`,
            }}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : 0.55 }}
          />
        )}
      </div>

      <figcaption className="ttc-win__days">
        {days.map((d) => {
          const isToday = d.date === today;
          const isLast = d.tier === 'ovulation';
          return (
            <div
              key={d.date}
              className={`ttc-win__day${isToday ? ' ttc-win__day--today' : ''}${d.date < today ? ' ttc-win__day--past' : ''}`}
            >
              <span className="ttc-win__wd">{weekday(d.date)}</span>
              <span className="ttc-win__num">{dayNum(d.date)}</span>
              {/* Always rendered, always the same height. The first cut let the
                  "Today" column grow a third line, which pushed one date out of
                  line with the other five — the kind of half-millimetre that
                  makes a careful screen look automated. */}
              <span className="ttc-win__note">
                {isToday ? 'Today' : isLast ? 'Ovulation' : ''}
              </span>
            </div>
          );
        })}
      </figcaption>
    </figure>
  );
}
