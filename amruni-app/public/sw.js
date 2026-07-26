/* Amruni service worker.
 *
 * The app already installs as a PWA — there is a manifest — but without this it
 * installed as an app that shows a blank screen the moment the network drops.
 * On the connections this product actually runs on, that is most of the point
 * of installing it.
 *
 * Two strategies, chosen by what the request is:
 *
 *   · App shell (HTML, JS, CSS, icons) — cache first, revalidate in the
 *     background. Opening the app offline gets last-known-good instantly.
 *   · API calls — network first, never served stale from here. Data freshness
 *     is handled in the app (lib/offline.js), which knows what is safe to show
 *     from cache and what is not; a service worker guessing at that would show
 *     someone yesterday's appointment as if it were today's.
 */

const VERSION = 'v1';
const SHELL = `amruni-shell-${VERSION}`;
const RUNTIME = `amruni-runtime-${VERSION}`;

const PRECACHE = ['/', '/index.html', '/manifest.json', '/icon.svg', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      // Individually, so one missing file cannot fail the whole install.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API: straight to the network. The app handles the offline case itself.
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: serve the shell so a deep link opens offline. The SPA router
  // takes it from there.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    );
    return;
  }

  // Assets: cache first, refresh behind it. Vite filenames are hashed, so a
  // cached asset is never a stale version of a different file.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
