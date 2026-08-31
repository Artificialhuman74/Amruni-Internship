import { api } from './api';

/**
 * Her coverage, and the claim receipts generated from it.
 *
 * One policy per account by design. A second policy sounds harmless until a
 * claim goes out under the wrong one, and a woman who genuinely holds two is
 * better served by editing the one on file before she books than by a picker
 * she has to get right under time pressure.
 */
export const insuranceApi = {
  get: async () => (await api.get('/insurance')).data,
  save: async (policy) => (await api.put('/insurance', policy)).data,
  remove: async () => (await api.delete('/insurance')).data,
  // Server-side assembly: it joins the policy to the consultation record so a
  // receipt cannot claim a diagnosis or an amount the client made up.
  receipt: async (appointmentId) => (await api.get(`/insurance/receipt/${appointmentId}`)).data,
};
