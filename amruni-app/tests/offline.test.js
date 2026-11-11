import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';

function makeStorage() {
  const store = new Map();
  return {
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] ?? null,
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
}

globalThis.localStorage = makeStorage();
globalThis.sessionStorage = makeStorage();
globalThis.window = { addEventListener: () => {}, location: { href: 'http://localhost/' } };
globalThis.document = { addEventListener: () => {}, visibilityState: 'visible' };
Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true },
  configurable: true,
});

registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.js`, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('/src/services/api.js')) {
      const source = fs.readFileSync(new URL(url), 'utf8').replaceAll(
        'import.meta.env',
        '({ DEV: true, VITE_API_URL: "" })',
      );
      return { format: 'module', source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const { api, setToken, getToken, setAdminToken, getAdminToken } = await import('../src/services/api.js');
const {
  cacheRead,
  cachedRead,
  isCacheableUrl,
  clearOfflineData,
  pendingCount,
  purgeLegacyCacheOnce,
  startOfflineSync,
} = await import('../src/lib/offline.js');

function storedCache() {
  const raw = globalThis.localStorage.getItem('amruni_read_cache');
  return raw ? JSON.parse(raw) : {};
}

test('isCacheableUrl allows only public catalog URL shapes', () => {
  const allowed = [
    '/health',
    '/api/health',
    '/doctors',
    '/doctors?specialty=gynecology',
    '/api/doctors',
    'doctors',
    'https://amruni-api-production.up.railway.app/api/doctors',
    '/doctors/7',
    '/doctors/7/',
    '/doctors/7/slots',
    '/doctors/7/slots?all=true',
    '/api/doctors/7/slots?date=2026-10-01',
    '/camps',
    '/camps?scope=all',
    '/camps/types',
    '/camps/camp_abc123',
  ];
  for (const url of allowed) {
    assert.equal(isCacheableUrl(url), true, `expected allowlisted URL to match: ${url}`);
  }
});

test('isCacheableUrl rejects all PHI, user-scoped, and traversal URLs', () => {
  const blocked = [
    '/me',
    '/me/',
    '/api/me',
    '/me/cycle/predictions',
    '/me/conditions',
    '/me/history',
    '/me/documents/doc_1',
    '/me/appointments/appt_1/history-share',
    '/me/history-requests',
    '/me/medications',
    '/me/medications/adherence?days=14',
    '/me/care/shares',
    '/me/care/events',
    '/me/sos/contacts',
    '/me/sos/alerts',
    '/appointments',
    '/appointments/appt_1',
    '/journal',
    '/mood',
    '/mood?since=2026-01-01',
    '/mood/vocabulary',
    '/mood/insights',
    '/insurance',
    '/insurance/summary',
    '/insurance/receipt/appt_1',
    '/intake',
    '/intake/pcos/latest',
    '/care/share_tok_123',
    '/care/share_tok_123/slots',
    '/community/tags',
    '/community/feed?tag=pcos',
    '/community/posts/post_1',
    '/doctor/me',
    '/doctor/patients/5/chart',
    '/doctor/appointments/appt_1/record',
    '/doctors/../me',
    '/doctors/%2e%2e/me',
    '/doctors/1%2fslots',
    '/doctors/1/extra',
    '//evil.example/doctors',
    '',
    null,
    undefined,
  ];
  for (const url of blocked) {
    assert.equal(isCacheableUrl(url), false, `expected URL to be rejected: ${String(url)}`);
  }
});

test('cacheRead and cachedRead ignore pre-existing or new non-allowlisted entries', () => {
  globalThis.localStorage.clear();
  clearOfflineData();

  // Simulate a stale sensitive cache entry present before allowlist enforcement.
  globalThis.localStorage.setItem(
    'amruni_read_cache',
    JSON.stringify({ '/me/history': { data: { secret: 'phi' }, at: 1 } }),
  );
  assert.equal(cachedRead('/me/history'), null);

  cacheRead('/journal', [{ text: 'private entry' }]);
  assert.equal(storedCache()['/journal'], undefined);

  cacheRead('/doctors/3/slots', [{ id: 10 }]);
  assert.deepEqual(cachedRead('/doctors/3/slots')?.data, [{ id: 10 }]);
});

test('real api.js interceptors cache only allowlisted GET URL shapes and fall back offline', async () => {
  globalThis.localStorage.clear();
  const originalAdapter = api.defaults.adapter;

  try {
    let offline = false;
    api.defaults.adapter = async (config) => {
      if (offline) {
        const err = new Error('Network Error');
        err.code = 'ERR_NETWORK';
        err.config = config;
        throw err;
      }
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        data: { url: config.url, ok: true },
      };
    };

    // Real URL shapes sent by appointmentApi.js, campApi.js, api.js, journalApi.js, careApi.js, moodApi.js, communityApi.js
    await api.get('/doctors');
    await api.get('/doctors/12');
    await api.get('/doctors/12/slots', { params: { all: true } });
    await api.get('/camps', { params: { scope: 'all' } });
    await api.get('/camps/types');
    await api.get('/camps/camp_9');

    await api.get('/me');
    await api.get('/me/cycle/predictions');
    await api.get('/appointments/appt_42');
    await api.get('/journal');
    await api.get('/mood/vocabulary');
    await api.get('/insurance');
    await api.get('/intake/ayurveda/latest');
    await api.get('/care/tok_secret');
    await api.get('/community/feed', { params: { tag: 'pcos', limit: 20 } });

    const keys = Object.keys(storedCache()).sort();
    assert.deepEqual(keys, [
      '/camps',
      '/camps/camp_9',
      '/camps/types',
      '/doctors',
      '/doctors/12',
      '/doctors/12/slots',
    ]);

    // When offline, allowlisted endpoints serve cached fallback, while sensitive endpoints reject.
    offline = true;
    const cachedDoctors = await api.get('/doctors');
    assert.equal(cachedDoctors.fromCache, true);
    assert.deepEqual(cachedDoctors.data, { url: '/doctors', ok: true });

    const cachedSlots = await api.get('/doctors/12/slots', { params: { all: true } });
    assert.equal(cachedSlots.fromCache, true);

    await assert.rejects(() => api.get('/me'));
    await assert.rejects(() => api.get('/appointments/appt_42'));
    await assert.rejects(() => api.get('/journal'));
    await assert.rejects(() => api.get('/care/tok_secret'));
  } finally {
    api.defaults.adapter = originalAdapter;
  }
});

function seedSensitiveStorage() {
  globalThis.localStorage.setItem('amruni_token', 'tok_user_1');
  globalThis.localStorage.setItem(
    'amruni_read_cache',
    JSON.stringify({ '/doctors': { data: [{ id: 1 }], at: 1 } }),
  );
  globalThis.localStorage.setItem(
    'amruni_outbox',
    JSON.stringify([{ id: 'q_1', method: 'post', url: '/journal', body: { text: 'note' }, at: 1 }]),
  );
  globalThis.localStorage.setItem('amruni_samadhana_draft', JSON.stringify({ answers: { a: 'b' } }));
  globalThis.localStorage.setItem('amruni_intake_draft_ayurveda', JSON.stringify({ answers: { q1: 'yes' } }));
  globalThis.localStorage.setItem('amruni_intake_draft_pcos', JSON.stringify({ answers: { q2: 'no' } }));
  globalThis.localStorage.setItem('amruni_bloom_seen', '1');
  globalThis.sessionStorage.setItem('amruni_journal_draft', JSON.stringify({ text: 'private draft', tags: [] }));
}

function assertSensitiveStorageCleared() {
  assert.equal(globalThis.localStorage.getItem('amruni_read_cache'), null);
  assert.equal(globalThis.localStorage.getItem('amruni_outbox'), null);
  assert.equal(globalThis.localStorage.getItem('amruni_samadhana_draft'), null);
  assert.equal(globalThis.localStorage.getItem('amruni_intake_draft_ayurveda'), null);
  assert.equal(globalThis.localStorage.getItem('amruni_intake_draft_pcos'), null);
  assert.equal(globalThis.sessionStorage.getItem('amruni_journal_draft'), null);
  assert.equal(pendingCount(), 0);
}

test('clearOfflineData and authenticated logout clear cache, outbox, and all draft keys', () => {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();

  // Calling setToken(null) when already signed out keeps public allowlisted cache intact.
  cacheRead('/doctors', [{ id: 7 }]);
  setToken(null);
  assert.deepEqual(cachedRead('/doctors')?.data, [{ id: 7 }]);

  // Signing out from an authenticated session purges cache, outbox, and drafts.
  seedSensitiveStorage();
  setToken(null);
  assert.equal(getToken(), null);
  assertSensitiveStorageCleared();
  assert.equal(globalThis.localStorage.getItem('amruni_bloom_seen'), '1');

  // Direct clearOfflineData() also purges everything even without an active token.
  seedSensitiveStorage();
  globalThis.localStorage.removeItem('amruni_token');
  clearOfflineData();
  assertSensitiveStorageCleared();
});

test('HTTP 401 on patient API purges cache, outbox, and drafts while ignoring auth/admin flows', async () => {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  const originalAdapter = api.defaults.adapter;

  try {
    api.defaults.adapter = async (config) => {
      const err = new Error('Unauthorized');
      err.config = config;
      err.response = { status: 401, data: { detail: 'unauthorized' } };
      throw err;
    };

    seedSensitiveStorage();
    setAdminToken('admin_tok_1');

    // Auth 401 (e.g. bad OTP) must not purge patient cache/drafts.
    await assert.rejects(() => api.post('/auth/verify-otp', { code: '0000' }));
    assert.equal(getToken(), 'tok_user_1');
    assert.notEqual(globalThis.localStorage.getItem('amruni_read_cache'), null);
    assert.notEqual(globalThis.sessionStorage.getItem('amruni_journal_draft'), null);

    // Admin-key 401 clears admin token only.
    await assert.rejects(() => api.get('/some-endpoint', { headers: { 'X-Admin-Key': 'bad' } }));
    assert.equal(getAdminToken(), null);
    assert.equal(getToken(), 'tok_user_1');
    assert.notEqual(globalThis.localStorage.getItem('amruni_outbox'), null);

    // Patient session 401 clears token plus cache, outbox, and all drafts.
    await assert.rejects(() => api.get('/me'));
    assert.equal(getToken(), null);
    assertSensitiveStorageCleared();
  } finally {
    api.defaults.adapter = originalAdapter;
  }
});

test('startOfflineSync purges legacy cache keys once on app load and preserves subsequent allowlisted reads', () => {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();

  globalThis.localStorage.setItem(
    'amruni_read_cache',
    JSON.stringify({ '/me': { data: { phone: '+919999999999' }, at: 1 } }),
  );
  globalThis.localStorage.setItem('amruni_appointments', JSON.stringify([{ id: 'old' }]));
  globalThis.localStorage.setItem('amruni_doctors_v4', JSON.stringify([{ id: 'old_doc' }]));

  startOfflineSync();
  assert.equal(globalThis.localStorage.getItem('amruni_read_cache'), null);
  assert.equal(globalThis.localStorage.getItem('amruni_appointments'), null);
  assert.equal(globalThis.localStorage.getItem('amruni_doctors_v4'), null);
  assert.equal(purgeLegacyCacheOnce(), false);

  // Subsequent app loads must keep new allowlisted cache entries intact.
  cacheRead('/doctors', [{ id: 1, name: 'Dr. Kavita' }]);
  startOfflineSync();
  assert.deepEqual(cachedRead('/doctors')?.data, [{ id: 1, name: 'Dr. Kavita' }]);
});
