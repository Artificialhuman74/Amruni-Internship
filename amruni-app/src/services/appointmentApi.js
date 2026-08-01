import { api } from './api';

export const appointmentApi = {
  getDoctors: async () => (await api.get('/doctors')).data,

  getDoctorById: async (id) => (await api.get(`/doctors/${id}`)).data,

  // ---- availability slots ----

  getSlots: async (doctorId) => (await api.get(`/doctors/${doctorId}/slots`)).data,

  getAllSlots: async (doctorId) =>
    (await api.get(`/doctors/${doctorId}/slots`, { params: { all: true } })).data,

  publishSlots: async (doctorId, range) =>
    (await api.post(`/doctors/${doctorId}/slots`, range)).data,

  deleteSlot: async (slotId) => (await api.delete(`/slots/${slotId}`)).data,

  // ---- booking + payment ----

  // Video: { slotId, mode: 'video', reason } — locks the slot.
  // Chat:  { doctorId, mode: 'chat', reason } — instant.
  // Returns { appointmentId, payment: { paymentId, provider, orderId, amount, keyId } }.
  createBooking: async ({ slotId, doctorId, mode, reason, anonymous }) =>
    (await api.post('/bookings', { slotId, doctorId, mode, reason, anonymous })).data,

  // Confirms payment; server verifies, books the slot, and generates the
  // Google Meet link. Returns the confirmed appointment (with meetLink).
  confirmPayment: async (paymentId, details = {}) =>
    (await api.post(`/payments/${paymentId}/confirm`, details)).data,

  // ---- appointments ----

  getMyAppointments: async () => (await api.get('/appointments')).data,

  getAppointment: async (appointmentId) => {
    try {
      return (await api.get(`/appointments/${appointmentId}`)).data;
    } catch (err) {
      if (err.response?.status === 404) return null;
      throw err;
    }
  },

  cancelAppointment: async (appointmentId) =>
    (await api.delete(`/appointments/${appointmentId}`)).data,

  completeAppointment: async (appointmentId) =>
    (await api.post(`/appointments/${appointmentId}/complete`)).data,

  // ---- doctor management (admin) ----

  addDoctor: async (doctor) => (await api.post('/doctors', doctor)).data,

  deleteDoctor: async (id) => (await api.delete(`/doctors/${id}`)).data,
};
