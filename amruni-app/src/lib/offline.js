import { api } from '../services/api';

/**
 * Working without a signal.
 *
 * The premise of this app is a woman in India on a phone, and that phone is
 * regularly on a network that drops in a lift, a basement, a village, or a
 * hospital corridor. Every write in the product used to fail outright there —
 * her cycle log, a journal entry, an emergency contact — and failed writes are
 * how a health app loses the trust it spent months earning.
 *
 * Two pieces:
 *
 *   · An **outbox**. A mutation is written to localStorage first and sent
 *     second. If the send fails it stays queued and is retried when the
 *     connection returns, so the action is never lost and she is never asked
 *     to retype it.
 *
 *   · A **read cache**. GETs are cached by URL, so opening Track or the
 *     journal offline shows what she saw last time rather than an error.
 *
 * What is deliberately NOT queued: the emergency alert itself. A drill or an
 * SOS that silently waits for a signal is worse than one that fails loudly —
 * she has to know, in the moment, that it did not go out.
 */

const OUTBOX_KEY = 'amruni_outbox';
const CACHE_KEY = 'amruni_read_cache';
const MAX_CACHE_ENTRIES = 120;

let flushing = false;
const listeners = new Set();

// ── storage helpers ──────────────────────────────────────────
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private mode. Losing the cache is survivable; losing the outbox
    // means one action is dropped, which is why the outbox is trimmed first.
  }
}

export function outbox() {
  return read(OUTBOX_KEY, []);
}

export function pendingCount() {
  return outbox().length;
}

export function onSyncChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  const n = pendingCount();
  listeners.forEach((fn) => { try { fn(n); } catch { /* a bad listener can't break sync */ } });
}

// ── the outbox ───────────────────────────────────────────────

/**
 * Sends a mutation, or keeps it until it can be sent.
 *
 * Returns the server's response when online, and the caller's `optimistic`
 * value when not — so the UI can move on either way. Callers that need to know
 * check `.pending`.
 */
export async function queueMutation({ method, url, body, optimistic }) {
  const entry = { id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, method, url, body, at: Date.now() };

  if (navigator.onLine) {
    try {
      const { data } = await api.request({ method, url, data: body });
      return data;
    } catch (err) {
      // A rejection the server will reject again — a validation error, a
      // deleted row — must not sit in the queue retrying forever.
      const status = err?.response?.status;
      if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) throw err;
    }
  }

  write(OUTBOX_KEY, [...outbox(), entry]);
  notify();
  return optimistic ?? { pending: true };
}

/** Sends everything queued, oldest first, stopping at the first failure. */
export async function flushOutbox() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    let queue = outbox();
    while (queue.length) {
      const [next, ...rest] = queue;
      try {
        await api.request({ method: next.method, url: next.url, data: next.body });
      } catch (err) {
        const status = err?.response?.status;
        // Permanently rejected: drop it rather than block everything behind it.
        if (!(status && status >= 400 && status < 500 && status !== 408 && status !== 429)) break;
      }
      queue = rest;
      write(OUTBOX_KEY, queue);
      notify();
    }
  } finally {
    flushing = false;
  }
}

// ── the read cache ───────────────────────────────────────────

export function cacheRead(url, data) {
  const cache = read(CACHE_KEY, {});
  cache[url] = { data, at: Date.now() };
  const keys = Object.keys(cache);
  if (keys.length > MAX_CACHE_ENTRIES) {
    keys.sort((a, b) => cache[a].at - cache[b].at)
      .slice(0, keys.length - MAX_CACHE_ENTRIES)
      .forEach((k) => delete cache[k]);
  }
  write(CACHE_KEY, cache);
}

export function cachedRead(url) {
  return read(CACHE_KEY, {})[url] ?? null;
}

export function clearOfflineData() {
  write(OUTBOX_KEY, []);
  write(CACHE_KEY, {});
  notify();
}

// ── wiring ───────────────────────────────────────────────────
export function startOfflineSync() {
  window.addEventListener('online', flushOutbox);
  // Coming back to the app after it was backgrounded is the other moment a
  // connection has usually returned.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flushOutbox();
  });
  flushOutbox();
}
