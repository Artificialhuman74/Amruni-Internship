import { api } from './api';

/**
 * Consultation intake forms (homeopathy, ayurveda).
 *
 * A submission is a versioned snapshot rather than a mutable row: she can fill
 * the form again before a later consultation and the practitioner reads what
 * she said *then*, not an answer she has since revised. `latest` is what the
 * app shows her; the doctor console reads the whole history.
 */
export const intakeApi = {
  list: async () => (await api.get('/intake')).data,
  latest: async (formId) => (await api.get(`/intake/${formId}/latest`)).data,
  submit: async ({ formId, answers, skippedSections, prakriti, appointmentId }) =>
    (await api.post(`/intake/${formId}`, {
      answers,
      skippedSections: skippedSections ?? [],
      prakriti: prakriti ?? null,
      appointmentId: appointmentId ?? null,
    })).data,
  remove: async (id) => (await api.delete(`/intake/${id}`)).data,
};
