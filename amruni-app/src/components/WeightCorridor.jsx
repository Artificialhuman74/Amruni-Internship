import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';

/**
 * The corridor.
 *
 * A weight chart normally makes the number the subject, and for a product
 * whose own brief names body image as an adolescent concern that is the wrong
 * subject. So the hero here is the *channel* — a healthy range drawn as a
 * physical space — and the only question the chart answers at a glance is "am
 * I inside it". The figure is present, small, and never the first thing read.
 *
 * The channel means two different things and says so:
 *   · pregnancy — the IOM/ACOG corridor, a genuine clinical target that
 *     widens with the weeks
 *   · everyone else — her own recent range. Not a goal. Nobody is given a
 *     target weight by this app.
 *
 * Drawn in a 0–100 viewBox stretched with preserveAspectRatio="none", so it
 * reflows to any phone with no measuring in JS. Strokes use vector-effect to
 * stay hairline-true under that non-uniform scale, and the dots are separate
 * absolutely-positioned elements because circles inside it would render as
 * ellipses.
 *
 * That stretch is also why her line is revealed by a clip wipe rather than by
 * animating `pathLength`. pathLength draws by leaving a stroke-dasharray on
 * the path, and a dash array measured in the unstretched 0–100 space cannot be
 * reconciled with a stroke rendered in device space by non-scaling-stroke: the
 * pattern tiles along the curve instead of covering it once, and her line
 * arrives in pieces with gaps in it. A moving clip rect makes no claim about
 * distance, so it survives any amount of non-uniform scaling.
 */

const EXPO = [0.16, 1, 0.3, 1];
const SPRING = { stiffness: 520, damping: 40, mass: 0.7 };

/** Catmull-Rom-ish smoothing, damped so the curve never overshoots a real value. */
function smoothPath(pts) {
  if (!pts.length) return '';
  // A lone point has no path to stroke, so the first-ever log used to render
  // an empty chart. A short level segment through it reads as "here you are,
  // and the line starts here" instead of as nothing.
  if (pts.length === 1) {
    const { x, y } = pts[0];
    return `M${Math.max(0, x - 9)} ${y} L${Math.min(100, x + 9)} ${y}`;
  }
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const c = pts[i];
    const mx = (p.x + c.x) / 2;
    d += ` C${mx} ${p.y}, ${mx} ${c.y}, ${c.x} ${c.y}`;
  }
  return d;
}

export default function WeightCorridor({
  band = [],        // [{ x, low, high }] in domain units
  points = [],      // [{ x, value, label, sublabel }]
  domain,           // { xMin, xMax, yMin, yMax }
  nowX = null,      // the "today" marker, in domain units
  unit = 'kg',
  height = 210,
}) {
  const reduce = useReducedMotion();
  const plotRef = useRef(null);
  // SVG ids are document-global; two corridors on one page would otherwise
  // share a gradient and a clip path, and the second would drive the first.
  const uid = useId().replace(/:/g, '');
  const [scrubIndex, setScrubIndex] = useState(null);
  const [scrubbing, setScrubbing] = useState(false);

  // The readout rides a spring so dragging feels like moving something with
  // weight rather than teleporting a cursor between samples.
  const scrubX = useMotionValue(0);
  const smoothX = useSpring(scrubX, reduce ? { duration: 0 } : SPRING);
  // Derived at the top level: a hook cannot live inside the conditional that
  // renders the hairline.
  const hairLeft = useTransform(smoothX, (v) => `${v}%`);

  const { xMin, xMax, yMin, yMax } = domain;
  const spanX = Math.max(1e-6, xMax - xMin);
  const spanY = Math.max(1e-6, yMax - yMin);

  const toX = useCallback((v) => ((v - xMin) / spanX) * 100, [xMin, spanX]);
  const toY = useCallback((v) => 100 - ((v - yMin) / spanY) * 100, [yMin, spanY]);

  const bandPath = useMemo(() => {
    if (band.length < 2) return '';
    const top = band.map((b) => ({ x: toX(b.x), y: toY(b.high) }));
    const bottom = [...band].reverse().map((b) => ({ x: toX(b.x), y: toY(b.low) }));
    return `${smoothPath(top)} L${bottom[0].x} ${bottom[0].y} ${smoothPath(bottom).slice(1)} Z`;
  }, [band, toX, toY]);

  const linePts = useMemo(
    () => points.map((p) => ({ ...p, px: toX(p.x), py: toY(p.value) })),
    [points, toX, toY],
  );
  const linePath = useMemo(
    () => smoothPath(linePts.map((p) => ({ x: p.px, y: p.py }))),
    [linePts],
  );

  const active = scrubIndex != null ? linePts[scrubIndex] : linePts[linePts.length - 1];

  /** Nearest sample to the finger — snapping to real data, never between it. */
  const scrubTo = useCallback((clientX) => {
    const el = plotRef.current;
    if (!el || !linePts.length) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    let nearest = 0;
    let best = Infinity;
    linePts.forEach((p, i) => {
      const d = Math.abs(p.px - pct);
      if (d < best) { best = d; nearest = i; }
    });
    setScrubIndex(nearest);
    scrubX.set(linePts[nearest].px);
  }, [linePts, scrubX]);

  const insideBand = useMemo(() => {
    if (!active || !band.length) return null;
    // The band entry nearest this point, so the verdict matches the channel
    // actually drawn under it rather than an interpolation of it.
    const b = band.reduce((closest, cur) =>
      Math.abs(cur.x - active.x) < Math.abs(closest.x - active.x) ? cur : closest);
    if (active.value < b.low) return 'below';
    if (active.value > b.high) return 'above';
    return 'inside';
  }, [active, band]);

  if (!linePts.length) return null;

  return (
    <div className="wc">
      <div
        ref={plotRef}
        className={`wc__plot${scrubbing ? ' wc__plot--scrubbing' : ''}`}
        style={{ height }}
        role="group"
        aria-label="Weight over time"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setScrubbing(true);
          scrubTo(e.clientX);
        }}
        onPointerMove={(e) => { if (scrubbing) scrubTo(e.clientX); }}
        onPointerUp={() => setScrubbing(false)}
        onPointerCancel={() => setScrubbing(false)}
      >
        {/* The card clips; the dots below it do not. A reading on the first or
            last day sits exactly on the edge, and clipping it would slice the
            marker in half at precisely the two moments — her first log and her
            latest — that she is most likely to be looking for. */}
        <div className="wc__canvas">
          <svg className="wc__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={`wc-band-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--clr-sage)" stopOpacity="0.26" />
                <stop offset="100%" stopColor="var(--clr-sage)" stopOpacity="0.12" />
              </linearGradient>
              <clipPath id={`wc-clip-${uid}`}><rect x="0" y="0" width="100" height="100" /></clipPath>
              {/* The wipe. Overscans vertically so a round line cap near the top
                  or bottom of the plot is never shaved by its own reveal. */}
              <clipPath id={`wc-reveal-${uid}`}>
                <motion.rect
                  x="0" y="-20" width="100" height="140"
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: 100 }}
                  transition={{ duration: reduce ? 0 : 0.65, ease: EXPO }}
                />
              </clipPath>
            </defs>

            <g clipPath={`url(#wc-clip-${uid})`}>
              {/* The channel settles in behind. It used to open first and hold
                  her line back by a third of a second — which meant the one
                  thing she opened the screen for arrived last. The band is
                  context; it can afford to be the thing that catches up. */}
              {bandPath && (
                <motion.path
                  d={bandPath}
                  fill={`url(#wc-band-${uid})`}
                  initial={reduce ? false : { opacity: 0, scaleY: 0.06 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  style={{ transformOrigin: '50% 50%' }}
                  transition={{ duration: reduce ? 0 : 0.55, ease: EXPO }}
                />
              )}
              {bandPath && (
                <motion.path
                  d={bandPath}
                  fill="none"
                  stroke="var(--clr-sage)"
                  strokeOpacity="0.4"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: reduce ? 0 : 0.45, ease: EXPO }}
                />
              )}

              {/* Today. */}
              {nowX != null && (
                <line
                  x1={toX(nowX)} x2={toX(nowX)} y1="0" y2="100"
                  stroke="var(--clr-ink-subtle)" strokeWidth="1" strokeDasharray="2 3"
                  vectorEffect="non-scaling-stroke" opacity="0.5"
                />
              )}

              {/* Her line. First frame, no delay — it is what she came to see. */}
              <g clipPath={`url(#wc-reveal-${uid})`}>
                <path
                  d={linePath}
                  fill="none"
                  stroke="var(--clr-brand)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            </g>
          </svg>
        </div>

        {/* The scrub hairline. Outside the SVG so it stays 1px under the
            non-uniform stretch. */}
        {scrubIndex != null && (
          <motion.span
            className="wc__hair"
            aria-hidden="true"
            style={{ left: hairLeft }}
          />
        )}

        {/* Markers. Absolutely positioned so they stay circles. */}
        <div className="wc__dots" aria-hidden="true">
          {linePts.map((p, i) => (
            <motion.span
              key={`${p.x}-${i}`}
              className={`wc__dot${i === scrubIndex ? ' wc__dot--on' : ''}`}
              style={{ left: `${p.px}%`, top: `${p.py}%` }}
              initial={reduce ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : Math.min(i * 0.025, 0.25), ease: EXPO }}
            />
          ))}
        </div>
      </div>

      {/* The readout. One line, and the verdict comes before the number. */}
      <div className="wc__read">
        <span className={`wc__verdict wc__verdict--${insideBand ?? 'none'}`}>
          {insideBand === 'inside' ? 'Inside your range'
            : insideBand === 'above' ? 'Above your range'
            : insideBand === 'below' ? 'Below your range'
            : 'Your weight'}
        </span>
        <span className="wc__figure">
          {active.value > 0 && active.signed ? '+' : ''}{active.value.toFixed(1)} {unit}
        </span>
        <span className="wc__when">{active.label}</span>
      </div>

      <p className="wc__hint">
        {linePts.length > 1 ? 'Drag across the chart to see any day.' : 'Log again to see your line build.'}
      </p>
    </div>
  );
}
