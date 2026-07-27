import axios from 'axios';

// The doctor console keeps its own session, separate from the patient app,
// so a doctor can stay signed into both on one device.
const DOCTOR_TOKEN_KEY = 'amruni_doctor_token';
const DOCTOR_PROFILE_KEY = 'amruni_doctor_profile';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

export function getDoctorToken() {
  return localStorage.getItem(DOCTOR_TOKEN_KEY);
}

export function setDoctorSession(token, doctor) {
  if (token) {
    localStorage.setItem(DOCTOR_TOKEN_KEY, token);
    localStorage.setItem(DOCTOR_PROFILE_KEY, JSON.stringify(doctor || null));
  } else {
    localStorage.removeItem(DOCTOR_TOKEN_KEY);
    localStorage.removeItem(DOCTOR_PROFILE_KEY);
  }
}

export function getCachedDoctor() {
  try {
    return JSON.parse(localStorage.getItem(DOCTOR_PROFILE_KEY) || 'null');
  } catch {
    return null;
  }
}

client.interceptors.request.use((config) => {
  const token = getDoctorToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('verify-otp')) {
      setDoctorSession(null);
    }
    return Promise.reject(err);
  }
);

export function doctorApiError(err, fallback = 'Something went wrong. Please try again.') {
  if (err.response?.data?.error) return err.response.data.error;
  if (err.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection.';
  return fallback;
}

export const doctorApi = {
  requestOtp: async (phone) => (await client.post('/auth/request-otp', { phone })).data,

  verifyOtp: async (phone, code) => {
    const data = (await client.post('/doctor/verify-otp', { phone, code })).data;
    setDoctorSession(data.token, data.doctor);
    return data;
  },

  me: async () => (await client.get('/doctor/me')).data,

  appointments: async () => (await client.get('/doctor/appointments')).data,

  // availability
  slots: async () => (await client.get('/doctor/slots')).data,
  publishSlots: async (range) => (await client.post('/doctor/slots', range)).data,
  deleteSlot: async (slotId) => (await client.delete(`/doctor/slots/${slotId}`)).data,

  // consultation records
  getRecord: async (appointmentId) =>
    (await client.get(`/doctor/appointments/${appointmentId}/record`)).data,
  saveRecord: async (appointmentId, record) =>
    (await client.put(`/doctor/appointments/${appointmentId}/record`, record)).data,

  // patients & charts
  patients: async () => (await client.get('/doctor/patients')).data,
  chart: async (userId) => (await client.get(`/doctor/patients/${userId}/chart`)).data,
  updateChart: async (userId, flags) =>
    (await client.put(`/doctor/patients/${userId}/chart`, flags)).data,

  // documents
  uploadDocument: async (userId, doc) =>
    (await client.post(`/doctor/patients/${userId}/documents`, doc)).data,
  getDocument: async (userId, docId) =>
    (await client.get(`/doctor/patients/${userId}/documents/${docId}`)).data,
  deleteDocument: async (userId, docId) =>
    (await client.delete(`/doctor/patients/${userId}/documents/${docId}`)).data,
};
