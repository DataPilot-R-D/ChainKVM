import { useEffect, useRef, useState, useCallback } from 'react';
import { useVideoLatency } from '../../hooks/useVideoLatency';
import './VideoRenderer.css';

export interface VideoRendererProps {
  stream?: MediaStream | null;
  dataChannel?: RTCDataChannel | null;
  showStats?: boolean;
  error?: string | null;
  onStreamError?: (reason: string) => void;
}

interface VideoStats {
  width: number;
  height: number;
  frameRate: number;
}

export function VideoRenderer({
  stream,
  dataChannel,
  showStats = true,
  error,
  onStreamError,
}: VideoRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stats, setStats] = useState<VideoStats | null>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);

  // Measure video latency (M6-003)
  const latencyData = useVideoLatency(videoRef, dataChannel ?? null, {
    samplingRate: 5,
  });

  // Attach stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      video.srcObject = stream;
      setIsStreamActive(stream.active && stream.getVideoTracks().length > 0);

      // Get initial stats from track settings
      const track = stream.getVideoTracks()[0];
      if (track) {
        const settings = track.getSettings();
        setStats({
          width: settings.width || 0,
          height: settings.height || 0,
          frameRate: settings.frameRate || 0,
        });

        // Listen for track ended
        const handleEnded = () => {
          setIsStreamActive(false);
          onStreamError?.('track_ended');
        };
        track.addEventListener('ended', handleEnded);

        return () => {
          track.removeEventListener('ended', handleEnded);
          video.srcObject = null;
        };
      }
    } else {
      video.srcObject = null;
      setIsStreamActive(false);
      setStats(null);
    }

    return () => {
      video.srcObject = null;
    };
  }, [stream, onStreamError]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  const showPlaceholder = !stream || !isStreamActive;
  const showReconnecting = stream && !stream.active;

  return (
    <div
      ref={containerRef}
      className={`video-renderer ${isFullscreen ? 'video-renderer--fullscreen' : ''}`}
      data-testid="video-renderer"
    >
      <video
        ref={videoRef}
        className="video-renderer__video"
        data-testid="video-element"
        autoPlay
        playsInline
        muted
        aria-label="Robot camera feed"
      />

      {showPlaceholder && !showReconnecting && !error && (
        <div className="video-renderer__placeholder">
          <span>No Video Stream</span>
          <p>Waiting for connection...</p>
        </div>
      )}

      {showReconnecting && (
        <div className="video-renderer__overlay video-renderer__overlay--reconnecting">
          <span>Reconnecting...</span>
          <p>Attempting to restore video stream</p>
        </div>
      )}

      {error && (
        <div className="video-renderer__overlay video-renderer__overlay--error">
          <span>Error</span>
          <p>{error}</p>
        </div>
      )}

      {showStats && isStreamActive && stats && (
        <div className="video-renderer__stats" data-testid="video-stats">
          <span data-testid="resolution-indicator">
            {stats.width}x{stats.height}
          </span>
          <span data-testid="fps-indicator">{Math.round(stats.frameRate)} FPS</span>
          {latencyData.currentLatency !== null && (
            <span data-testid="latency-indicator">
              {Math.round(latencyData.currentLatency)}ms
            </span>
          )}
          {latencyData.averageLatency !== null && (
            <span data-testid="avg-latency-indicator">
              avg: {Math.round(latencyData.averageLatency)}ms
            </span>
          )}
          {latencyData.clockOffset !== null && latencyData.clockOffset > 100 && (
            <span data-testid="clock-offset-warning" className="video-renderer__stats--warning">
              ⚠ Clock offset: {Math.round(latencyData.clockOffset)}ms
            </span>
          )}
          {latencyData.error && (
            <span data-testid="latency-error" className="video-renderer__stats--warning">
              ⚠ Latency error: {latencyData.error}
            </span>
          )}
          {latencyData.timestampBuffer && latencyData.timestampBuffer.parseErrors > 0 && (
            <span data-testid="timestamp-errors" className="video-renderer__stats--warning">
              ⚠ Timestamp errors: {latencyData.timestampBuffer.parseErrors}
            </span>
          )}
        </div>
      )}

      <div className="video-renderer__controls">
        <button
          className="video-renderer__fullscreen-btn"
          data-testid="fullscreen-button"
          onClick={toggleFullscreen}
          aria-pressed={isFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? '⤓' : '⤢'}
        </button>
      </div>
    </div>
  );
}
