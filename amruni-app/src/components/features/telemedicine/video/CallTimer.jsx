import { useVideoCall } from '../../../../hooks/useVideoCall';
import { IconLive } from '../../../../icons.jsx';

export default function CallTimer() {
  const { duration } = useVideoCall();

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="call-timer-badge">
      <span className="timer-icon"><IconLive size={8} /></span>
      <span className="timer-text">{formatDuration(duration)}</span>
    </div>
  );
}
