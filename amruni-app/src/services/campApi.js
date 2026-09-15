import { api } from './api';

/** Health camps. Listing is public; create, edit and delete need the admin key. */
export const campApi = {
  types: async () => (await api.get('/camps/types')).data,
  recent: async () => (await api.get('/camps')).data,
  all: async () => (await api.get('/camps', { params: { scope: 'all' } })).data,
  get: async (id) => (await api.get(`/camps/${id}`)).data,
  create: async (camp) => (await api.post('/camps', camp)).data,
  update: async (id, camp) => (await api.put(`/camps/${id}`, camp)).data,
  remove: async (id) => (await api.delete(`/camps/${id}`)).data,
};
