import axios from 'axios';

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

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Expired/invalid session: drop the token so route guards send the user
    // back through the OTP flow. Auth endpoints handle their own 401s, and a
    // request carrying an admin key drops that instead of the user session.
    if (err.response?.status === 401 && !err.config?.url?.startsWith('/auth/') && !err.config?.url?.startsWith('/admin/')) {
      if (err.config?.headers?.['X-Admin-Key']) setAdminToken(null);
      else setToken(null);
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
  get: async () => (await api.get('/me')).data,
  patch: async (profile) => (await api.patch('/me', profile)).data,
  syncState: async (state) => (await api.put('/me/state', state)).data,
  saveScreening: async ({ tool, score, answers }) => (await api.post('/me/screenings', { tool, score, answers })).data,
};
