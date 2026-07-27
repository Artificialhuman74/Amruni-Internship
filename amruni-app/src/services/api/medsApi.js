import { api } from './api'
import { queueMutation } from '../offline'

/**
 * Medicines and doses.
 *
 * Marking a dose taken goes through the outbox: she takes a tablet when she
 * takes it, not when the network agrees. A tick that fails because she is in a
 * lift teaches her the record is unreliable, and an unreliable adherence
 * record is worse than none — a doctor may act on it.
 */
export const medsApi = {
  list: async () => (await api.get('/me/medications')).data,
  adherence: async (days = 14) => (await api.get('/me/medications/adherence', { params: { days } })).data,
  add: async (med) => (await api.post('/me/medications', med)).data,
  update: async (id, med) => (await api.patch(`/me/medications/${id}`, med)).data,
  stop: async (id) => queueMutation({ method: 'post', url: `/me/medications/${id}/stop`, optimistic: { success: true } }),
  take: async (id, date, slot) => queueMutation({
    method: 'post',
    url: `/me/medications/${id}/doses`,
    body: { date, slot },
    optimistic: { success: true },
  }),
  undo: async (id, date, slot) => queueMutation({
    method: 'delete',
    url: `/me/medications/${id}/doses?date=${encodeURIComponent(date)}&slot=${encodeURIComponent(slot)}`,
    optimistic: { success: true },
  }),
};
