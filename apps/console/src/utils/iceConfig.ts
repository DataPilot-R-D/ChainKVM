/**
 * ICE (Interactive Connectivity Establishment) configuration utilities
 * for WebRTC peer connections with STUN/TURN support.
 */

export const DEFAULT_STUN_SERVERS: string[] = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
];

export interface TurnCredentials {
  urls: string[];
  username: string;
  credential: string;
}

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface CreateIceConfigOptions {
  stunServers?: string[];
  turnCredentials?: TurnCredentials;
  iceCandidatePoolSize?: number;
  iceTransportPolicy?: RTCIceTransportPolicy;
  bundlePolicy?: RTCBundlePolicy;
}

export interface IceConfig extends RTCConfiguration {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize: number;
  iceTransportPolicy: RTCIceTransportPolicy;
  bundlePolicy: RTCBundlePolicy;
}

/**
 * Creates an ICE configuration for RTCPeerConnection
 */
export function createIceConfig(options: CreateIceConfigOptions = {}): IceConfig {
  const {
    stunServers = DEFAULT_STUN_SERVERS,
    turnCredentials,
    iceCandidatePoolSize = 0,
    iceTransportPolicy = 'all',
    bundlePolicy = 'balanced',
  } = options;

  const iceServers: RTCIceServer[] = [];

  // Add STUN servers
  if (stunServers.length > 0) {
    iceServers.push({
      urls: stunServers,
    });
  }

  // Add TURN server if credentials provided
  if (turnCredentials) {
    iceServers.push({
      urls: turnCredentials.urls,
      username: turnCredentials.username,
      credential: turnCredentials.credential,
    });
  }

  return {
    iceServers,
    iceCandidatePoolSize,
    iceTransportPolicy,
    bundlePolicy,
  };
}

/**
 * Gets ICE servers list, optionally with TURN credentials
 */
export function getIceServers(turnCredentials?: TurnCredentials): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    {
      urls: DEFAULT_STUN_SERVERS,
    },
  ];

  if (turnCredentials) {
    servers.push({
      urls: turnCredentials.urls,
      username: turnCredentials.username,
      credential: turnCredentials.credential,
    });
  }

  return servers;
}
