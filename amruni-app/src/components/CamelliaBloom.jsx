import { memo, useId } from 'react';
import { clamp, lerp, MOTION, ROSE, OUTWARD, RINGS, GOLD, FLOWER_BOX } from '../lib/bloomMotion';

/**
 * The layered camellia from the "Camellia Bloom Login Animation" design.
 *
 * Copied from that design's bloom-scene.jsx with its choices applied — the
 * Rose palette and the "Outward unfurl" bloom — and nothing reinterpreted:
 * the petal path, the three rings, the per-petal stagger, the curl, the
 * gradients and the phyllotaxis stamen spiral are its numbers.
 *
 * `t` is seconds since the bloom began. The component is pure in `t`, so the
 * caller owns the clock (and can jump it forward when she taps to skip).
 * Everything settles by t ≈ 3.3s; past that the drawing never changes, which
 * is why the caller clamps `t` and this component is memoised on it.
 */

function petalPath(L, w) {
  return `M0 0 C ${-w * 0.5} ${-L * 0.1}, ${-w} ${-L * 0.44}, ${-w * 0.6} ${-L * 0.82}`
    + ` C ${-w * 0.33} ${-L * 1.0}, ${w * 0.33} ${-L * 1.0}, ${w * 0.6} ${-L * 0.82}`
    + ` C ${w} ${-L * 0.44}, ${w * 0.5} ${-L * 0.1}, 0 0 Z`;
}

function CamelliaBloom({ t, size = FLOWER_BOX, pal = ROSE, st = OUTWARD, halo = true }) {
  // Gradient and filter ids must be unique per instance, or two flowers on one
  // page would paint with whichever defined the id first.
  const uid = useId().replace(/:/g, '');
  const id = (name) => `${name}-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="-450 -450 900 900"
      style={{ overflow: 'visible', display: 'block' }}
      role="img"
      aria-label="Amruni camellia"
    >
      <defs>
        <filter id={id('petalShadow')} x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="9" stdDeviation="12" floodColor={pal.shadow} floodOpacity="0.28" />
        </filter>
        <filter id={id('coreShadow')} x="-90%" y="-90%" width="280%" height="280%">
          <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor={pal.shadow} floodOpacity="0.45" />
        </filter>
        <radialGradient id={id('coreDisc')} cx="42%" cy="36%" r="70%">
          <stop offset="0%" stopColor={pal.tip} stopOpacity="0.9" />
          <stop offset="100%" stopColor={pal.deep} />
        </radialGradient>
        <radialGradient id={id('stamenTip')} cx="36%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFF6DC" />
          <stop offset="45%" stopColor={GOLD.mid} />
          <stop offset="100%" stopColor={GOLD.deep} />
        </radialGradient>
        {RINGS.map((r, ri) => {
          const open = clamp((t - st.delay(ri, 0, r.n)) / (r.dur + 0.4), 0, 1);
          const c = pal.rings[ri];
          return (
            <linearGradient key={ri} id={id(`petal${ri}`)} x1="0" y1="1" x2="0.12" y2="0">
              <stop offset="0%" stopColor={c[0]} stopOpacity={lerp(1, 0.95, open)} />
              <stop offset={`${lerp(38, 30, open)}%`} stopColor={c[1]} />
              <stop offset={`${lerp(86, 78, open)}%`} stopColor={c[2]} />
              <stop offset="100%" stopColor="#FFF6FA" stopOpacity={lerp(0.85, 1, open)} />
            </linearGradient>
          );
        })}
      </defs>

      {halo && <circle r="420" fill={pal.tip} opacity={0.07 * clamp(MOTION.fade(0.3, 1.6)(t), 0, 1)} />}

      {RINGS.map((r, ri) => (
        <g key={ri} filter={`url(#${id('petalShadow')})`}>
          {Array.from({ length: r.n }, (_, i) => {
            const d = st.delay(ri, i, r.n);
            const p = clamp(MOTION.unfurl(d, d + r.dur)(t), 0, 1.05);
            const a = r.rot + (360 / r.n) * i;
            const sx = lerp(0.17, 1, p);
            const sy = lerp(0.09, 1, p);
            const curl = (1 - p) * r.curl * st.curlMul;
            return (
              <g key={i} transform={`rotate(${a + curl}) scale(${sx} ${sy}) rotate(${curl * 0.4})`}>
                <path d={petalPath(r.L, r.w)} fill={`url(#${id(`petal${ri}`)})`} />
                <path
                  d={`M0 ${-r.L * 0.06} L0 ${-r.L * 0.9}`}
                  stroke="#FFFFFF" strokeOpacity={0.22 * p} strokeWidth={r.w * 0.05}
                  strokeLinecap="round" fill="none"
                />
                <path d={petalPath(r.L, r.w)} fill="none" stroke="#FFEFF6" strokeOpacity={0.35 * p} strokeWidth="1.5" />
              </g>
            );
          })}
        </g>
      ))}

      <g filter={`url(#${id('coreShadow')})`} opacity={clamp(MOTION.fade(st.corePop - 1.6, st.corePop - 1.1)(t), 0, 1)}>
        <circle r={lerp(20, 58, clamp(MOTION.unfurl(st.corePop, st.corePop + 0.85)(t), 0, 1))} fill={`url(#${id('coreDisc')})`} />
      </g>
      <g opacity={clamp(MOTION.fade(st.corePop - 0.05, st.corePop + 0.45)(t), 0, 1)}>
        {Array.from({ length: 54 }, (_, j) => {
          const cp = clamp(MOTION.unfurl(st.corePop + (j % 9) * 0.03, st.corePop + 0.85 + (j % 9) * 0.03)(t), 0, 1.08);
          const a = (j * 137.5) * Math.PI / 180;
          const rad = (14 + 46 * Math.sqrt(j / 54)) * cp;
          const x = Math.cos(a) * rad;
          const y = Math.sin(a) * rad;
          const s = lerp(4.2, 8.4, 1 - rad / 62) * cp;
          return (
            <g key={j}>
              <ellipse cx={x} cy={y + s * 0.5} rx={s} ry={s * 0.75} fill={pal.deep} opacity="0.5" />
              <circle cx={x} cy={y} r={s} fill={`url(#${id('stamenTip')})`} />
              <circle cx={x - s * 0.28} cy={y - s * 0.32} r={s * 0.28} fill="#FFFDF0" opacity="0.92" />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default memo(CamelliaBloom);
