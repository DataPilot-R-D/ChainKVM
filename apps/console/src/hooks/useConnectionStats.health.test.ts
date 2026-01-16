import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnectionStats } from './useConnectionStats';
import { createMockStatsReport } from './useConnectionStats.test';

describe('useConnectionStats health and polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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
              currentRoundTripTime: 0.03,
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
              currentRoundTripTime: 0.1,
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
              currentRoundTripTime: 0.25,
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

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

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
});
