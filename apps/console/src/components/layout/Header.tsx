import './Header.css';

export function Header() {
  return (
    <header className="header" role="banner">
      <div className="header__logo">
        <h1 className="header__title">ChainKVM Console</h1>
      </div>
      <div className="header__status" data-testid="session-status">
        <span className="status-indicator status-indicator--disconnected" />
        <span className="status-text">Disconnected</span>
      </div>
    </header>
  );
}
