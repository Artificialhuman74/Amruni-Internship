import { useVideoCall } from '../../hooks/useVideoCall';

export default function ConnectionStatus() {
  const { connectionStatus } = useVideoCall();

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'excellent':
        return 'var(--clr-success)';
      case 'good':
        return 'var(--clr-fertile)';
      case 'fair':
        return 'var(--clr-gold)';
      case 'poor':
        return 'var(--clr-brand)';
      default:
        return 'var(--clr-success)';
    }
  };

  return (
    <div className="connection-status-badge">
      <span
        className="connection-status-dot"
        style={{ backgroundColor: getStatusColor(connectionStatus) }}
      />
      <span className="connection-status-text">
        {connectionStatus} Connection
      </span>
    </div>
  );
}
