import { api } from './api';

/** Her health history, her documents, and the sharing decisions around them. */
export const historyApi = {
  get: async () => (await api.get('/me/history')).data,
  addItem: async (category, data) => (await api.post('/me/history/items', { category, data })).data,
  updateItem: async (id, category, data) => (await api.put(`/me/history/items/${id}`, { category, data })).data,
  removeItem: async (id) => (await api.delete(`/me/history/items/${id}`)).data,

  uploadDocument: async ({ title, kind, data }) => (await api.post('/me/documents', { title, kind, data })).data,
  getDocument: async (id) => (await api.get(`/me/documents/${id}`)).data,
  removeDocument: async (id) => (await api.delete(`/me/documents/${id}`)).data,

  requests: async () => (await api.get('/me/history-requests')).data,
  respond: async (id, allow, categories) =>
    (await api.post(`/me/history-requests/${id}/respond`, { allow, categories })).data,

  getShare: async (appointmentId) => (await api.get(`/me/appointments/${appointmentId}/history-share`)).data,
  setShare: async (appointmentId, share) => (await api.put(`/me/appointments/${appointmentId}/history-share`, share)).data,
};
