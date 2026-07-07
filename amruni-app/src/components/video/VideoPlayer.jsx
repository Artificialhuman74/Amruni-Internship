import { useEffect, useRef } from 'react';
import { useVideoCall } from '../../hooks/useVideoCall';
import ParticipantCard from './ParticipantCard';
import DoctorAvatar from '../DoctorAvatar';

export default function VideoPlayer() {
  const { localStream, isCamOn, activeAppointment, currentDoctor } = useVideoCall();
  const patientVideoRef = useRef(null);

  useEffect(() => {
    if (patientVideoRef.current) {
      if (localStream && isCamOn) {
        patientVideoRef.current.srcObject = localStream;
      } else {
        patientVideoRef.current.srcObject = null;
      }
    }
  }, [localStream, isCamOn]);

  const doctorName = activeAppointment?.doctor?.name || currentDoctor?.name || 'Doctor';
  const doctorAvatar = activeAppointment?.doctor?.avatar || currentDoctor?.avatar || '🩺';
  const doctorSpecialty = activeAppointment?.doctor?.specialty || currentDoctor?.specialty || 'Specialist';

  return (
    <div className="video-grid">
      {/* Remote Participant: Doctor (Full Canvas Feed) */}
      <div className="video-feed video-feed--remote">
        {/* Mock Doctor Stream: A pulsing, highly styled clinical consultation background */}
        <div className="doctor-mock-feed">
          <div className="doctor-mock-avatar-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DoctorAvatar doctor={activeAppointment?.doctor || currentDoctor} size={96} style={{ border: 'none', background: 'transparent' }} />
            <div className="doctor-pulse-ring"></div>
            <div className="doctor-pulse-ring doctor-pulse-ring--delay-1"></div>
            <div className="doctor-pulse-ring doctor-pulse-ring--delay-2"></div>
          </div>
          <div className="doctor-mock-info">
            <h3>{doctorName}</h3>
            <p>{doctorSpecialty} · Live Session</p>
          </div>
          
          {/* Animated audio wave indicator simulating speech */}
          <div className="audio-wave">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>

        {/* Doctor name card Overlay */}
        <ParticipantCard name={doctorName} isMuted={false} isDoctor={true} />
      </div>

      {/* Local Participant: Patient (Floating PIP Window) */}
      <div className="video-feed video-feed--local">
        {localStream && isCamOn ? (
          <video
            ref={patientVideoRef}
            autoPlay
            playsInline
            muted
            className="patient-camera-video"
          />
        ) : (
          <div className="patient-fallback-avatar">
            <span className="patient-avatar-emoji">👩</span>
            <span className="camera-muted-badge">Camera Off</span>
          </div>
        )}

        {/* Patient Name card Overlay */}
        <ParticipantCard name="You (Patient)" isMuted={false} isDoctor={false} />
      </div>
    </div>
  );
}
