import { api } from './api';

/**
 * State of Mind. Two scopes, matching how the check-in actually gets used:
 * `moment` for how she feels right now, `day` for how the whole day went.
 * Posting a `day` entry replaces the one already on that date (see
 * server/app/routes_mood.py) — the day has one summary, not a stack of them.
 */
export const moodApi = {
  list: async ({ since, until } = {}) => {
    const params = {};
    if (since) params.since = since;
    if (until) params.until = until;
    return (await api.get('/mood', { params })).data;
  },
  create: async ({ date, loggedAt, scope, valence, intensity, word, factors, source, journalId }) =>
    (await api.post('/mood', {
      date, loggedAt, scope, valence, word,
      // Where on the scale she actually stopped. `valence` is the named band
      // it rounds to and stays the unit everything else reasons about.
      intensity: intensity ?? valence,
      factors: factors ?? [],
      source: source ?? 'checkin',
      journalId: journalId ?? null,
    })).data,
  remove: async (id) => (await api.delete(`/mood/${id}`)).data,
  insights: async () => (await api.get('/mood/insights')).data,
  // Her own word and factor counts, so the check-in can offer hers first.
  vocabulary: async () => (await api.get('/mood/vocabulary')).data,
};
