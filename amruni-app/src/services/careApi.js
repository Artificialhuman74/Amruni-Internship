import { api } from './api';

/** Care shares. `view` is the only call that needs no session — the recipient
 *  is a family member holding a link, not an account holder. */
export const careApi = {
  list: async () => (await api.get('/me/care/shares')).data,
  create: async ({ label, scopes, expiresInDays }) =>
    (await api.post('/me/care/shares', { label, scopes, expiresInDays })).data,
  revoke: async (token) => (await api.delete(`/me/care/shares/${token}`)).data,
  view: async (token) => (await api.get(`/care/${token}`)).data,
  slots: async (token) => (await api.get(`/care/${token}/slots`)).data,
  book: async (token, { slotId, reason }) =>
    (await api.post(`/care/${token}/book`, { slotId, reason })).data,
  // The caretaker settles it from her own card. Only ever a payment this link
  // created — the server checks the token owns it.
  confirmPayment: async (token, paymentId, details = {}) =>
    (await api.post(`/care/${token}/payments/${paymentId}/confirm`, details)).data,
  // What a caretaker can actually do, beyond reading.
  markDose: async (token, medId, { slot, date }) =>
    (await api.post(`/care/${token}/medicines/${medId}/taken`, { slot, date })).data,
  note: async (token, text) => (await api.post(`/care/${token}/notes`, { text })).data,
  // Her side of the same thread.
  events: async () => (await api.get('/me/care/events')).data,
  markRead: async () => (await api.post('/me/care/events/read')).data,
};

/** The link she actually sends. The token is the only identifier in it. */
export function shareUrl(token) {
  return `${window.location.origin}/care/${token}`;
}
