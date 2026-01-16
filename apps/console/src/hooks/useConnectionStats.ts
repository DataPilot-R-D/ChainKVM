import { useEffect, useRef, useState, useCallback } from 'react';

export interface ConnectionStats {
  rttMs: number;
  packetLossPercent: number;
  videoBitrateMbps: number;
  frameRate: number;
}

export type HealthStatus = 'good' | 'warning' | 'critical' | 'unknown';

export interface UseConnectionStatsOptions {
  enabled?: boolean;
  intervalMs?: number;
}

export interface UseConnectionStatsReturn {
  stats: ConnectionStats | null;
  healthStatus: HealthStatus;
}

type GetStatsFn = () => Promise<RTCStatsReport | null>;

const RTT_GOOD_THRESHOLD = 50;
const RTT_WARNING_THRESHOLD = 150;

export function useConnectionStats(
  getStats: GetStatsFn | null,
  options: UseConnectionStatsOptions = {}
): UseConnectionStatsReturn {
  const { enabled = true, intervalMs = 1000 } = options;

  const [stats, setStats] = useState<ConnectionStats | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('unknown');

  const prevBytesRef = useRef<number>(0);
  const prevTimestampRef = useRef<number>(0);

  const calculateHealthStatus = useCallback((rttMs: number): HealthStatus => {
    if (rttMs <= RTT_GOOD_THRESHOLD) return 'good';
    if (rttMs <= RTT_WARNING_THRESHOLD) return 'warning';
    return 'critical';
  }, []);

  const collectStats = useCallback(async () => {
    if (!getStats) return;

    try {
      const report = await getStats();
      if (!report) return;

      let rttMs = 0;
      let packetsReceived = 0;
      let packetsLost = 0;
      let bytesReceived = 0;
      let timestamp = 0;
      let frameRate = 0;

      report.forEach((stat) => {
        if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
          if (stat.currentRoundTripTime !== undefined) {
            rttMs = stat.currentRoundTripTime * 1000;
          }
        }

        if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
          if (stat.packetsReceived !== undefined) {
            packetsReceived = stat.packetsReceived;
          }
          if (stat.packetsLost !== undefined) {
            packetsLost = stat.packetsLost;
          }
          if (stat.bytesReceived !== undefined) {
            bytesReceived = stat.bytesReceived;
          }
          if (stat.timestamp !== undefined) {
            timestamp = stat.timestamp;
          }
          if (stat.framesPerSecond !== undefined) {
            frameRate = stat.framesPerSecond;
          }
        }
      });

      const totalPackets = packetsReceived + packetsLost;
      const packetLossPercent =
        totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0;

      let videoBitrateMbps = 0;
      if (prevTimestampRef.current > 0 && timestamp > prevTimestampRef.current) {
        const bytesDiff = bytesReceived - prevBytesRef.current;
        const timeDiffSec = (timestamp - prevTimestampRef.current) / 1000;
        videoBitrateMbps = (bytesDiff * 8) / timeDiffSec / 1_000_000;
      }

      prevBytesRef.current = bytesReceived;
      prevTimestampRef.current = timestamp;

      const newStats: ConnectionStats = {
        rttMs,
        packetLossPercent,
        videoBitrateMbps,
        frameRate,
      };

      setStats(newStats);
      setHealthStatus(rttMs > 0 ? calculateHealthStatus(rttMs) : 'unknown');
    } catch {
      // Stats collection failed, keep previous state
    }
  }, [getStats, calculateHealthStatus]);

  useEffect(() => {
    if (!enabled || !getStats) {
      return;
    }

    collectStats();
    const interval = setInterval(collectStats, intervalMs);

    return () => clearInterval(interval);
  }, [enabled, getStats, intervalMs, collectStats]);

  return { stats, healthStatus };
}
