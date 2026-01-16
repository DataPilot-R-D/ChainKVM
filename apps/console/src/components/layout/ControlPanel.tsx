import './ControlPanel.css';

export function ControlPanel() {
  return (
    <div className="control-panel" data-testid="control-panel">
      <div className="control-panel__header">
        <span className="control-panel__title">Control Input</span>
        <span className="control-panel__state" data-testid="control-state">
          Inactive
        </span>
      </div>
      <div className="control-panel__instructions">
        <p>Click video to enable controls</p>
        <ul>
          <li>WASD / Arrow keys: Drive</li>
          <li>Mouse: Look around</li>
          <li>Space: Emergency stop</li>
        </ul>
      </div>
    </div>
  );
}
