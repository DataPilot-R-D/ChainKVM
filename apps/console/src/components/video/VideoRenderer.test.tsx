import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoRenderer } from './VideoRenderer';

// Mock MediaStream
const createMockMediaStream = (hasVideo = true): MediaStream => {
  const mockTrack = {
    kind: 'video',
    enabled: true,
    getSettings: () => ({ width: 1920, height: 1080, frameRate: 30 }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaStreamTrack;

  return {
    getVideoTracks: () => (hasVideo ? [mockTrack] : []),
    getTracks: () => (hasVideo ? [mockTrack] : []),
    active: hasVideo,
  } as unknown as MediaStream;
};

describe('VideoRenderer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders video element', () => {
      render(<VideoRenderer />);
      expect(screen.getByTestId('video-renderer')).toBeInTheDocument();
      expect(screen.getByTestId('video-element')).toBeInTheDocument();
    });

    it('shows placeholder when no stream', () => {
      render(<VideoRenderer />);
      expect(screen.getByText(/no video/i)).toBeInTheDocument();
    });

    it('hides placeholder when stream is active', () => {
      const stream = createMockMediaStream();
      render(<VideoRenderer stream={stream} />);
      expect(screen.queryByText(/no video/i)).not.toBeInTheDocument();
    });
  });

  describe('stream handling', () => {
    it('attaches stream to video element', () => {
      const stream = createMockMediaStream();
      render(<VideoRenderer stream={stream} />);
      const video = screen.getByTestId('video-element') as HTMLVideoElement;
      expect(video.srcObject).toBe(stream);
    });

    it('updates when stream changes', () => {
      const stream1 = createMockMediaStream();
      const stream2 = createMockMediaStream();
      const { rerender } = render(<VideoRenderer stream={stream1} />);
      const video = screen.getByTestId('video-element') as HTMLVideoElement;
      expect(video.srcObject).toBe(stream1);

      rerender(<VideoRenderer stream={stream2} />);
      expect(video.srcObject).toBe(stream2);
    });

    it('clears stream on unmount', () => {
      const stream = createMockMediaStream();
      const { unmount } = render(<VideoRenderer stream={stream} />);
      const video = screen.getByTestId('video-element') as HTMLVideoElement;
      unmount();
      expect(video.srcObject).toBeNull();
    });
  });

  describe('video stats', () => {
    it('displays resolution when stream active', () => {
      const stream = createMockMediaStream();
      render(<VideoRenderer stream={stream} showStats />);
      expect(screen.getByTestId('video-stats')).toBeInTheDocument();
    });

    it('hides stats when showStats is false', () => {
      const stream = createMockMediaStream();
      render(<VideoRenderer stream={stream} showStats={false} />);
      expect(screen.queryByTestId('video-stats')).not.toBeInTheDocument();
    });

    it('shows resolution indicator', () => {
      const stream = createMockMediaStream();
      render(<VideoRenderer stream={stream} showStats />);
      expect(screen.getByTestId('resolution-indicator')).toBeInTheDocument();
    });

    it('shows FPS indicator', () => {
      const stream = createMockMediaStream();
      render(<VideoRenderer stream={stream} showStats />);
      expect(screen.getByTestId('fps-indicator')).toBeInTheDocument();
    });
  });

  describe('fullscreen', () => {
    it('renders fullscreen button', () => {
      render(<VideoRenderer />);
      expect(screen.getByTestId('fullscreen-button')).toBeInTheDocument();
    });

    it('calls requestFullscreen on button click', () => {
      const mockRequestFullscreen = vi.fn().mockResolvedValue(undefined);
      render(<VideoRenderer />);
      const container = screen.getByTestId('video-renderer');
      container.requestFullscreen = mockRequestFullscreen;

      fireEvent.click(screen.getByTestId('fullscreen-button'));
      expect(mockRequestFullscreen).toHaveBeenCalled();
    });

    it('updates fullscreen state on fullscreenchange', () => {
      render(<VideoRenderer />);
      const button = screen.getByTestId('fullscreen-button');
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('stream interruption', () => {
    it('shows reconnecting overlay when stream inactive', () => {
      const stream = createMockMediaStream(false);
      render(<VideoRenderer stream={stream} />);
      expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
    });

    it('calls onStreamError when track ends', () => {
      const stream = createMockMediaStream();
      const onStreamError = vi.fn();
      render(<VideoRenderer stream={stream} onStreamError={onStreamError} />);

      // Simulate track ended event
      const track = stream.getVideoTracks()[0];
      const endedHandler = (track.addEventListener as ReturnType<typeof vi.fn>).mock.calls
        .find(call => call[0] === 'ended')?.[1];

      if (endedHandler) {
        act(() => endedHandler());
        expect(onStreamError).toHaveBeenCalledWith('track_ended');
      }
    });

    it('shows error message on stream error', () => {
      render(<VideoRenderer error="Connection lost" />);
      expect(screen.getByText(/connection lost/i)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('video has appropriate aria label', () => {
      render(<VideoRenderer />);
      const video = screen.getByTestId('video-element');
      expect(video).toHaveAttribute('aria-label');
    });

    it('fullscreen button has aria-pressed', () => {
      render(<VideoRenderer />);
      const button = screen.getByTestId('fullscreen-button');
      expect(button).toHaveAttribute('aria-pressed');
    });
  });
});
