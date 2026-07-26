import { api } from './api';

/**
 * Private journal. An entry carries more than its text: the mood attached at
 * the time of writing, a snapshot of where she was in her cycle or pregnancy,
 * and whether she wants her doctor to see it at the next appointment.
 */
export const journalApi = {
  list: async () => (await api.get('/journal')).data,
  create: async (entry) => (await api.post('/journal', body(entry))).data,
  update: async (id, entry) => (await api.patch(`/journal/${id}`, body(entry))).data,
  remove: async (id) => (await api.delete(`/journal/${id}`)).data,
  // Publishes a copy of the entry as a community post; the private original
  // is untouched (see server/app/routes_community.py's share_journal).
  share: async (id, { isAnonymous }) => (await api.post(`/journal/${id}/share`, { isAnonymous })).data,
};

function body({ date, text, tags, moodLogId, context, bringToAppointment }) {
  return {
    date,
    text,
    tags: tags ?? [],
    moodLogId: moodLogId ?? null,
    context: context ?? {},
    bringToAppointment: Boolean(bringToAppointment),
  };
}
