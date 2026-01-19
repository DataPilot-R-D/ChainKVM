import { useEffect, useState, useRef } from 'react';
import './SessionStatus.css';

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'
  | 'revoked';

export type PermissionLevel = 'view-only' | 'control' | 'admin';

export interface SessionState {
  connectionState: ConnectionState;
  sessionStartTime?: Date;
  permissionLevel?: PermissionLevel;
  errorMessage?: string;
  tokenExpiresAt?: Date;
}

export interface SessionStatusProps extends SessionState {
  onRetry?: () => void;
}

const TOKEN_EXPIRY_WARNING_THRESHOLD = 120000; // 2 minutes

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
}

function getConnectionStateLabel(state: ConnectionState): string {
  const labels: Record<ConnectionState, string> = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Connected',
    reconnecting: 'Reconnecting...',
    failed: 'Connection Failed',
    revoked: 'Session Revoked',
  };
  return labels[state];
}

function getPermissionLabel(level: PermissionLevel): string {
  const labels: Record<PermissionLevel, string> = {
    'view-only': 'View Only',
    control: 'Control',
    admin: 'Admin',
  };
  return labels[level];
}

export function SessionStatus({
  connectionState,
  sessionStartTime,
  permissionLevel,
  errorMessage,
  tokenExpiresAt,
  onRetry,
}: SessionStatusProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [timeToExpiry, setTimeToExpiry] = useState<number | null>(null);
  const prevStateRef = useRef(connectionState);

  const isConnected =
    connectionState === 'connected' || connectionState === 'reconnecting';
  const isRevoked = connectionState === 'revoked';
  const showError = errorMessage && connectionState === 'failed';
  const canRetry = !isRevoked;
  const showExpiryWarning =
    timeToExpiry !== null && timeToExpiry < TOKEN_EXPIRY_WARNING_THRESHOLD;

  // Handle state transitions
  useEffect(() => {
    if (prevStateRef.current !== connectionState) {
      setIsTransitioning(true);
      const timer = setTimeout(() => setIsTransitioning(false), 300);
      prevStateRef.current = connectionState;
      return () => clearTimeout(timer);
    }
  }, [connectionState]);

  // Update session timer
  useEffect(() => {
    if (!sessionStartTime || !isConnected) {
      setElapsedTime(0);
      return;
    }

    const updateTimer = () => {
      setElapsedTime(Date.now() - sessionStartTime.getTime());
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime, isConnected]);

  // Update token expiry countdown
  useEffect(() => {
    if (!tokenExpiresAt || !isConnected) {
      setTimeToExpiry(null);
      return;
    }

    const updateExpiry = () => {
      const remaining = tokenExpiresAt.getTime() - Date.now();
      setTimeToExpiry(remaining > 0 ? remaining : 0);
    };

    updateExpiry();
    const interval = setInterval(updateExpiry, 1000);
    return () => clearInterval(interval);
  }, [tokenExpiresAt, isConnected]);

  const indicatorClasses = [
    'connection-indicator',
    `connection-indicator--${connectionState}`,
    isTransitioning ? 'connection-indicator--transitioning' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="session-status">
      <div
        role="status"
        aria-live="polite"
        aria-label={`Connection status: ${getConnectionStateLabel(connectionState)}`}
        className="session-status__connection"
      >
        <span
          data-testid="connection-indicator"
          className={indicatorClasses}
          aria-hidden="true"
        />
        <span className="connection-label">
          {getConnectionStateLabel(connectionState)}
        </span>
      </div>

      {isConnected && sessionStartTime && (
        <div className="session-status__timer">
          <span data-testid="session-timer" className="session-timer">
            {formatDuration(elapsedTime)}
          </span>
        </div>
      )}

      {isConnected && permissionLevel && (
        <div
          data-testid="permission-badge"
          className={`permission-badge permission-badge--${permissionLevel}`}
        >
          {getPermissionLabel(permissionLevel)}
        </div>
      )}

      {showExpiryWarning && timeToExpiry !== null && (
        <div
          data-testid="token-expiry-warning"
          className="session-status__expiry-warning"
        >
          <span className="expiry-icon" aria-hidden="true">
            ⚠
          </span>
          <span>Expires in {formatDuration(timeToExpiry)}</span>
        </div>
      )}

      {showError && (
        <div
          role="alert"
          aria-label={`Error: ${errorMessage}`}
          className="session-status__error"
        >
          <span className="error-message">{errorMessage}</span>
          {onRetry && canRetry && (
            <button
              type="button"
              className="retry-button"
              onClick={onRetry}
              aria-label="Retry connection"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
