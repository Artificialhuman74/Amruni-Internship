/**
 * Reminders.
 *
 * Settings has had a "Push notifications" switch since the beginning that
 * wrote a boolean and did nothing else — no permission request, no scheduler,
 * no notification ever sent. Everything the product built depends on her
 * remembering unprompted: a dose, a follow-up date, an appointment tomorrow.
 *
 * What this does: asks for permission properly, and fires local reminders for
 * doses due today while the app is running or backgrounded — the common case,
 * since the phone is usually in her hand or her pocket.
 *
 * What this deliberately does NOT pretend to do: deliver a reminder after the
 * browser has fully closed the page. That needs Web Push — VAPID keys, stored
 * subscriptions and a server-side scheduler. `subscribeToPush` below is the
 * client half, ready for that server; until it exists it fails quietly rather
 * than claiming a delivery it can't make.
 */

const LEAD_MINUTES = 0;     // fire at the scheduled time, not before
const CHECK_INTERVAL = 60_000;
const FIRED_KEY = 'amruni_fired_reminders';

let timer = null;

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** The real permission state, not the stored preference. */
export function permissionState() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;   // 'granted' | 'denied' | 'default'
}

/**
 * Asks, once, at the moment she turns reminders on — never on app open. A
 * permission prompt fired at launch, before the app has done anything for her,
 * is the reliable way to get a permanent "block".
 */
export async function requestPermission() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

// Reminders already sent today, so re-opening the app doesn't re-fire them.
function firedToday() {
  try {
    const raw = JSON.parse(localStorage.getItem(FIRED_KEY) || '{}');
    const today = new Date().toISOString().slice(0, 10);
    return raw.date === today ? new Set(raw.keys) : new Set();
  } catch {
    return new Set();
  }
}

function markFired(key) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const set = firedToday();
    set.add(key);
    localStorage.setItem(FIRED_KEY, JSON.stringify({ date: today, keys: [...set] }));
  } catch { /* private mode */ }
}

async function show(title, body, tag) {
  if (permissionState() !== 'granted') return;
  try {
    // Through the service worker where possible — those notifications survive
    // the tab being backgrounded, which a `new Notification()` may not.
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg?.showNotification) {
      await reg.showNotification(title, { body, tag, icon: '/icon.svg', badge: '/icon.svg' });
      return;
    }
    new Notification(title, { body, tag, icon: '/icon.svg' });
  } catch { /* a blocked notification must never break the app */ }
}

/**
 * A notification that fires at most once for a given key.
 *
 * The key carries its own date (`fertile-open-2026-08-04`), so "once" means
 * once for that event rather than once ever — and re-opening the app, or
 * having it open across midnight, cannot re-fire it.
 */
export async function notifyOnce(key, title, body) {
  if (!key || permissionState() !== 'granted') return false;
  if (firedToday().has(key)) return false;
  await show(title, body, key);
  markFired(key);
  return true;
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Starts the reminder loop.
 *
 * `getDue` returns the doses scheduled today: [{ medicationId, name, time,
 * taken }]. Anything already ticked is skipped — being reminded to take
 * something you have taken is how a reminder becomes noise.
 */
export function startReminders(getDue) {
  stopReminders();
  if (permissionState() !== 'granted') return;

  const tick = async () => {
    let due;
    try { due = await getDue(); } catch { return; }
    if (!Array.isArray(due)) return;

    const fired = firedToday();
    const now = nowHHMM();
    for (const dose of due) {
      if (dose.taken) continue;
      const key = `${dose.medicationId}:${dose.time}`;
      if (fired.has(key)) continue;
      if (dose.time > now) continue;               // not due yet
      // More than two hours late is not a reminder any more, it's a nag about
      // a moment that has passed.
      if (minutesBetween(dose.time, now) > 120 + LEAD_MINUTES) continue;

      await show(
        'Time for your medicine',
        `${dose.name}${dose.dose ? ` · ${dose.dose}` : ''}`,
        `med-${key}`,
      );
      markFired(key);
    }
  };

  tick();
  timer = setInterval(tick, CHECK_INTERVAL);
}

export function stopReminders() {
  if (timer) { clearInterval(timer); timer = null; }
}

function minutesBetween(a, b) {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return (bh * 60 + bm) - (ah * 60 + am);
}

/**
 * Client half of real Web Push. Returns null until a server exposes a VAPID
 * key and a place to store the subscription — deliberately silent rather than
 * throwing, because the absence of a push server is a missing feature and not
 * an error she should see.
 */
export async function subscribeToPush() {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!key || permissionState() !== 'granted') return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    });
  } catch {
    return null;
  }
}
