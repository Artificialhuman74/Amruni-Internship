import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * The sky the entry was written under, as an actual scene.
 *
 * Built entirely from gradients, SVG and blur — no images, nothing to
 * download, nothing to go stale. That matters on the connections this app
 * runs on: a full-bleed weather backdrop that costs zero bytes and renders
 * from a single stored weather code.
 *
 * Deliberately a *scene* and not an icon. The point is to put her back in the
 * afternoon she was writing in, and a small cloud glyph in a corner does not
 * do that — the light in the room does.
 *
 * Every palette here is deep enough to carry white text at AA, because the
 * mood sits on top of it and the mood is the subject.
 */

// Sky palettes, top → horizon. Day skies stay saturated rather than pale:
// a washed-out sky cannot hold the white type the mood is set in.
const SKIES = {
  bright: {
    day: ['#2E6FC4', '#5FA0DC', '#9FC8E8'],
    night: ['#0B1733', '#16264D', '#2A3E6B'],
  },
  grey: {
    day: ['#4A5A6E', '#6B7B8E', '#93A1AF'],
    night: ['#141A24', '#222B38', '#38434F'],
  },
  wet: {
    day: ['#33465C', '#4A6076', '#6B8092'],
    night: ['#0D141C', '#18232F', '#2A3846'],
  },
  storm: {
    day: ['#232A3B', '#333B52', '#4A5268'],
    night: ['#07090F', '#12161F', '#222836'],
  },
  cold: {
    day: ['#5C7189', '#8098AE', '#AEC2D4'],
    night: ['#121A26', '#1F2B3A', '#33455A'],
  },
};

/**
 * A real photograph for this sky, if one has been added.
 *
 * Progressive enhancement, in that exact order: the drawn scene paints on the
 * first frame at zero cost, and a photo — if it exists, if the network allows —
 * fades in over it. A missing file, a 404, or no signal at all leaves the drawn
 * sky in place and nothing is broken. That ordering is the point: on the
 * connections this app is built for, the version that always works has to be
 * the one that renders first, not the fallback.
 */
function usePhoto(mood, isDay) {
  const src = `/weather/${mood}-${isDay ? 'day' : 'night'}.webp`;
  // Keyed by src so a changed sky resets during render rather than in an
  // effect — an effect would paint one frame of the previous sky's photo.
  const [loaded, setLoaded] = useState(null);
  const [seen, setSeen] = useState(src);
  if (seen !== src) { setSeen(src); setLoaded(null); }

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => { if (!cancelled) setLoaded(src); };
    img.onerror = () => { /* no photo for this sky yet — the drawn one stands */ };
    img.src = src;
    return () => { cancelled = true; img.onload = null; img.onerror = null; };
  }, [src]);

  return loaded === src ? src : null;
}

/**
 * Dev override: `?sky=wet-day` forces a condition so a sky can be looked at
 * without waiting for the weather to oblige. Ignored in production builds.
 */
function devOverride() {
  if (!import.meta.env?.DEV || typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('sky');
  if (!raw) return null;
  const [mood, part] = raw.split('-');
  return SKIES[mood] ? { mood, isDay: part !== 'night' } : null;
}

export default function WeatherScene({ weather, className = '' }) {
  const reduce = useReducedMotion();
  const forced = devOverride();
  const mood = forced?.mood ?? weather?.mood ?? 'grey';
  const isDay = forced ? forced.isDay : weather?.isDay !== false;
  const sky = (SKIES[mood] ?? SKIES.grey)[isDay ? 'day' : 'night'];
  const photo = usePhoto(mood, isDay);

  const wet = mood === 'wet' || mood === 'storm';
  const starry = !isDay && (mood === 'bright' || mood === 'cold');

  // Fixed per render rather than random each frame — a star field that
  // reshuffles on every state change reads as noise, not as a sky.
  const stars = useMemo(
    () => Array.from({ length: 44 }, (_, i) => ({
      x: (i * 37.4) % 100,
      y: ((i * 61.7) % 62) + 2,
      r: 0.35 + ((i * 13) % 7) / 10,
      o: 0.25 + ((i * 7) % 6) / 10,
      d: (i % 9) * 0.4,
    })),
    [],
  );

  const drops = useMemo(
    () => Array.from({ length: 28 }, (_, i) => ({
      x: (i * 29.3) % 100,
      delay: ((i * 17) % 20) / 10,
      dur: 0.7 + ((i * 11) % 6) / 10,
      len: 8 + ((i * 5) % 10),
    })),
    [],
  );

  return (
    <div className={`ws ${className}`} aria-hidden="true">
      <div
        className="ws__sky"
        style={{ background: `linear-gradient(178deg, ${sky[0]} 0%, ${sky[1]} 52%, ${sky[2]} 100%)` }}
      />

      {/* The photograph, once it has actually decoded. Fading it in rather than
          swapping avoids the flash of a sky changing under her. */}
      {photo && (
        <motion.div
          className="ws__photo"
          style={{ backgroundImage: `url(${photo})` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduce ? 0 : 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      )}

      {starry && !photo && (
        <svg className="ws__stars" viewBox="0 0 100 100" preserveAspectRatio="none">
          {stars.map((s, i) => (
            <motion.circle
              key={i}
              cx={s.x} cy={s.y} r={s.r}
              fill="#fff"
              initial={{ opacity: s.o }}
              animate={reduce ? { opacity: s.o } : { opacity: [s.o, s.o * 0.35, s.o] }}
              transition={{ duration: 3.6, repeat: Infinity, delay: s.d, ease: 'easeInOut' }}
            />
          ))}
        </svg>
      )}

      {/* The one bright body in the sky — sun by day, moon by night. Only when
          there is enough clear sky to see it. */}
      {(mood === 'bright' || mood === 'cold') && !photo && (
        <div className={`ws__body${isDay ? ' ws__body--sun' : ' ws__body--moon'}`} />
      )}

      {/* Cloud bank. Three layers at different depths and speeds, so the sky
          has distance in it rather than one flat sheet of grey. */}
      {!photo && <div className="ws__clouds">
        {[0, 1, 2].map((layer) => (
          <motion.div
            key={layer}
            className={`ws__cloud ws__cloud--${layer} ws__cloud--${mood}`}
            initial={false}
            animate={reduce ? {} : { x: ['-8%', '8%', '-8%'] }}
            transition={{ duration: 46 + layer * 22, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>}

      {/* Rain stays even over a photo: a still image of rain doesn't fall. */}
      {wet && (
        <svg className="ws__rain" viewBox="0 0 100 100" preserveAspectRatio="none">
          {drops.map((d, i) => (
            <motion.line
              key={i}
              x1={d.x} x2={d.x - 1.5}
              y1={-d.len} y2={0}
              stroke="#fff"
              strokeWidth="0.35"
              strokeLinecap="round"
              opacity={mood === 'storm' ? 0.5 : 0.35}
              initial={{ y: -20 }}
              animate={reduce ? { y: 40 } : { y: [-20, 120] }}
              transition={reduce
                ? { duration: 0 }
                : { duration: d.dur * 2.2, repeat: Infinity, delay: d.delay, ease: 'linear' }}
            />
          ))}
        </svg>
      )}

      {/* Grounds the scene and guarantees the mood on top of it clears AA,
          whatever the sky underneath is doing. */}
      <div className="ws__scrim" />
    </div>
  );
}
