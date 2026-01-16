import './StatusBar.css';

export function StatusBar() {
  return (
    <footer className="status-bar" data-testid="status-bar" role="contentinfo">
      <div className="status-bar__item" data-testid="latency-indicator">
        <span className="status-bar__label">Latency</span>
        <span className="status-bar__value">-- ms</span>
      </div>
      <div className="status-bar__item" data-testid="connection-quality">
        <span className="status-bar__label">Quality</span>
        <span className="status-bar__value status-bar__value--unknown">--</span>
      </div>
      <div className="status-bar__item">
        <span className="status-bar__label">Control Rate</span>
        <span className="status-bar__value">-- Hz</span>
      </div>
    </footer>
  );
}
