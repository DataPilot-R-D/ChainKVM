import './VideoPanel.css';

export function VideoPanel() {
  return (
    <div className="video-panel" data-testid="video-panel">
      <div className="video-panel__container">
        <video
          className="video-panel__video"
          data-testid="video-element"
          autoPlay
          playsInline
          muted
        />
        <div className="video-panel__placeholder">
          <span>No Video Stream</span>
          <p>Waiting for connection...</p>
        </div>
      </div>
    </div>
  );
}
