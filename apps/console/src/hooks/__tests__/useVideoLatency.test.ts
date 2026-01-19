import { renderHook, waitFor } from '@testing-library/react';
import { useVideoLatency } from '../useVideoLatency';
import { extractTimestamp } from '../../utils/timestampOCR';
import { RefObject } from 'react';
import { vi } from 'vitest';

// Mock the extractTimestamp function
vi.mock('../../utils/timestampOCR');

const mockExtractTimestamp = vi.mocked(extractTimestamp);

describe('useVideoLatency', () => {
  let mockVideo: HTMLVideoElement;
  let mockVideoRef: RefObject<HTMLVideoElement>;
  let mockCanvas: HTMLCanvasElement;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    // Mock canvas context
    mockCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(200 * 50 * 4),
        width: 200,
        height: 50,
        colorSpace: 'srgb',
      })),
    } as any;

    // Mock canvas
    mockCanvas = {
      width: 200,
      height: 50,
      getContext: vi.fn(() => mockCtx),
    } as any;

    // Save original createElement
    const originalCreateElement = document.createElement.bind(document);

    // Mock document.createElement to return our mock canvas
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return mockCanvas as any;
      }
      return originalCreateElement(tagName);
    });

    mockVideo = originalCreateElement('video') as HTMLVideoElement;
    Object.defineProperty(mockVideo, 'videoWidth', { value: 1280, writable: true });
    Object.defineProperty(mockVideo, 'videoHeight', { value: 720, writable: true });
    Object.defineProperty(mockVideo, 'paused', { value: false, writable: true });
    Object.defineProperty(mockVideo, 'ended', { value: false, writable: true });

    mockVideoRef = { current: mockVideo };
    mockExtractTimestamp.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('should initialize with null values', () => {
    const { result } = renderHook(() => useVideoLatency(mockVideoRef));

    expect(result.current.currentLatency).toBeNull();
    expect(result.current.averageLatency).toBeNull();
    expect(result.current.minLatency).toBeNull();
    expect(result.current.maxLatency).toBeNull();
    expect(result.current.sampleCount).toBe(0);
    expect(result.current.clockOffset).toBeNull();
  });

  it('should not sample when video ref is null', () => {
    const nullRef: RefObject<HTMLVideoElement> = { current: null };
    const { result } = renderHook(() => useVideoLatency(nullRef));

    expect(result.current.sampleCount).toBe(0);
    expect(mockExtractTimestamp).not.toHaveBeenCalled();
  });

  it('should calculate latency from extracted timestamp', async () => {
    // Mock timestamp extraction to return a timestamp 100ms in the past
    mockExtractTimestamp.mockImplementation(() => {
      return Date.now() - 100;
    });

    const { result } = renderHook(() =>
      useVideoLatency(mockVideoRef, { samplingRate: 10 })
    );

    await waitFor(
      () => {
        expect(result.current.currentLatency).not.toBeNull();
      },
      { timeout: 1000 }
    );

    // Verify latency is approximately 100ms (with some tolerance)
    if (result.current.currentLatency !== null) {
      expect(result.current.currentLatency).toBeGreaterThan(80);
      expect(result.current.currentLatency).toBeLessThan(120);
    }
  });

  it('should calculate rolling average', async () => {
    let callCount = 0;
    mockExtractTimestamp.mockImplementation(() => {
      // Return timestamps with increasing latencies: 100ms, 110ms, 120ms
      callCount++;
      return Date.now() - (100 + callCount * 10);
    });

    const { result } = renderHook(() =>
      useVideoLatency(mockVideoRef, { samplingRate: 10 })
    );

    await waitFor(
      () => {
        expect(result.current.sampleCount).toBeGreaterThan(2);
      },
      { timeout: 1000 }
    );

    // Average should be calculated
    expect(result.current.averageLatency).not.toBeNull();
    if (result.current.averageLatency !== null) {
      expect(result.current.averageLatency).toBeGreaterThan(80);
      expect(result.current.averageLatency).toBeLessThan(200);
    }
  });

  it('should track min and max latencies', async () => {
    let callCount = 0;
    mockExtractTimestamp.mockImplementation(() => {
      callCount++;
      // Vary latencies: 50ms, 150ms, 100ms
      const latencies = [50, 150, 100];
      return Date.now() - latencies[callCount % 3];
    });

    const { result } = renderHook(() =>
      useVideoLatency(mockVideoRef, { samplingRate: 10 })
    );

    await waitFor(
      () => {
        expect(result.current.sampleCount).toBeGreaterThan(3);
      },
      { timeout: 1000 }
    );

    expect(result.current.minLatency).not.toBeNull();
    expect(result.current.maxLatency).not.toBeNull();

    if (result.current.minLatency !== null && result.current.maxLatency !== null) {
      expect(result.current.minLatency).toBeLessThan(result.current.maxLatency);
    }
  });

  it('should detect clock offset with negative latencies', async () => {
    // Mock timestamp extraction to return future timestamps (negative latency)
    mockExtractTimestamp.mockImplementation(() => {
      return Date.now() + 500; // 500ms in the future
    });

    const { result } = renderHook(() =>
      useVideoLatency(mockVideoRef, { samplingRate: 10, detectClockOffset: true })
    );

    await waitFor(
      () => {
        expect(result.current.sampleCount).toBeGreaterThan(5);
      },
      { timeout: 1000 }
    );

    // Should detect clock offset
    expect(result.current.clockOffset).not.toBeNull();
    if (result.current.clockOffset !== null) {
      expect(result.current.clockOffset).toBeGreaterThan(0);
    }
  });

  it('should respect maxSamples configuration', async () => {
    mockExtractTimestamp.mockImplementation(() => {
      return Date.now() - 100;
    });

    const maxSamples = 10;
    const { result } = renderHook(() =>
      useVideoLatency(mockVideoRef, { samplingRate: 20, maxSamples })
    );

    await waitFor(
      () => {
        expect(result.current.sampleCount).toBeGreaterThan(0);
      },
      { timeout: 1000 }
    );

    // Wait longer to ensure we exceed maxSamples attempts
    await waitFor(
      () => {
        expect(result.current.sampleCount).toBeGreaterThan(5);
      },
      { timeout: 2000 }
    );

    // Sample count should not exceed maxSamples
    expect(result.current.sampleCount).toBeLessThanOrEqual(maxSamples);
  });

  it('should handle extraction failures gracefully', async () => {
    // Mock extraction to fail (return null)
    mockExtractTimestamp.mockReturnValue(null);

    const { result } = renderHook(() =>
      useVideoLatency(mockVideoRef, { samplingRate: 10 })
    );

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should remain at initial state
    expect(result.current.currentLatency).toBeNull();
    expect(result.current.sampleCount).toBe(0);
  });

  it('should not sample when video is paused', async () => {
    Object.defineProperty(mockVideo, 'paused', { value: true, writable: true });

    mockExtractTimestamp.mockImplementation(() => {
      return Date.now() - 100;
    });

    const { result } = renderHook(() =>
      useVideoLatency(mockVideoRef, { samplingRate: 10 })
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should not have collected any samples
    expect(result.current.sampleCount).toBe(0);
  });

  it('should cleanup on unmount', () => {
    const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame');

    const { unmount } = renderHook(() =>
      useVideoLatency(mockVideoRef, { samplingRate: 10 })
    );

    unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalled();

    cancelAnimationFrameSpy.mockRestore();
  });
});
