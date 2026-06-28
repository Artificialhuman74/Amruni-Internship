import { useVideoCall } from '../../hooks/useVideoCall';

export default function CallTimer() {
  const { duration } = useVideoCall();

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="call-timer-badge">
      <span className="timer-icon">🔴</span>
      <span className="timer-text">{formatDuration(duration)}</span>
    </div>
  );
}
