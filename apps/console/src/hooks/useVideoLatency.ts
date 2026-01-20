import { useEffect, useRef, useState, RefObject } from 'react';
import { useFrameTimestamps, TimestampBuffer } from './useFrameTimestamps';

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
  /** Error message if latency calculation failed */
  error: string | null;
  /** Timestamp buffer with parse error tracking */
  timestampBuffer: TimestampBuffer;
}

/**
 * Configuration for video latency measurement.
 */
export interface VideoLatencyConfig {
  /**
   * Sampling rate in Hz (default: 5)
   * @deprecated Currently unused. Rate is controlled by robot agent's sendInterval.
   * Kept for future client-side rate limiting if needed.
   */
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
 * @param videoRef - Reference to HTMLVideoElement. Currently unused as latency is calculated
 *   from DataChannel timestamps rather than video frame analysis. Kept for API compatibility
 *   and potential future use with frame correlation.
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
    error: null,
    timestampBuffer: {
      timestamps: [],
      lastSequence: 0,
      droppedMessages: 0,
      parseErrors: 0,
      lastError: null,
    },
  });

  const samplesRef = useRef<number[]>([]);
  const timestampBuffer = useFrameTimestamps(dataChannel);
  const lastProcessedCountRef = useRef<number>(0);
  const prevClockOffsetRef = useRef<number | null>(null);

  useEffect(() => {
    // Validate configuration
    if (cfg.maxSamples <= 0) {
      console.error('[VideoLatency] Invalid maxSamples:', cfg.maxSamples);
      return;
    }

    // Process new timestamps from DataChannel
    const newTimestampCount = timestampBuffer.timestamps.length;

    // Detect buffer reset (e.g., DataChannel reconnection) and clear stale samples
    if (newTimestampCount < lastProcessedCountRef.current) {
      samplesRef.current = [];
      lastProcessedCountRef.current = 0;
    }

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

    // Detect clock offset (negative latencies) with hysteresis to prevent thrashing
    const TRIGGER_THRESHOLD = 0.25; // 25% to trigger
    const CLEAR_THRESHOLD = 0.2; // 20% to clear (hysteresis)

    let clockOffset: number | null = null;
    const negativeSamples = samples.filter((s) => s < 0);
    const negativeRatio = samples.length > 0 ? negativeSamples.length / samples.length : 0;

    if (cfg.detectClockOffset) {
      if (negativeRatio >= TRIGGER_THRESHOLD) {
        // Trigger: 25% or more negative samples
        clockOffset = Math.abs(Math.min(...negativeSamples));
        if (clockOffset > 100 && prevClockOffsetRef.current === null) {
          console.warn(
            `[VideoLatency] Large clock offset detected: ${clockOffset}ms. ` +
              'Measurements may be inaccurate. Consider NTP sync.'
          );
        }
      } else if (prevClockOffsetRef.current !== null && negativeRatio >= CLEAR_THRESHOLD) {
        // Maintain: between 20-25%, keep previous offset (hysteresis)
        clockOffset = prevClockOffsetRef.current;
      }
      // Clear: below 20% - clockOffset stays null
    }
    prevClockOffsetRef.current = clockOffset;

    setLatencyData({
      currentLatency: latency,
      averageLatency: avg,
      minLatency: min,
      maxLatency: max,
      sampleCount: samples.length,
      clockOffset,
      error: null,
      timestampBuffer: timestampBuffer,
    });
  }, [timestampBuffer, cfg.maxSamples, cfg.detectClockOffset]);

  return {
    ...latencyData,
    timestampBuffer, // Always return fresh timestampBuffer
  };
}
