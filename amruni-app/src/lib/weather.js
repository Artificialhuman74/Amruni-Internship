/**
 * The weather she was writing in.
 *
 * An entry that remembers a grey, unending August afternoon carries something
 * the words often don't — and monsoon in particular is a real part of how a
 * year feels here. It sits behind the mood, never in front of it: the feeling
 * is the entry, the weather is the room it was written in.
 *
 * On consent: this needs her location, and a private journal is the last place
 * to spring a permission prompt. So nothing is ever requested silently —
 * `weatherPermission()` reports what is already granted, and the composer only
 * asks after she opts in. Declining costs her nothing; the entry simply has no
 * weather on it.
 *
 * Open-Meteo: no key, no account, no per-user identifier sent. Coordinates are
 * rounded before they leave the device — the weather two kilometres away is
 * the same weather, and her exact position is not needed to know it was
 * raining.
 */

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

// WMO codes, grouped the way a person would describe the sky rather than the
// way a meteorologist would. `mood` drives the ambient wash on the entry.
const CONDITIONS = [
  { max: 0, id: 'clear', label: 'Clear', mood: 'bright' },
  { max: 2, id: 'partly', label: 'Partly cloudy', mood: 'bright' },
  { max: 3, id: 'overcast', label: 'Overcast', mood: 'grey' },
  { max: 48, id: 'fog', label: 'Fog', mood: 'grey' },
  { max: 57, id: 'drizzle', label: 'Drizzle', mood: 'wet' },
  { max: 65, id: 'rain', label: 'Rain', mood: 'wet' },
  { max: 67, id: 'rain', label: 'Freezing rain', mood: 'wet' },
  { max: 77, id: 'snow', label: 'Snow', mood: 'cold' },
  { max: 82, id: 'showers', label: 'Showers', mood: 'wet' },
  { max: 86, id: 'snow', label: 'Snow showers', mood: 'cold' },
  { max: 99, id: 'storm', label: 'Thunderstorm', mood: 'storm' },
];

export function describeCode(code) {
  return CONDITIONS.find((c) => code <= c.max) ?? { id: 'unknown', label: 'Unknown', mood: 'grey' };
}

/** What geolocation permission is right now, without asking for it. */
export async function weatherPermission() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unsupported';
  if (!navigator.permissions?.query) return 'unknown';
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;   // 'granted' | 'prompt' | 'denied'
  } catch {
    return 'unknown';
  }
}

function position() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      // Low accuracy on purpose: a city block is plenty, and it lets the
      // device answer from a cached fix instead of waking the GPS.
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 30 * 60 * 1000,
    });
  });
}

/**
 * Reads the current weather. Returns null on any failure — no permission, no
 * network, no service — because a journal entry must save whether or not the
 * sky was reachable.
 */
export async function captureWeather() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { error: 'unsupported' };
  }
  // The failure that looks like a bug and isn't: browsers disable geolocation
  // entirely outside a secure context, so opening the dev server on a LAN IP
  // over plain HTTP makes this silently impossible. Named explicitly so it
  // reads as "this address isn't trusted" rather than "the weather is broken".
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return { error: 'insecure' };
  }
  try {
    const pos = await position();
    // Two decimal places ≈ 1km. Enough for weather, not enough to place her.
    const lat = pos.coords.latitude.toFixed(2);
    const lon = pos.coords.longitude.toFixed(2);

    const url = `${ENDPOINT}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const cur = data?.current;
    if (!cur || typeof cur.weather_code !== 'number') return null;

    const cond = describeCode(cur.weather_code);
    const out = {
      error: null,
      code: cur.weather_code,
      id: cond.id,
      label: cond.label,
      mood: cond.mood,
      tempC: typeof cur.temperature_2m === 'number' ? Math.round(cur.temperature_2m) : null,
      isDay: cur.is_day !== 0,
      capturedAt: new Date().toISOString(),
    };
    remember(out);
    return out;
  } catch (err) {
    // 1 === PERMISSION_DENIED. Worth distinguishing: she can undo a denial,
    // but only if she is told that is what happened.
    if (err && err.code === 1) return { error: 'denied' };
    return { error: 'failed' };
  }
}

const LAST_KEY = 'amruni_last_weather';
// A sky older than this is no longer the sky she is writing under.
const LAST_MAX_AGE_MS = 3 * 60 * 60 * 1000;

/** Remembers the last sky we successfully read. */
function remember(w) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify(w)); } catch { /* private mode */ }
}

/** The last sky, if it is recent enough to still be true. */
export function lastWeather() {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return null;
    const w = JSON.parse(raw);
    if (!w?.capturedAt) return null;
    if (Date.now() - new Date(w.capturedAt).getTime() > LAST_MAX_AGE_MS) return null;
    return w;
  } catch {
    return null;
  }
}

/**
 * The weather for an entry, by default and without being asked for.
 *
 * Tries for a fresh reading and falls back to the last recent one, so a
 * flaky network, a slow GPS fix or a moment underground doesn't cost her the
 * sky — which is the whole point of "remember it every time". Returns null
 * only when there is genuinely nothing to record.
 */
export async function weatherForEntry() {
  const fresh = await captureWeather();
  if (fresh && !fresh.error) return fresh;
  return lastWeather();
}

/** A human sentence for each way this can fail. */
export function weatherError(result) {
  switch (result?.error) {
    case 'insecure':
      return 'Weather needs a secure (https) connection. It will work once the app is published.';
    case 'denied':
      return 'Location is turned off for this site, so the weather can’t be added.';
    case 'unsupported':
      return 'This browser can’t provide location, so the weather can’t be added.';
    case 'failed':
      return 'Could not reach the weather service. Your entry is unaffected.';
    default:
      return '';
  }
}

/**
 * Dev-only: `?sky=wet-day` forces a sky onto an entry that has none, so a
 * condition can be looked at without waiting for the weather to oblige.
 * Returns null in production and when the parameter is absent.
 */
export function devSky() {
  if (!import.meta.env?.DEV || typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('sky');
  if (!raw) return null;
  const [mood, part] = raw.split('-');
  const known = ['bright', 'grey', 'wet', 'storm', 'cold'];
  if (!known.includes(mood)) return null;
  const isDay = part !== 'night';
  return {
    mood,
    isDay,
    id: mood,
    label: { bright: 'Clear', grey: 'Overcast', wet: 'Rain', storm: 'Thunderstorm', cold: 'Cold' }[mood],
    tempC: 24,
    code: 0,
    capturedAt: new Date().toISOString(),
  };
}

/** One short line: "Rain · 24°". Never a paragraph — it is background. */
export function weatherLine(w) {
  if (!w) return '';
  return [w.label, w.tempC != null ? `${w.tempC}°` : null].filter(Boolean).join(' · ');
}
