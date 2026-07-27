import { api } from './api'

export const videoApi = {
  createRoom: async (appointmentId) =>
    (await api.post('/video/rooms', { appointmentId })).data,

  joinRoom: async (roomId) =>
    (await api.post(`/video/rooms/${roomId}/join`)).data,
};
