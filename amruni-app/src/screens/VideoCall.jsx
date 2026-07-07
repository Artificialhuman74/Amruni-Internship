import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVideoCall } from '../hooks/useVideoCall';
import { appointmentApi } from '../services/appointmentApi';
import VideoPlayer from '../components/video/VideoPlayer';
import Controls from '../components/video/Controls';
import ChatPanel from '../components/video/ChatPanel';
import CallTimer from '../components/video/CallTimer';
import ConnectionStatus from '../components/video/ConnectionStatus';

export default function VideoCall() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { startCall, isCallActive, activeAppointment } = useVideoCall();
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    async function checkMeetLink() {
      let appt = activeAppointment;
      if (!appt && appointmentId) {
        try {
          appt = await appointmentApi.getAppointment(appointmentId);
        } catch (e) {
          console.error('Failed to load appointment details in video screen', e);
        }
      }
      if (appt?.doctor?.meetLink) {
        window.open(appt.doctor.meetLink, '_blank');
        navigate(`/consultation/${appointmentId}`, { replace: true });
      }
    }
    checkMeetLink();
  }, [activeAppointment, appointmentId, navigate]);

  useEffect(() => {
    // Start calling routines (including requesting camera permissions)
    const cleanup = startCall(appointmentId);
    
    // Safety redirect if appointment is invalid
    if (!appointmentId) {
      navigate('/consult');
    }

    return () => {
      if (cleanup && typeof cleanup === 'function') cleanup();
    };
  }, [appointmentId, navigate, startCall]);

  if (!isCallActive) {
    return (
      <div className="screen screen--dark" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner spinner--white"></div>
          <p style={{ marginTop: 'var(--sp-4)', color: 'var(--clr-ink-muted-on-dark)' }}>Initializing encrypted connection...</p>
        </div>
      </div>
    );
  }

  const doctorName = activeAppointment?.doctor?.name || 'Doctor';

  return (
    <div className="screen screen--dark video-call-screen">
      {/* Top Floating Overlay Badges */}
      <div className="video-call-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-ink-muted-on-dark)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Consultation With
          </span>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--clr-ink-on-dark)' }}>
            {doctorName}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <ConnectionStatus />
          <CallTimer />
        </div>
      </div>

      {/* Main Video Viewport */}
      <div className={`video-call-viewport ${isChatOpen ? 'video-call-viewport--chat-open' : ''}`}>
        <VideoPlayer />
        
        {isChatOpen && (
          <div className="chat-panel-container">
            <ChatPanel onClose={() => setIsChatOpen(false)} />
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="video-call-footer">
        <Controls onToggleChat={() => setIsChatOpen((prev) => !prev)} isChatOpen={isChatOpen} />
      </div>
    </div>
  );
}
