import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

// Camellia petal: narrow base at (0,4), swells outward, tapers to rounded tip at (0,-82)
const PETAL_PATH = 'M 0 4 C -30 -4, -36 -52, 0 -82 C 36 -52, 30 -4, 0 4';
// Lighter inner vein — gives each petal a subtle mid-rib
const VEIN_PATH = 'M 0 3 C -7 -12, -7 -50, 0 -66 C 7 -50, 7 -12, 0 3';

const PETAL_ANGLES = [0, 72, 144, 216, 288];

// Stamen cluster: concentric rings of gold dots forming the camellia's core.
// Built once at module load so the layout is deterministic.
const STAMEN = (() => {
  const dots = [{ x: 0, y: 0, r: 4 }];
  const rings = [
    { radius: 9, count: 8, r: 3 },
    { radius: 17, count: 13, r: 2.6 },
  ];
  for (const { radius, count, r } of rings) {
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + radius; // offset per ring for organic spacing
      dots.push({
        x: +(Math.cos(a) * radius).toFixed(2),
        y: +(Math.sin(a) * radius).toFixed(2),
        r,
      });
    }
  }
  return dots;
})();

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function Splash() {
  const navigate = useNavigate();
  const { state } = useApp();

  useEffect(() => {
    const timer = setTimeout(
      () => {
        if (state.auth.isAuthenticated && state.user.isOnboarded) {
          navigate('/home', { replace: true });
        } else if (state.auth.isAuthenticated) {
          navigate('/onboarding/stage', { replace: true });
        } else {
          navigate('/phone', { replace: true });
        }
      },
      prefersReducedMotion() ? 1600 : 2900,
    );
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="screen"
      style={{
        background: 'oklch(0.95 0.04 355)',
        color: 'var(--clr-ink)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: 0,
        gap: 0,
      }}
    >
      {/* Deep red radial glow behind the flower */}
      <div
        className="sp-glow"
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '42%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 480,
          height: 480,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, oklch(0.80 0.10 355 / 0.45) 0%, oklch(0.88 0.06 355 / 0.22) 44%, transparent 68%)',
          animationDelay: '0.35s',
          pointerEvents: 'none',
        }}
      />

      {/* Content column */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--sp-10)',
          zIndex: 1,
          padding: 'var(--sp-8)',
          width: '100%',
        }}
      >
        <CamelliaBloom />

        <div style={{ textAlign: 'center' }}>
          <h1
            className="sp-title"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-4xl)',
              fontWeight: 600,
              color: 'var(--clr-ink)',
              letterSpacing: '-0.02em',
              lineHeight: 'var(--leading-tight)',
              animationDelay: '1.5s',
            }}
          >
            Am<span style={{ color: 'var(--clr-gold)' }}>r</span>uni
          </h1>

          <p
            className="sp-tagline"
            style={{
              marginTop: 'var(--sp-3)',
              fontSize: 'var(--text-sm)',
              color: 'var(--clr-ink-muted)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 500,
              animationDelay: '1.85s',
            }}
          >
            Women's Health · Your Way
          </p>
        </div>
      </div>
    </div>
  );
}

function CamelliaBloom() {
  return (
    <svg
      viewBox="-115 -115 230 230"
      width="300"
      height="300"
      role="img"
      aria-label="Amruni camellia flower"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/*
          Organic petal edge: fractalNoise displaces the petal silhouette by ~3px,
          giving the impression of a real pressed flower rather than a vector shape.
        */}
        <filter id="sp-petal-organic" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.017"
            numOctaves="3"
            seed="11"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="3.2"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Soft gold bloom for the centre */}
        <filter id="sp-gold-glow" x="-140%" y="-140%" width="380%" height="380%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="11" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Gold spark at centre — flashes before petals open */}
      <circle
        className="sp-spark"
        cx="0"
        cy="0"
        r="60"
        fill="oklch(0.72 0.09 73)"
        style={{ animationDelay: '0.14s' }}
      />

      {/*
        Three-layer transform strategy:

        1. Outer <g transform="rotate(N)"> — SVG-attribute rotation around the
           SVG origin (0,0) = flower centre. Rock-solid across browsers.
        2. Middle <g class="sp-petal"> — CSS keyframe animation (scale + swing),
           transform-box:fill-box + origin 50% 100% so the pivot is the petal
           base = flower centre. Carries NO filter, so the scale(0) frame never
           hands a degenerate bbox to a filter.
        3. Inner <path filter> — static; the organic-edge filter is computed in
           the path's own coordinate space, then the wrapper transform applies.
      */}
      {PETAL_ANGLES.map((angle, i) => {
        const delay = `${(0.28 + i * 0.13).toFixed(2)}s`;
        return (
          <g key={i} transform={`rotate(${angle})`}>
            <g className="sp-petal" style={{ animationDelay: delay }}>
              <path
                d={PETAL_PATH}
                fill="oklch(0.52 0.18 355)"
                fillOpacity="0.95"
                filter="url(#sp-petal-organic)"
              />
              <path d={VEIN_PATH} fill="oklch(0.65 0.14 355)" fillOpacity="0.22" />
            </g>
          </g>
        );
      })}

      {/* Warm core disc beneath the stamens */}
      <circle
        className="sp-core"
        cx="0"
        cy="0"
        r="9"
        fill="oklch(0.66 0.13 60)"
        style={{ animationDelay: '1.0s' }}
      />

      {/*
        Gold stamen cluster — a ring of small dots, so the centre reads as a real
        camellia core, not an eye. The animated wrapper <g class="sp-stamen">
        carries no filter; the glow filter is on the static inner group whose
        dots are always full-size, so the filter region never paints black.
      */}
      <g className="sp-stamen" style={{ animationDelay: '1.0s' }}>
        <g filter="url(#sp-gold-glow)">
          {STAMEN.map(({ x, y, r }, i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="oklch(0.74 0.10 75)" />
          ))}
        </g>
      </g>
    </svg>
  );
}
