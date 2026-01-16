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

interface RawStats {
  rttMs: number;
  packetsReceived: number;
  packetsLost: number;
  bytesReceived: number;
  timestamp: number;
  frameRate: number;
}

function parseStatsReport(report: RTCStatsReport): RawStats {
  const raw: RawStats = {
    rttMs: 0, packetsReceived: 0, packetsLost: 0,
    bytesReceived: 0, timestamp: 0, frameRate: 0,
  };

  report.forEach((stat) => {
    if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
      if (stat.currentRoundTripTime !== undefined) {
        raw.rttMs = stat.currentRoundTripTime * 1000;
      }
    }
    if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
      raw.packetsReceived = stat.packetsReceived ?? 0;
      raw.packetsLost = stat.packetsLost ?? 0;
      raw.bytesReceived = stat.bytesReceived ?? 0;
      raw.timestamp = stat.timestamp ?? 0;
      raw.frameRate = stat.framesPerSecond ?? 0;
    }
  });

  return raw;
}

function calculatePacketLoss(received: number, lost: number): number {
  const total = received + lost;
  return total > 0 ? (lost / total) * 100 : 0;
}

function calculateBitrate(
  bytes: number, timestamp: number,
  prevBytes: number, prevTimestamp: number
): number {
  if (prevTimestamp <= 0 || timestamp <= prevTimestamp) return 0;
  const bytesDiff = bytes - prevBytes;
  const timeDiffSec = (timestamp - prevTimestamp) / 1000;
  return (bytesDiff * 8) / timeDiffSec / 1_000_000;
}

function calculateHealthStatus(rttMs: number): HealthStatus {
  if (rttMs <= RTT_GOOD_THRESHOLD) return 'good';
  if (rttMs <= RTT_WARNING_THRESHOLD) return 'warning';
  return 'critical';
}

export function useConnectionStats(
  getStats: GetStatsFn | null,
  options: UseConnectionStatsOptions = {}
): UseConnectionStatsReturn {
  const { enabled = true, intervalMs = 1000 } = options;

  const [stats, setStats] = useState<ConnectionStats | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('unknown');

  const prevBytesRef = useRef<number>(0);
  const prevTimestampRef = useRef<number>(0);

  const collectStats = useCallback(async () => {
    if (!getStats) return;

    try {
      const report = await getStats();
      if (!report) {
        console.debug('[useConnectionStats] getStats returned null');
        return;
      }

      const raw = parseStatsReport(report);
      const packetLossPercent = calculatePacketLoss(raw.packetsReceived, raw.packetsLost);
      const videoBitrateMbps = calculateBitrate(
        raw.bytesReceived, raw.timestamp,
        prevBytesRef.current, prevTimestampRef.current
      );

      prevBytesRef.current = raw.bytesReceived;
      prevTimestampRef.current = raw.timestamp;

      setStats({ rttMs: raw.rttMs, packetLossPercent, videoBitrateMbps, frameRate: raw.frameRate });
      setHealthStatus(raw.rttMs > 0 ? calculateHealthStatus(raw.rttMs) : 'unknown');
    } catch (error) {
      console.error('[useConnectionStats] Failed to collect WebRTC stats:', error);
    }
  }, [getStats]);

  useEffect(() => {
    if (!enabled || !getStats) return;

    collectStats();
    const interval = setInterval(collectStats, intervalMs);
    return () => clearInterval(interval);
  }, [enabled, getStats, intervalMs, collectStats]);

  return { stats, healthStatus };
}
