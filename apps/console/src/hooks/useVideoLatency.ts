import { useEffect, useRef, useState, RefObject } from 'react';
import { useFrameTimestamps } from './useFrameTimestamps';

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
 * Hook for measuring video latency from DataChannel frame timestamps.
 *
 * Receives frame timestamps via WebRTC DataChannel and calculates
 * end-to-end latency by comparing with current time.
 *
 * @param videoRef - Reference to HTMLVideoElement (unused, kept for compatibility)
 * @param dataChannel - RTCDataChannel for receiving timestamps
 * @param config - Optional configuration
 * @returns Current latency measurements
 */
export function useVideoLatency(
  videoRef: RefObject<HTMLVideoElement>,
  dataChannel: RTCDataChannel | null,
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

  const samplesRef = useRef<number[]>([]);
  const timestampBuffer = useFrameTimestamps(dataChannel);
  const lastProcessedCountRef = useRef<number>(0);

  useEffect(() => {
    // Process new timestamps from DataChannel
    const newTimestampCount = timestampBuffer.timestamps.length;

    if (newTimestampCount === 0 || newTimestampCount === lastProcessedCountRef.current) {
      return;
    }

    // Get newly received timestamps
    const newTimestamps = timestampBuffer.timestamps.slice(lastProcessedCountRef.current);
    lastProcessedCountRef.current = newTimestampCount;

    // Calculate latency for each new timestamp
    const currentTime = Date.now();
    const samples = samplesRef.current;

    for (const timestamp of newTimestamps) {
      const latency = currentTime - timestamp;
      samples.push(latency);

      // Keep only last maxSamples
      if (samples.length > cfg.maxSamples) {
        samples.shift();
      }
    }

    // Get the most recent latency for currentLatency
    const latency = samples[samples.length - 1];

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
  }, [timestampBuffer.timestamps, cfg.maxSamples, cfg.detectClockOffset]);

  return latencyData;
}
