import { renderHook, waitFor } from '@testing-library/react';
import { useVideoLatency } from '../useVideoLatency';
import { FrameTimestampMessage } from '../useFrameTimestamps';
import { vi } from 'vitest';
import { useRef } from 'react';

describe('useFrameTimestamps + useVideoLatency integration', () => {
  let mockDataChannel: RTCDataChannel;
  let messageHandlers: ((event: MessageEvent) => void)[];
  let mockVideoRef: { current: HTMLVideoElement | null };

  beforeEach(() => {
    messageHandlers = [];
    mockVideoRef = { current: null };

    mockDataChannel = {
      addEventListener: vi.fn((event: string, handler: (event: MessageEvent) => void) => {
        if (event === 'message') {
          messageHandlers.push(handler);
        }
      }),
      removeEventListener: vi.fn(),
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const sendTimestamp = (timestamp: number, frameId: number, sequence: number) => {
    const msg: FrameTimestampMessage = {
      type: 'frame_timestamp',
      timestamp,
      frame_id: frameId,
      sequence_number: sequence,
    };
    messageHandlers[0](new MessageEvent('message', { data: JSON.stringify(msg) }));
  };

  it('should calculate latency from DataChannel timestamps end-to-end', async () => {
    const { result } = renderHook(() => {
      const videoRef = useRef<HTMLVideoElement>(null);
      return useVideoLatency(videoRef, mockDataChannel, {
        samplingRate: 10,
        maxSamples: 100,
      });
    });

    // Send 5 timestamps with known latencies
    const now = Date.now();
    for (let i = 1; i <= 5; i++) {
      sendTimestamp(now - 100, i, i); // 100ms latency
    }

    await waitFor(() => {
      expect(result.current.sampleCount).toBe(5);
    });

    // Verify latency calculation
    expect(result.current.currentLatency).not.toBeNull();
    expect(result.current.currentLatency).toBeGreaterThanOrEqual(95);
    expect(result.current.currentLatency).toBeLessThan(150);

    // Verify statistics
    expect(result.current.averageLatency).not.toBeNull();
    expect(result.current.minLatency).not.toBeNull();
    expect(result.current.maxLatency).not.toBeNull();

    // Verify timestamp buffer is exposed
    expect(result.current.timestampBuffer.timestamps).toHaveLength(5);
    expect(result.current.timestampBuffer.droppedMessages).toBe(0);
    expect(result.current.timestampBuffer.parseErrors).toBe(0);
  });

  it('should handle dropped messages through full pipeline', async () => {
    const { result } = renderHook(() => {
      const videoRef = useRef<HTMLVideoElement>(null);
      return useVideoLatency(videoRef, mockDataChannel, { samplingRate: 10 });
    });

    const now = Date.now();

    // Send message with sequence 1
    sendTimestamp(now - 50, 1, 1);

    await waitFor(() => {
      expect(result.current.sampleCount).toBe(1);
    });

    // Send message with sequence 4 (dropped 2 and 3)
    sendTimestamp(now - 50, 4, 4);

    await waitFor(() => {
      expect(result.current.sampleCount).toBe(2);
    });

    // Verify dropped messages counter
    expect(result.current.timestampBuffer.droppedMessages).toBe(2);

    // Verify latency calculation still works
    expect(result.current.currentLatency).not.toBeNull();
    expect(result.current.averageLatency).not.toBeNull();
  });

  it('should propagate parse errors from timestamps to latency hook', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => {
      const videoRef = useRef<HTMLVideoElement>(null);
      return useVideoLatency(videoRef, mockDataChannel, { samplingRate: 10 });
    });

    // Send invalid JSON
    messageHandlers[0](new MessageEvent('message', { data: 'invalid json' }));

    await waitFor(
      () => {
        expect(result.current.timestampBuffer.parseErrors).toBe(1);
      },
      { timeout: 3000 }
    );

    // Verify error is exposed through timestampBuffer
    expect(result.current.timestampBuffer.lastError).not.toBeNull();
    expect(result.current.timestampBuffer.timestamps).toHaveLength(0);

    // Send valid message after error
    const now = Date.now();
    sendTimestamp(now - 50, 1, 1);

    await waitFor(
      () => {
        expect(result.current.sampleCount).toBe(1);
      },
      { timeout: 3000 }
    );

    // Error count preserved, but lastError cleared on success
    expect(result.current.timestampBuffer.parseErrors).toBe(1);
    expect(result.current.timestampBuffer.lastError).toBeNull();

    consoleSpy.mockRestore();
  });

  it('should handle rapid message bursts through both hooks', async () => {
    const { result } = renderHook(() => {
      const videoRef = useRef<HTMLVideoElement>(null);
      return useVideoLatency(videoRef, mockDataChannel, { samplingRate: 10 });
    });

    // Send 30 messages rapidly
    const now = Date.now();
    for (let i = 1; i <= 30; i++) {
      sendTimestamp(now - 100, i, i);
    }

    await waitFor(() => {
      expect(result.current.sampleCount).toBe(30);
    });

    // Verify all timestamps processed
    expect(result.current.timestampBuffer.timestamps).toHaveLength(30);
    expect(result.current.timestampBuffer.droppedMessages).toBe(0);
    expect(result.current.timestampBuffer.parseErrors).toBe(0);

    // Verify statistics computed correctly
    expect(result.current.averageLatency).not.toBeNull();
    expect(result.current.minLatency).not.toBeNull();
    expect(result.current.maxLatency).not.toBeNull();
    expect(result.current.clockOffset).toBeNull(); // No clock offset
  });

  it('should maintain clock offset detection with real timestamp flow', async () => {
    const { result } = renderHook(() => {
      const videoRef = useRef<HTMLVideoElement>(null);
      return useVideoLatency(videoRef, mockDataChannel, {
        samplingRate: 10,
        detectClockOffset: true,
        maxSamples: 100,
      });
    });

    const now = Date.now();

    // Send 30 timestamps with 26 in the future (negative latency)
    for (let i = 1; i <= 30; i++) {
      if (i <= 26) {
        sendTimestamp(now + 500, i, i); // Future timestamp
      } else {
        sendTimestamp(now - 100, i, i); // Normal timestamp
      }
    }

    await waitFor(() => {
      expect(result.current.sampleCount).toBe(30);
    });

    // Verify clock offset detected (>= 25% threshold)
    expect(result.current.clockOffset).not.toBeNull();
    expect(result.current.clockOffset).toBeGreaterThan(0);

    // Verify timestamps still received
    expect(result.current.timestampBuffer.timestamps).toHaveLength(30);
    expect(result.current.timestampBuffer.droppedMessages).toBe(0);
  });
});
