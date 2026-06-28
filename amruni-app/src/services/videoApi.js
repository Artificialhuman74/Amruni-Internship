/**
 * Mock APIs for video room management
 */
export const videoApi = {
  createRoom: async (appointmentId) => {
    // Simulate network delay
    console.log(`Generating room for appointment: ${appointmentId}`);
    await new Promise((resolve) => setTimeout(resolve, 600));
    
    const roomId = 'room_' + Math.random().toString(36).substring(2, 9);
    const meetingUrl = `https://meet.amruni.in/${roomId}`;
    
    return {
      meetingId: roomId,
      meetingUrl,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
  },

  joinRoom: async (roomId) => {
    console.log(`Connecting to room: ${roomId}`);
    await new Promise((resolve) => setTimeout(resolve, 400));
    return {
      success: true,
      participantId: 'p_' + Math.random().toString(36).substring(2, 6),
    };
  }
};
