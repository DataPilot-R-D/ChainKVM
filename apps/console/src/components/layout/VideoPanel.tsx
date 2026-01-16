import { VideoRenderer } from '../video';
import './VideoPanel.css';

export interface VideoPanelProps {
  stream?: MediaStream | null;
  error?: string | null;
  onStreamError?: (reason: string) => void;
}

export function VideoPanel({ stream, error, onStreamError }: VideoPanelProps) {
  return (
    <div className="video-panel" data-testid="video-panel">
      <VideoRenderer
        stream={stream}
        error={error}
        onStreamError={onStreamError}
        showStats
      />
    </div>
  );
}
