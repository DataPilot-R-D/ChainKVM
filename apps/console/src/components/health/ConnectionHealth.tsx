import type { ConnectionStats, HealthStatus } from '../../hooks/useConnectionStats';
import './ConnectionHealth.css';

export interface ConnectionHealthProps {
  stats: ConnectionStats | null;
  healthStatus: HealthStatus;
  visible?: boolean;
  compact?: boolean;
  onToggle?: () => void;
}

function formatMetric(value: number | undefined, suffix: string): string {
  if (value === undefined) return '--';
  return `${value} ${suffix}`;
}

function formatDecimal(value: number | undefined, decimals: number, suffix: string): string {
  if (value === undefined) return '--';
  return `${value.toFixed(decimals)} ${suffix}`;
}

function formatPercent(value: number | undefined): string {
  if (value === undefined) return '--';
  return `${value.toFixed(1)}%`;
}

export function ConnectionHealth({
  stats,
  healthStatus,
  visible = true,
  compact = false,
  onToggle,
}: ConnectionHealthProps) {
  if (!visible) {
    return null;
  }

  const indicatorClasses = [
    'health-indicator',
    `health-indicator--${healthStatus}`,
  ].join(' ');

  if (compact) {
    return (
      <div className="connection-health connection-health--compact">
        <span
          data-testid="health-indicator"
          className={indicatorClasses}
          aria-label={`Connection health: ${healthStatus}`}
        />
      </div>
    );
  }

  return (
    <div
      data-testid="connection-health-overlay"
      className="connection-health"
    >
      <div className="connection-health__header">
        <span
          data-testid="health-indicator"
          className={indicatorClasses}
          aria-label={`Connection health: ${healthStatus}`}
        />
        <span className="connection-health__title">Connection</span>
        {onToggle && (
          <button
            type="button"
            className="connection-health__toggle"
            onClick={onToggle}
            aria-label="Hide connection stats"
          >
            Hide
          </button>
        )}
      </div>

      <div className="connection-health__metrics">
        <div className="metric">
          <span className="metric__label">Round-trip time</span>
          <span data-testid="rtt-value" className="metric__value">
            {stats ? formatMetric(stats.rttMs, 'ms') : '--'}
          </span>
        </div>

        <div className="metric">
          <span className="metric__label">Packet loss</span>
          <span data-testid="packet-loss-value" className="metric__value">
            {stats ? formatPercent(stats.packetLossPercent) : '--'}
          </span>
        </div>

        <div className="metric">
          <span className="metric__label">Video bitrate</span>
          <span data-testid="bitrate-value" className="metric__value">
            {stats ? formatDecimal(stats.videoBitrateMbps, 1, 'Mbps') : '--'}
          </span>
        </div>

        <div className="metric">
          <span className="metric__label">Frame rate</span>
          <span data-testid="framerate-value" className="metric__value">
            {stats ? formatMetric(stats.frameRate, 'fps') : '--'}
          </span>
        </div>
      </div>
    </div>
  );
}
