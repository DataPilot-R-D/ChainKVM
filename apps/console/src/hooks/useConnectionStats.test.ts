import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnectionStats } from './useConnectionStats';

function createMockStatsReport(entries: Array<[string, object]>): RTCStatsReport {
  const map = new Map(entries);
  return map as unknown as RTCStatsReport;
}

describe('useConnectionStats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should return null stats when no getStats function provided', () => {
      const { result } = renderHook(() => useConnectionStats(null));

      expect(result.current.stats).toBeNull();
      expect(result.current.healthStatus).toBe('unknown');
    });

    it('should return null stats when not enabled', () => {
      const getStats = vi.fn().mockResolvedValue(createMockStatsReport([]));
      const { result } = renderHook(() =>
        useConnectionStats(getStats, { enabled: false })
      );

      expect(result.current.stats).toBeNull();
    });
  });

  describe('stats collection', () => {
    it('should collect RTT from candidate-pair stats', async () => {
      const getStats = vi.fn().mockResolvedValue(
        createMockStatsReport([
          [
            'candidate-pair-1',
            {
              type: 'candidate-pair',
              state: 'succeeded',
              currentRoundTripTime: 0.05, // 50ms
            },
          ],
        ])
      );

      const { result } = renderHook(() => useConnectionStats(getStats));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      expect(result.current.stats?.rttMs).toBe(50);
    });

    it('should collect packet loss from inbound-rtp stats', async () => {
      const getStats = vi.fn().mockResolvedValue(
        createMockStatsReport([
          [
            'inbound-rtp-1',
            {
              type: 'inbound-rtp',
              kind: 'video',
              packetsReceived: 1000,
              packetsLost: 10,
            },
          ],
        ])
      );

      const { result } = renderHook(() => useConnectionStats(getStats));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      expect(result.current.stats?.packetLossPercent).toBeCloseTo(1.0, 1);
    });

    it('should collect video bitrate from inbound-rtp stats', async () => {
      // Use realistic timestamps (like real RTCStatsReport)
      const baseTimestamp = 1000000;
      const getStats = vi
        .fn()
        .mockResolvedValueOnce(
          createMockStatsReport([
            [
              'inbound-rtp-1',
              {
                type: 'inbound-rtp',
                kind: 'video',
                bytesReceived: 0,
                timestamp: baseTimestamp,
              },
            ],
          ])
        )
        .mockResolvedValueOnce(
          createMockStatsReport([
            [
              'inbound-rtp-1',
              {
                type: 'inbound-rtp',
                kind: 'video',
                bytesReceived: 125000, // 125KB in 1 second = 1 Mbps
                timestamp: baseTimestamp + 1000,
              },
            ],
          ])
        );

      const { result } = renderHook(() => useConnectionStats(getStats));

      // First collection
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      // Second collection after interval
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(result.current.stats?.videoBitrateMbps).toBeCloseTo(1.0, 1);
    });

    it('should collect frame rate from inbound-rtp stats', async () => {
      const getStats = vi.fn().mockResolvedValue(
        createMockStatsReport([
          [
            'inbound-rtp-1',
            {
              type: 'inbound-rtp',
              kind: 'video',
              framesPerSecond: 30,
            },
          ],
        ])
      );

      const { result } = renderHook(() => useConnectionStats(getStats));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      expect(result.current.stats?.frameRate).toBe(30);
    });
  });

  describe('health status', () => {
    it('should return good status for low RTT', async () => {
      const getStats = vi.fn().mockResolvedValue(
        createMockStatsReport([
          [
            'candidate-pair-1',
            {
              type: 'candidate-pair',
              state: 'succeeded',
              currentRoundTripTime: 0.03, // 30ms
            },
          ],
        ])
      );

      const { result } = renderHook(() => useConnectionStats(getStats));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      expect(result.current.healthStatus).toBe('good');
    });

    it('should return warning status for moderate RTT', async () => {
      const getStats = vi.fn().mockResolvedValue(
        createMockStatsReport([
          [
            'candidate-pair-1',
            {
              type: 'candidate-pair',
              state: 'succeeded',
              currentRoundTripTime: 0.1, // 100ms
            },
          ],
        ])
      );

      const { result } = renderHook(() => useConnectionStats(getStats));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      expect(result.current.healthStatus).toBe('warning');
    });

    it('should return critical status for high RTT', async () => {
      const getStats = vi.fn().mockResolvedValue(
        createMockStatsReport([
          [
            'candidate-pair-1',
            {
              type: 'candidate-pair',
              state: 'succeeded',
              currentRoundTripTime: 0.25, // 250ms
            },
          ],
        ])
      );

      const { result } = renderHook(() => useConnectionStats(getStats));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      expect(result.current.healthStatus).toBe('critical');
    });
  });

  describe('polling interval', () => {
    it('should collect stats at specified interval', async () => {
      const getStats = vi.fn().mockResolvedValue(createMockStatsReport([]));

      renderHook(() => useConnectionStats(getStats, { intervalMs: 500 }));

      // Initial call
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      // Advance through 4 more intervals
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      // Initial + 4 intervals = 5 calls
      expect(getStats).toHaveBeenCalledTimes(5);
    });

    it('should stop polling when disabled', async () => {
      const getStats = vi.fn().mockResolvedValue(createMockStatsReport([]));

      const { rerender } = renderHook(
        ({ enabled }) => useConnectionStats(getStats, { enabled }),
        { initialProps: { enabled: true } }
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      const callsBeforeDisable = getStats.mock.calls.length;

      rerender({ enabled: false });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(getStats.mock.calls.length).toBe(callsBeforeDisable);
    });
  });

  describe('error handling', () => {
    it('should handle getStats rejection gracefully', async () => {
      const getStats = vi.fn().mockRejectedValue(new Error('Stats failed'));

      const { result } = renderHook(() => useConnectionStats(getStats));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      expect(result.current.stats).toBeNull();
      expect(result.current.healthStatus).toBe('unknown');
    });
  });
});
