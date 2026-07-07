import { useVideoCall } from '../../hooks/useVideoCall';

export default function ParticipantCard({ name, isDoctor }) {
  const { isMicOn } = useVideoCall();

  // If local participant, check global state. If doctor, assume they are unmuted by default.
  const isMuted = !isDoctor && !isMicOn;

  return (
    <div className="participant-card">
      <div className="participant-card__body">
        <span className="participant-card__name">
          {name} {isDoctor && <span className="doctor-badge-tag">MD</span>}
        </span>
        <div className="participant-card__indicators">
          {isMuted && (
            <span className="indicator-icon indicator-icon--mute" title="Microphone muted">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="2" y1="2" x2="22" y2="22"/>
                <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2M5 10v2a7 7 0 0 0 12 5"/>
                <path d="M12 19v4M8 23h8"/>
              </svg>
            </span>
          )}
          {isDoctor && (
            <span className="indicator-icon indicator-icon--recording" title="Live audio active">
              <span className="pulse-dot"></span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
