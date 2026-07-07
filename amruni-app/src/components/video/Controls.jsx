import { useVideoCall } from '../../hooks/useVideoCall';

export default function Controls({ onToggleChat, isChatOpen }) {
  const {
    isMicOn,
    isCamOn,
    isSpeakerOn,
    toggleMic,
    toggleCam,
    toggleSpeaker,
    endCall
  } = useVideoCall();

  return (
    <div className="video-controls">
      {/* Mic Control */}
      <button
        onClick={toggleMic}
        className={`control-btn ${isMicOn ? 'control-btn--active' : 'control-btn--muted'}`}
        aria-label={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
      >
        {isMicOn ? <MicIcon /> : <MicOffIcon />}
      </button>

      {/* Camera Control */}
      <button
        onClick={toggleCam}
        className={`control-btn ${isCamOn ? 'control-btn--active' : 'control-btn--muted'}`}
        aria-label={isCamOn ? 'Disable Camera' : 'Enable Camera'}
      >
        {isCamOn ? <CamIcon /> : <CamOffIcon />}
      </button>

      {/* Speaker / Audio Output Control */}
      <button
        onClick={toggleSpeaker}
        className={`control-btn ${isSpeakerOn ? 'control-btn--active' : 'control-btn--muted'}`}
        aria-label={isSpeakerOn ? 'Mute Speaker' : 'Unmute Speaker'}
      >
        {isSpeakerOn ? <VolumeIcon /> : <VolumeOffIcon />}
      </button>

      {/* Chat Sidebar Toggle */}
      <button
        onClick={onToggleChat}
        className={`control-btn ${isChatOpen ? 'control-btn--highlight' : 'control-btn--active'}`}
        aria-label="Toggle Chat Room"
      >
        <ChatIcon />
      </button>

      {/* Terminate Call (End Call) */}
      <button
        onClick={endCall}
        className="control-btn control-btn--end"
        aria-label="End Call Session"
      >
        <EndCallIcon />
      </button>
    </div>
  );
}

/* ── Inline SVG Icons ────────────────────────────────────────── */

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="22" y2="22"/>
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2M5 10v2a7 7 0 0 0 12 5M9 9h6v1.5l-3.5 3.5H9z"/>
      <path d="M12 19v4M8 23h8"/>
    </svg>
  );
}

function CamIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 8-6 4 6 4V8Z"/>
      <rect x="2" y="6" width="14" height="12" rx="2" ry="2"/>
    </svg>
  );
}

function CamOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="22" y2="22"/>
      <path d="m22 8-6 4 6 4V8Z"/>
      <path d="M2 17h12V9.5m-3.5-3.5H2c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h10"/>
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  );
}

function VolumeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="22" y2="22"/>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function EndCallIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" transform="rotate(135 12 12)" fill="currentColor"/>
    </svg>
  );
}
