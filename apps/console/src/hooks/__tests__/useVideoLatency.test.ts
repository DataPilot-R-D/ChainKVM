import { renderHook, waitFor } from '@testing-library/react';
import { useVideoLatency } from '../useVideoLatency';
import { FrameTimestampMessage } from '../useFrameTimestamps';
import { RefObject } from 'react';
import { vi } from 'vitest';

describe('useVideoLatency', () => {
  let mockVideoRef: RefObject<HTMLVideoElement>;
  let mockDataChannel: RTCDataChannel;
  let messageHandlers: ((event: MessageEvent) => void)[];

  beforeEach(() => {
    mockVideoRef = { current: null };
    messageHandlers = [];

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

  function sendTimestamp(timestamp: number, frameId: number, sequence: number) {
    const msg: FrameTimestampMessage = {
      type: 'frame_timestamp',
      timestamp,
      frame_id: frameId,
      sequence_number: sequence,
    };
    messageHandlers[0](new MessageEvent('message', { data: JSON.stringify(msg) }));
  }

  it('should initialize with null values', () => {
    const { result } = renderHook(() => useVideoLatency(mockVideoRef, mockDataChannel));

    expect(result.current.currentLatency).toBeNull();
    expect(result.current.averageLatency).toBeNull();
    expect(result.current.minLatency).toBeNull();
    expect(result.current.maxLatency).toBeNull();
    expect(result.current.sampleCount).toBe(0);
    expect(result.current.clockOffset).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should handle null dataChannel gracefully', () => {
    const { result } = renderHook(() => useVideoLatency(mockVideoRef, null));

    expect(result.current.sampleCount).toBe(0);
    expect(result.current.currentLatency).toBeNull();
  });

  it('should calculate latency from DataChannel timestamp', async () => {
    const { result } = renderHook(() =>
      useVideoLatency(mockVideoRef, mockDataChannel, { samplingRate: 10 })
    );

    // Send timestamp 100ms in the past
    const pastTimestamp = Date.now() - 100;
    sendTimestamp(pastTimestamp, 1, 1);

    await waitFor(() => {
      expect(result.current.currentLatency).not.toBeNull();
    });

    // Verify latency is approximately 100ms (with some tolerance)
    expect(result.current.currentLatency).toBeGreaterThan(80);
    expect(result.current.currentLatency).toBeLessThan(120);
  });

  it('should calculate rolling average', async () => {
    const { result } = renderHook(() =>
      useVideoLatency(mockVideoRef, mockDataChannel, { samplingRate: 10 })
    );

    // Send timestamps with increasing latencies: 100ms, 110ms, 120ms
    const now = Date.now();
    sendTimestamp(now - 100, 1, 1);
    sendTimestamp(now - 110, 2, 2);
    sendTimestamp(now - 120, 3, 3);

    await waitFor(() => {
      expect(result.current.sampleCount).toBeGreaterThan(2);
    });

    // Average should be calculated
    expect(result.current.averageLatency).not.toBeNull();
    expect(result.current.averageLatency).toBeGreaterThan(80);
    expect(result.current.averageLatency).toBeLessThan(150);
  });

  it('should track min and max latencies', async () => {
    const { result } = renderHook(() =>
      useVideoLatency(mockVideoRef, mockDataChannel, { samplingRate: 10 })
    );

    // Vary latencies: 50ms, 150ms, 100ms
    const now = Date.now();
    sendTimestamp(now - 50, 1, 1);
    sendTimestamp(now - 150, 2, 2);
    sendTimestamp(now - 100, 3, 3);

    await waitFor(() => {
      expect(result.current.sampleCount).toBeGreaterThan(2);
    });

    expect(result.current.minLatency).not.toBeNull();
    expect(result.current.maxLatency).not.toBeNull();
    expect(result.current.minLatency).toBeLessThan(result.current.maxLatency!);
  });

  it('should detect clock offset with negative latencies', async () => {
    const { result } = renderHook(() =>
      useVideoLatency(mockVideoRef, mockDataChannel, {
        samplingRate: 10,
        detectClockOffset: true,
      })
    );

    // Send future timestamps (negative latency) - 30 samples to exceed 25% threshold
    const now = Date.now();
    for (let i = 1; i <= 30; i++) {
      sendTimestamp(now + 500, i, i); // 500ms in the future
    }

    await waitFor(() => {
      expect(result.current.sampleCount).toBeGreaterThan(5);
    });

    // Should detect clock offset
    expect(result.current.clockOffset).not.toBeNull();
    expect(result.current.clockOffset).toBeGreaterThan(0);
  });

  it('should respect maxSamples configuration', async () => {
    const maxSamples = 10;
    const { result } = renderHook(() =>
      useVideoLatency(mockVideoRef, mockDataChannel, { samplingRate: 20, maxSamples })
    );

    // Send 15 timestamps
    const now = Date.now();
    for (let i = 1; i <= 15; i++) {
      sendTimestamp(now - 100, i, i);
    }

    await waitFor(() => {
      expect(result.current.sampleCount).toBeGreaterThan(5);
    });

    // Sample count should not exceed maxSamples
    expect(result.current.sampleCount).toBeLessThanOrEqual(maxSamples);
  });

  it('should handle no timestamps gracefully', async () => {
    const { result } = renderHook(() =>
      useVideoLatency(mockVideoRef, mockDataChannel, { samplingRate: 10 })
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should remain at initial state
    expect(result.current.currentLatency).toBeNull();
    expect(result.current.sampleCount).toBe(0);
  });

  it('should handle rapid timestamp bursts', async () => {
    const { result } = renderHook(() =>
      useVideoLatency(mockVideoRef, mockDataChannel, { samplingRate: 10 })
    );

    // Send 20 timestamps rapidly
    const now = Date.now();
    for (let i = 1; i <= 20; i++) {
      sendTimestamp(now - 100, i, i);
    }

    await waitFor(() => {
      expect(result.current.sampleCount).toBeGreaterThan(15);
    });

    expect(result.current.sampleCount).toBe(20);
    expect(result.current.currentLatency).not.toBeNull();
  });
});
