import { VideoRenderer } from '../video';
import './VideoPanel.css';

export interface VideoPanelProps {
  stream?: MediaStream | null;
  dataChannel?: RTCDataChannel | null;
  error?: string | null;
  onStreamError?: (reason: string) => void;
}

export function VideoPanel({ stream, dataChannel, error, onStreamError }: VideoPanelProps) {
  return (
    <div className="video-panel" data-testid="video-panel">
      <VideoRenderer
        stream={stream}
        dataChannel={dataChannel}
        error={error}
        onStreamError={onStreamError}
        showStats
      />
    </div>
  );
}
