import { motion, useReducedMotion } from 'framer-motion';

/**
 * The Amruni onboarding hero — a red camellia (the brand flower) cradled in a
 * protective shield, surrounded by softly drifting petals and quiet gears
 * (care working in the background). Hand-built vector art: razor-sharp at any
 * size, themeable, and animatable. Deep-ink linework, crimson bloom, gold and
 * blush accents — the brand's own identity, not a pastel wellness look.
 *
 * `variant` tints the shield: 'brand' (crimson) or 'gold' for softer screens.
 */
export default function CamelliaHero({ size = 260, variant = 'brand' }) {
  const reduce = useReducedMotion();

  const shieldFill = variant === 'gold' ? 'url(#heroGold)' : 'url(#heroCrimson)';

  // Eight camellia petals per ring, rotated around the centre.
  const petal = (i, n, r, len, w) => {
    const a = (i / n) * 360;
    return { a, r, len, w };
  };
  const outer = Array.from({ length: 8 }, (_, i) => petal(i, 8, 0, 40, 26));
  const inner = Array.from({ length: 8 }, (_, i) => petal(i + 0.5, 8, 0, 26, 18));

  // Scattered background flora + gears.
  const flora = [
    { x: 40, y: 60, s: 22, rot: -25, c: 'var(--hero-gold)', kind: 'gear' },
    { x: 250, y: 44, s: 30, rot: 15, c: 'var(--hero-blush)', kind: 'gear' },
    { x: 268, y: 150, s: 18, rot: 40, c: 'var(--hero-amber)', kind: 'gear' },
    { x: 30, y: 168, s: 16, rot: 10, c: 'var(--hero-blush-2)', kind: 'gear' },
    { x: 60, y: 30, s: 15, rot: 30, c: 'var(--hero-amber)', kind: 'petal' },
    { x: 238, y: 200, s: 17, rot: -30, c: 'var(--hero-gold)', kind: 'petal' },
    { x: 22, y: 118, s: 13, rot: 60, c: 'var(--hero-blush)', kind: 'petal' },
    { x: 278, y: 96, s: 12, rot: -15, c: 'var(--hero-blush-2)', kind: 'petal' },
  ];

  return (
    <div style={{ width: size, height: size, marginInline: 'auto' }}>
      <svg viewBox="0 0 300 280" width="100%" height="100%" role="img" aria-label="Amruni — a camellia held in a shield of care" style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id="heroCrimson" cx="42%" cy="34%" r="78%">
            <stop offset="0%" stopColor="oklch(0.62 0.19 8)" />
            <stop offset="62%" stopColor="oklch(0.52 0.2 5)" />
            <stop offset="100%" stopColor="oklch(0.42 0.18 3)" />
          </radialGradient>
          <radialGradient id="heroGold" cx="42%" cy="34%" r="78%">
            <stop offset="0%" stopColor="oklch(0.82 0.1 78)" />
            <stop offset="100%" stopColor="oklch(0.68 0.1 66)" />
          </radialGradient>
          <radialGradient id="heroGlow" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="oklch(0.92 0.06 20 / 0.5)" />
            <stop offset="100%" stopColor="oklch(0.92 0.06 20 / 0)" />
          </radialGradient>
          <linearGradient id="heroPetal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.98 0.01 20)" />
            <stop offset="100%" stopColor="oklch(0.9 0.05 15)" />
          </linearGradient>
        </defs>

        {/* soft warm glow behind everything */}
        <motion.circle cx="150" cy="130" r="120" fill="url(#heroGlow)"
          {...(reduce ? {} : { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } })} />

        {/* scattered gears + petals */}
        {flora.map((f, i) => (
          <motion.g key={i}
            {...(reduce ? {} : {
              initial: { opacity: 0, scale: 0.4, rotate: f.rot - 20 },
              animate: { opacity: 1, scale: 1, rotate: f.rot },
              transition: { duration: 0.7, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] },
            })}
            style={{ transformOrigin: `${f.x}px ${f.y}px` }}
          >
            {f.kind === 'gear'
              ? <Gear cx={f.x} cy={f.y} r={f.s} color={f.c} />
              : <Petal cx={f.x} cy={f.y} len={f.s * 1.6} w={f.s} color={f.c} />}
          </motion.g>
        ))}

        {/* Shield */}
        <motion.g
          {...(reduce ? {} : { initial: { opacity: 0, y: 14, scale: 0.92 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] } })}
          style={{ transformOrigin: '150px 130px' }}
        >
          <path d={SHIELD} fill={shieldFill} stroke="oklch(0.2 0.03 350)" strokeWidth="3.5" strokeLinejoin="round" />
          {/* inner keyline */}
          <path d={SHIELD_INNER} fill="none" stroke="oklch(0.99 0.01 20 / 0.55)" strokeWidth="1.6" strokeLinejoin="round" />

          {/* Camellia bloom, centred on the shield */}
          <g transform="translate(150 122)">
            {outer.map((p, i) => (
              <motion.g key={`o${i}`}
                {...(reduce ? {} : { initial: { opacity: 0, scale: 0.2, rotate: p.a - 40 }, animate: { opacity: 1, scale: 1, rotate: p.a }, transition: { duration: 0.55, delay: 0.5 + i * 0.04, ease: [0.16, 1, 0.3, 1] } })}
                style={{ transformOrigin: '0px 0px' }}
              >
                <BloomPetal len={p.len} w={p.w} fill="url(#heroPetal)" />
              </motion.g>
            ))}
            {inner.map((p, i) => (
              <motion.g key={`i${i}`}
                {...(reduce ? {} : { initial: { opacity: 0, scale: 0.2, rotate: p.a - 40 }, animate: { opacity: 1, scale: 1, rotate: p.a }, transition: { duration: 0.55, delay: 0.78 + i * 0.04, ease: [0.16, 1, 0.3, 1] } })}
                style={{ transformOrigin: '0px 0px' }}
              >
                <BloomPetal len={p.len} w={p.w} fill="oklch(0.97 0.02 18)" />
              </motion.g>
            ))}
            <motion.circle cx="0" cy="0" r="9" fill="var(--hero-gold)" stroke="oklch(0.6 0.12 70)" strokeWidth="1.5"
              {...(reduce ? {} : { initial: { scale: 0 }, animate: { scale: 1 }, transition: { duration: 0.5, delay: 1.05, ease: [0.16, 1, 0.3, 1] } })}
              style={{ transformOrigin: '0px 0px' }} />
          </g>
        </motion.g>
      </svg>
    </div>
  );
}

// A rounded heater-shield.
const SHIELD = 'M150 44 C 176 58 206 62 222 62 C 222 128 210 186 150 220 C 90 186 78 128 78 62 C 94 62 124 58 150 44 Z';
const SHIELD_INNER = 'M150 60 C 172 71 196 74 208 74 C 208 126 198 174 150 202 C 102 174 92 126 92 74 C 104 74 128 71 150 60 Z';

function BloomPetal({ len, w, fill }) {
  // teardrop pointing up from origin
  const d = `M0 0 C ${-w / 2} ${-len * 0.35}, ${-w / 2} ${-len * 0.8}, 0 ${-len} C ${w / 2} ${-len * 0.8}, ${w / 2} ${-len * 0.35}, 0 0 Z`;
  return <path d={d} fill={fill} stroke="oklch(0.72 0.14 12 / 0.35)" strokeWidth="0.8" />;
}

function Petal({ cx, cy, len, w, color }) {
  const d = `M${cx} ${cy} C ${cx - w / 2} ${cy - len * 0.35}, ${cx - w / 2} ${cy - len * 0.8}, ${cx} ${cy - len} C ${cx + w / 2} ${cy - len * 0.8}, ${cx + w / 2} ${cy - len * 0.35}, ${cx} ${cy} Z`;
  return <path d={d} fill={color} opacity="0.85" />;
}

function Gear({ cx, cy, r, color }) {
  const teeth = 9;
  const inner = r * 0.62;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.5) / teeth) * Math.PI * 2;
    const a2 = ((i + 1) / teeth) * Math.PI * 2;
    const p = (ang, rad) => `${(cx + Math.cos(ang) * rad).toFixed(1)} ${(cy + Math.sin(ang) * rad).toFixed(1)}`;
    d += `${i === 0 ? 'M' : 'L'} ${p(a0, r)} L ${p(a1, r)} L ${p(a2, inner)} `;
  }
  d += 'Z';
  return (
    <g opacity="0.7">
      <path d={d} fill={color} />
      <circle cx={cx} cy={cy} r={inner * 0.5} fill="var(--clr-bg, #fff)" />
    </g>
  );
}
