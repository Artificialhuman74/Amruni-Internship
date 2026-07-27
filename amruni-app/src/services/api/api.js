import axios from 'axios';
import { cacheRead, cachedRead } from '../offline'

const TOKEN_KEY = 'amruni_token';
const ADMIN_KEY = 'amruni_admin_token'; // sessionStorage: short-lived, per-tab

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getAdminToken() {
  return sessionStorage.getItem(ADMIN_KEY);
}

export function setAdminToken(token) {
  if (token) sessionStorage.setItem(ADMIN_KEY, token);
  else sessionStorage.removeItem(ADMIN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const adminToken = getAdminToken();
  if (adminToken) config.headers['X-Admin-Key'] = adminToken;
  return config;
});

// Reads are cached by URL as they succeed, and served from that cache when the
// network fails. Opening Track or the journal on a dead connection then shows
// what she saw last time — stale, but hers — instead of an error page. Writes
// are never served from cache; they go to the outbox (see lib/offline.js).
api.interceptors.response.use(
  (res) => {
    if ((res.config?.method ?? 'get').toLowerCase() === 'get' && res.config?.url) {
      cacheRead(res.config.url, res.data);
    }
    return res;
  },
  (err) => {
    // Expired/invalid session: drop the token so route guards send the user
    // back through the OTP flow. Auth endpoints handle their own 401s, and a
    // request carrying an admin key drops that instead of the user session.
    if (err.response?.status === 401 && !err.config?.url?.startsWith('/auth/') && !err.config?.url?.startsWith('/admin/')) {
      if (err.config?.headers?.['X-Admin-Key']) setAdminToken(null);
      else setToken(null);
    }

    // The network is gone, not the server saying no. If we've read this URL
    // before, hand back what we had — a month-old cycle log she can still read
    // beats a screen that says the app is broken.
    const isRead = (err.config?.method ?? 'get').toLowerCase() === 'get';
    if (isRead && !err.response && err.config?.url) {
      const hit = cachedRead(err.config.url);
      if (hit) {
        return Promise.resolve({
          data: hit.data,
          status: 200,
          config: err.config,
          fromCache: true,
          cachedAt: hit.at,
        });
      }
    }

    return Promise.reject(err);
  }
);

// Human-readable message for toasts/inline errors.
export function apiError(err, fallback = 'Something went wrong. Please try again.') {
  if (err.response?.data?.error) return err.response.data.error;
  if (err.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection.';
  return fallback;
}

export const authApi = {
  requestOtp: async (phone) => (await api.post('/auth/request-otp', { phone })).data,
  verifyOtp: async (phone, code) => (await api.post('/auth/verify-otp', { phone, code })).data,
  // Verifies the portal password server-side and stores the issued admin token.
  adminLogin: async (password) => {
    const { adminToken } = (await api.post('/admin/login', { password })).data;
    setAdminToken(adminToken);
    return adminToken;
  },
};

export const meApi = {
  putHealth: async (health) => (await api.put('/me/health', health)).data,
  get: async () => (await api.get('/me')).data,
  patch: async (profile) => (await api.patch('/me', profile)).data,
  syncState: async (state) => (await api.put('/me/state', state)).data,
  saveScreening: async ({ tool, score, answers }) => (await api.post('/me/screenings', { tool, score, answers })).data,
  putCycle: async (cycle) => (await api.put('/me/cycle', cycle)).data,
  // ML cycle predictions: period window, fertile days, history, symptom forecast, insights
  cyclePredictions: async () => (await api.get('/me/cycle/predictions')).data,
  // PCOS risk self-check (ML): { probability, band, topFactors, message }
  pcosScreening: async (answers) => (await api.post('/me/pcos-screening', answers)).data,
  // Patient-managed conditions (PCOS etc.)
  getConditions: async () => (await api.get('/me/conditions')).data,
  addCondition: async (condition) => (await api.post('/me/conditions', { condition })).data,
  removeCondition: async (condition) => (await api.delete(`/me/conditions/${encodeURIComponent(condition)}`)).data,
};
