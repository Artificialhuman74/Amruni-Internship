import { useEffect, useRef, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * "The Bloom" — the moment pregnancy mode turns on.
 *
 * A warm rose-gold liquid floods up the screen through a wavy mask, a camellia
 * unfurls petal-by-petal at the centre with a gentle swirl, its heart gives a
 * soft double heartbeat, and real vector petals peel off and drift. The words
 * wipe in. All crafted SVG — no emoji. Reduced motion gets a composed static
 * frame. Tap anywhere to skip.
 */

interface PregnancyBloomProps {
  onDone: () => void;
}

const EXPO = [0.16, 1, 0.3, 1] as [number, number, number, number];

// One camellia petal (teardrop pointing up from the origin).
function petalPath(len: number, w: number): string {
  return `M0 0 C ${-w / 2} ${-len * 0.35}, ${-w / 2} ${-len * 0.82}, 0 ${-len} C ${w / 2} ${-len * 0.82}, ${w / 2} ${-len * 0.35}, 0 0 Z`;
}

interface Petal { a: number; len: number; w: number; }
const OUTER: Petal[] = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * 360, len: 82, w: 50 }));
const INNER: Petal[] = Array.from({ length: 8 }, (_, i) => ({ a: ((i + 0.5) / 8) * 360, len: 54, w: 34 }));

interface PeelPetal { x: number; len: number; w: number; dx: number; rot: number; delay: number; dur: number; }
const PEEL: PeelPetal[] = [
  { x: -70, len: 34, w: 22, dx: -140, rot: -220, delay: 1.05, dur: 1.5 },
  { x: -28, len: 28, w: 18, dx: -60, rot: 180, delay: 1.2, dur: 1.6 },
  { x: 6, len: 40, w: 26, dx: 30, rot: -160, delay: 1.0, dur: 1.7 },
  { x: 44, len: 30, w: 20, dx: 120, rot: 240, delay: 1.28, dur: 1.5 },
  { x: 78, len: 24, w: 16, dx: 190, rot: -200, delay: 1.14, dur: 1.55 },
  { x: -100, len: 22, w: 15, dx: -210, rot: 160, delay: 1.34, dur: 1.5 },
];

export default function PregnancyBloom({ onDone }: PregnancyBloomProps) {
  const reduce = useReducedMotion();

  // Fire onDone exactly once — timer or tap-to-skip, never both.
  const doneRef = useRef(false);
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  // Bloom builds over ~2.3s, then holds so it can actually be seen before we
  // move on to the Track screen. Tap anywhere to skip early.
  useEffect(() => {
    const t = setTimeout(finish, reduce ? 900 : 5200);
    return () => clearTimeout(t);
  }, [finish, reduce]);

  return (
    <motion.div
      className="bloom-overlay"
      role="status"
      aria-label="Pregnancy mode enabled"
      onClick={finish}
      title="Tap to continue"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{ background: 'radial-gradient(125% 90% at 50% 42%, oklch(0.52 0.15 14), oklch(0.34 0.15 8))' }}
    >
      {/* ── Liquid: rose-gold flooding upward ──────────────────────── */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
        <defs>
          <linearGradient id="bloomLiquid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.62 0.15 22)" />
            <stop offset="55%" stopColor="oklch(0.47 0.17 12)" />
            <stop offset="100%" stopColor="oklch(0.36 0.16 8)" />
          </linearGradient>
          <linearGradient id="bloomLiquidBack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.64 0.12 24)" />
            <stop offset="100%" stopColor="oklch(0.42 0.15 10)" />
          </linearGradient>
        </defs>
        <motion.path
          d="M0 8 C 22 2, 40 14, 60 8 C 78 3, 90 12, 100 8 L100 220 L0 220 Z"
          fill="url(#bloomLiquidBack)"
          opacity="0.55"
          initial={reduce ? { y: -22, x: 0 } : { y: 100, x: 0 }}
          animate={reduce ? { y: -22 } : { y: [100, -24, -20], x: [0, -3, 2, 0] }}
          transition={{ duration: reduce ? 0.4 : 1.5, ease: EXPO, times: reduce ? undefined : [0, 0.75, 1] }}
        />
        <motion.path
          d="M0 6 C 18 -4, 38 10, 58 4 C 76 -2, 90 8, 100 4 L100 220 L0 220 Z"
          fill="url(#bloomLiquid)"
          initial={reduce ? { y: -18 } : { y: 100 }}
          animate={reduce ? { y: -18 } : { y: [100, -20, -16], x: [0, 2, -2, 0] }}
          transition={{ duration: reduce ? 0.45 : 1.35, delay: reduce ? 0 : 0.12, ease: EXPO, times: reduce ? undefined : [0, 0.78, 1] }}
        />
      </svg>

      {/* ── Centre stack ───────────────────────────────────────────── */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 264, height: 264 }}>

          {/* soft glow halo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: reduce ? 0.55 : [0, 0.68, 0.55], scale: 1 }}
            transition={{ duration: reduce ? 0.4 : 1.1, delay: reduce ? 0 : 0.5, ease: EXPO }}
            style={{
              position: 'absolute', inset: '-18%',
              background: 'radial-gradient(circle, oklch(0.97 0.04 40 / 0.9), transparent 52%)',
              filter: 'blur(6px)',
            }}
          />

          {/* peeling petals */}
          {!reduce && (
            <svg viewBox="-110 -110 220 220" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} aria-hidden="true">
              {PEEL.map((p, i) => (
                <motion.path
                  key={i}
                  d={petalPath(p.len, p.w)}
                  fill="oklch(0.95 0.05 18)"
                  stroke="oklch(0.6 0.16 12 / 0.35)"
                  strokeWidth="0.6"
                  initial={{ x: p.x * 0.2, y: 6, rotate: 0, scale: 0.3, opacity: 0 }}
                  animate={{ x: p.dx, y: -230, rotate: p.rot, scale: 1, opacity: [0, 1, 1, 0] }}
                  transition={{ duration: p.dur, delay: p.delay, ease: 'easeOut', opacity: { duration: p.dur, delay: p.delay, times: [0, 0.15, 0.7, 1] } }}
                  style={{ transformOrigin: '0px 0px', filter: 'blur(0.4px) drop-shadow(0 3px 6px oklch(0.5 0.15 12 / 0.2))' }}
                />
              ))}
            </svg>
          )}

          {/* the camellia — unfurling with a swirl */}
          <motion.svg
            viewBox="-110 -110 220 220"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
            aria-hidden="true"
            initial={reduce ? { rotate: 0 } : { rotate: -16 }}
            animate={{ rotate: 0 }}
            transition={{ duration: reduce ? 0.3 : 1.1, delay: reduce ? 0 : 0.5, ease: EXPO }}
          >
            <defs>
              <radialGradient id="bloomPetalOuter" cx="50%" cy="30%" r="80%">
                <stop offset="0%" stopColor="oklch(0.92 0.07 22)" />
                <stop offset="55%" stopColor="oklch(0.72 0.16 14)" />
                <stop offset="100%" stopColor="oklch(0.55 0.18 10)" />
              </radialGradient>
              <radialGradient id="bloomPetalInner" cx="50%" cy="35%" r="80%">
                <stop offset="0%" stopColor="oklch(0.98 0.03 26)" />
                <stop offset="100%" stopColor="oklch(0.82 0.12 16)" />
              </radialGradient>
              <filter id="bloomGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="oklch(0.4 0.16 10)" floodOpacity="0.35" />
              </filter>
            </defs>
            <g filter="url(#bloomGlow)">
              {OUTER.map((p, i) => (
                <g key={`o${i}`} transform={`rotate(${p.a})`}>
                  <motion.path
                    d={petalPath(p.len, p.w)}
                    fill="url(#bloomPetalOuter)"
                    stroke="oklch(0.5 0.17 8 / 0.4)"
                    strokeWidth="0.8"
                    initial={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: reduce ? 0.3 : 0.55, delay: reduce ? 0 : 0.55 + i * 0.05, ease: EXPO }}
                    style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
                  />
                </g>
              ))}
              {INNER.map((p, i) => (
                <g key={`i${i}`} transform={`rotate(${p.a})`}>
                  <motion.path
                    d={petalPath(p.len, p.w)}
                    fill="url(#bloomPetalInner)"
                    stroke="oklch(0.6 0.16 12 / 0.35)"
                    strokeWidth="0.7"
                    initial={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: reduce ? 0.3 : 0.55, delay: reduce ? 0 : 0.9 + i * 0.05, ease: EXPO }}
                    style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
                  />
                </g>
              ))}

              {/* heartbeat ripple ring */}
              {!reduce && (
                <motion.circle
                  cx="0" cy="0" r="11" fill="none"
                  stroke="oklch(0.68 0.17 18)" strokeWidth="2.5"
                  initial={{ scale: 1, opacity: 0 }}
                  animate={{ scale: [1, 3.4], opacity: [0.6, 0] }}
                  transition={{ duration: 1.0, delay: 1.65, ease: 'easeOut', repeat: 1, repeatDelay: 0.15 }}
                  style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}
                />
              )}

              {/* the heart — scales in, then a soft double heartbeat */}
              <motion.circle
                cx="0" cy="0" r="10"
                fill="var(--clr-preg-gold)" stroke="oklch(0.6 0.11 64)" strokeWidth="1.6"
                initial={reduce ? { scale: 1 } : { scale: 0 }}
                animate={reduce ? { scale: 1 } : { scale: [0, 1, 1, 1.16, 0.98, 1.12, 1] }}
                transition={{ duration: reduce ? 0.3 : 1.5, delay: reduce ? 0 : 1.25, ease: EXPO, times: reduce ? undefined : [0, 0.28, 0.5, 0.62, 0.74, 0.86, 1] }}
                style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}
              />
            </g>
          </motion.svg>
        </div>

        {/* words — clip-path wipe reveal */}
        <motion.h2
          initial={reduce ? { opacity: 0 } : { clipPath: 'inset(0 100% 0 0)', opacity: 1 }}
          animate={reduce ? { opacity: 1 } : { clipPath: 'inset(0 0% 0 0)' }}
          transition={{ duration: reduce ? 0.3 : 0.6, delay: reduce ? 0.1 : 1.35, ease: EXPO }}
          style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'oklch(0.99 0.01 30)', marginTop: 'var(--sp-8)', letterSpacing: '-0.01em', textShadow: '0 2px 12px oklch(0.4 0.14 12 / 0.35)' }}
        >
          Pregnancy mode
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: reduce ? 0.2 : 1.85 }}
          style={{ fontSize: 'var(--text-sm)', color: 'oklch(0.97 0.02 30 / 0.95)', marginTop: 'var(--sp-2)', letterSpacing: '0.02em' }}
        >
          Your journey begins.
        </motion.p>
      </div>
    </motion.div>
  );
}
