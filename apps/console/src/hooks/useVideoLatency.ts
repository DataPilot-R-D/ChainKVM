import { useEffect, useRef, useState, RefObject } from 'react';
import { extractTimestamp } from '../utils/timestampOCR';

/**
 * Video latency measurement data.
 */
export interface VideoLatencyData {
  /** Current latency in milliseconds */
  currentLatency: number | null;
  /** Rolling average latency over last N samples */
  averageLatency: number | null;
  /** Minimum latency observed */
  minLatency: number | null;
  /** Maximum latency observed */
  maxLatency: number | null;
  /** Number of samples collected */
  sampleCount: number;
  /** Estimated clock offset (negative latencies indicate offset) */
  clockOffset: number | null;
}

/**
 * Configuration for video latency measurement.
 */
export interface VideoLatencyConfig {
  /** Sampling rate in Hz (default: 5) */
  samplingRate?: number;
  /** Maximum samples for rolling average (default: 100) */
  maxSamples?: number;
  /** Enable clock offset detection (default: true) */
  detectClockOffset?: boolean;
}

const DEFAULT_CONFIG: Required<VideoLatencyConfig> = {
  samplingRate: 5,
  maxSamples: 100,
  detectClockOffset: true,
};

/**
 * Hook for measuring video latency from timestamp-overlayed frames.
 *
 * Samples video frames using canvas, extracts overlayed timestamp,
 * and calculates end-to-end latency.
 *
 * @param videoRef - Reference to HTMLVideoElement
 * @param config - Optional configuration
 * @returns Current latency measurements
 */
export function useVideoLatency(
  videoRef: RefObject<HTMLVideoElement>,
  config: VideoLatencyConfig = {}
): VideoLatencyData {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const [latencyData, setLatencyData] = useState<VideoLatencyData>({
    currentLatency: null,
    averageLatency: null,
    minLatency: null,
    maxLatency: null,
    sampleCount: 0,
    clockOffset: null,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const samplesRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastSampleTimeRef = useRef<number>(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    // Create hidden canvas for frame sampling
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 200; // Overlay region width
      canvasRef.current.height = 50; // Overlay region height
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const samplingInterval = 1000 / cfg.samplingRate;
    let isRunning = true;

    const sampleFrame = () => {
      if (!isRunning) {
        return;
      }

      const now = performance.now();

      // Throttle sampling to configured rate
      if (now - lastSampleTimeRef.current < samplingInterval) {
        animationFrameRef.current = requestAnimationFrame(sampleFrame);
        return;
      }

      lastSampleTimeRef.current = now;

      // Check if video is playing
      if (video.paused || video.ended || !video.videoWidth) {
        animationFrameRef.current = requestAnimationFrame(sampleFrame);
        return;
      }

      try {
        // Draw top-left region of video to canvas (where timestamp overlay is)
        ctx.drawImage(
          video,
          0,
          0,
          200,
          50,
          0,
          0,
          200,
          50
        );

        // Extract image data
        const imageData = ctx.getImageData(0, 0, 200, 50);

        // Extract timestamp
        const frameTimestamp = extractTimestamp(imageData);

        if (frameTimestamp !== null) {
          // Calculate latency: current time - frame timestamp
          const currentTime = Date.now();
          const latency = currentTime - frameTimestamp;

          // Update samples
          const samples = samplesRef.current;
          samples.push(latency);

          // Keep only last maxSamples
          if (samples.length > cfg.maxSamples) {
            samples.shift();
          }

          // Calculate statistics
          const validSamples = samples.filter((s) => s >= 0 || !cfg.detectClockOffset);
          const sum = validSamples.reduce((acc, s) => acc + s, 0);
          const avg = validSamples.length > 0 ? sum / validSamples.length : null;
          const min = validSamples.length > 0 ? Math.min(...validSamples) : null;
          const max = validSamples.length > 0 ? Math.max(...validSamples) : null;

          // Detect clock offset (negative latencies)
          let clockOffset = null;
          const negativeSamples = samples.filter((s) => s < 0);
          if (cfg.detectClockOffset && negativeSamples.length > samples.length / 4) {
            // More than 25% negative samples indicates clock offset
            clockOffset = Math.abs(Math.min(...negativeSamples));
            if (clockOffset > 100) {
              console.warn(
                `[VideoLatency] Large clock offset detected: ${clockOffset}ms. ` +
                  'Measurements may be inaccurate. Consider NTP sync.'
              );
            }
          }

          setLatencyData({
            currentLatency: latency,
            averageLatency: avg,
            minLatency: min,
            maxLatency: max,
            sampleCount: samples.length,
            clockOffset,
          });
        }
      } catch (error) {
        // Silently handle extraction errors (video might not be ready)
        console.debug('[VideoLatency] Frame sampling error:', error);
      }

      animationFrameRef.current = requestAnimationFrame(sampleFrame);
    };

    // Start sampling
    animationFrameRef.current = requestAnimationFrame(sampleFrame);

    // Cleanup
    return () => {
      isRunning = false;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [videoRef, cfg.samplingRate, cfg.maxSamples, cfg.detectClockOffset]);

  return latencyData;
}
