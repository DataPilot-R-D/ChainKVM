// Gateway configuration

export interface Config {
  port: number;
  host: string;
  turnUrl: string;
  turnSecret: string;
  stunUrl: string;
  sessionTtlSeconds: number;
  maxControlRateHz: number;
  maxVideoBitrateKbps: number;
}

export function loadConfig(): Config {
  return {
    port: parseInt(process.env.PORT ?? '4000', 10),
    host: process.env.HOST ?? '0.0.0.0',
    turnUrl: process.env.TURN_URL ?? 'turn:localhost:3478',
    turnSecret: process.env.TURN_SECRET ?? 'chainkvm-dev-secret-change-in-prod',
    stunUrl: process.env.STUN_URL ?? 'stun:stun.l.google.com:19302',
    sessionTtlSeconds: parseInt(process.env.SESSION_TTL_SECONDS ?? '3600', 10),
    maxControlRateHz: parseInt(process.env.MAX_CONTROL_RATE_HZ ?? '20', 10),
    maxVideoBitrateKbps: parseInt(process.env.MAX_VIDEO_BITRATE_KBPS ?? '4000', 10),
  };
}
