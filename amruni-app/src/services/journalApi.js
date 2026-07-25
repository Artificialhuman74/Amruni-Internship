import { api } from './api';

export const journalApi = {
  list: async () => (await api.get('/journal')).data,
  create: async ({ date, text, tags }) => (await api.post('/journal', { date, text, tags })).data,
  update: async (id, { date, text, tags }) => (await api.patch(`/journal/${id}`, { date, text, tags })).data,
  remove: async (id) => (await api.delete(`/journal/${id}`)).data,
  // Publishes a copy of the entry as a community post; the private original
  // is untouched (see server/app/routes_community.py's share_journal).
  share: async (id, { isAnonymous }) => (await api.post(`/journal/${id}/share`, { isAnonymous })).data,
};
