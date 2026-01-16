import { useCallback, useEffect, useRef, useState } from 'react';

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

export interface SignalingCallbacks {
  onLocalOffer: (offer: RTCSessionDescriptionInit) => void;
  onLocalAnswer: (answer: RTCSessionDescriptionInit) => void;
  onIceCandidate: (candidate: RTCIceCandidate) => void;
}

export interface ReconnectConfig {
  enabled: boolean;
  maxAttempts: number;
  delayMs: number;
}

export interface UseWebRTCOptions {
  config: WebRTCConfig;
  signaling: SignalingCallbacks;
  enabled?: boolean;
  reconnect?: ReconnectConfig;
  onTrack?: (track: MediaStreamTrack, stream: MediaStream) => void;
  onReconnectFailed?: () => void;
  onIceGatheringComplete?: () => void;
}

export interface UseWebRTCReturn {
  connectionState: RTCPeerConnectionState;
  isConnected: boolean;
  dataChannelState: RTCDataChannelState;
  remoteStream: MediaStream | null;
  reconnectAttempts: number;
  iceGatheringState: RTCIceGatheringState;
  iceConnectionState: RTCIceConnectionState;
  createOffer: () => Promise<void>;
  handleRemoteOffer: (offer: RTCSessionDescriptionInit) => Promise<void>;
  handleRemoteAnswer: (answer: RTCSessionDescriptionInit) => Promise<void>;
  addIceCandidate: (candidate: RTCIceCandidateInit) => Promise<void>;
  createDataChannel: (
    label: string,
    options?: RTCDataChannelInit
  ) => RTCDataChannel | null;
  disconnect: () => void;
  restartIce: () => Promise<void>;
  getConnectionStats: () => Promise<RTCStatsReport | null>;
}

export function useWebRTC({
  config,
  signaling,
  enabled = true,
  reconnect,
  onTrack,
  onReconnectFailed,
  onIceGatheringComplete,
}: UseWebRTCOptions): UseWebRTCReturn {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasConnectedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);

  const [connectionState, setConnectionState] =
    useState<RTCPeerConnectionState>('new');
  const [dataChannelState, setDataChannelState] =
    useState<RTCDataChannelState>('closed');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [iceGatheringState, setIceGatheringState] =
    useState<RTCIceGatheringState>('new');
  const [iceConnectionState, setIceConnectionState] =
    useState<RTCIceConnectionState>('new');

  const isConnected = connectionState === 'connected';

  // Initialize peer connection
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const pc = new RTCPeerConnection({
      iceServers: config.iceServers,
    });

    peerConnectionRef.current = pc;

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);

      if (pc.connectionState === 'connected') {
        wasConnectedRef.current = true;
        reconnectAttemptsRef.current = 0;
        setReconnectAttempts(0);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      }

      if (
        pc.connectionState === 'disconnected' &&
        wasConnectedRef.current &&
        reconnect?.enabled
      ) {
        scheduleReconnect();
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signaling.onIceCandidate(event.candidate);
      }
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      setIceConnectionState(pc.iceConnectionState);
    };

    // Handle ICE gathering state changes
    pc.onicegatheringstatechange = () => {
      setIceGatheringState(pc.iceGatheringState);
      if (pc.iceGatheringState === 'complete') {
        onIceGatheringComplete?.();
      }
    };

    // Handle incoming tracks
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      setRemoteStream(stream);
      onTrack?.(event.track, stream);
    };

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      pc.close();
    };
  }, [enabled, config.iceServers, signaling, onTrack, reconnect?.enabled, onIceGatheringComplete]);

  // Schedule reconnection attempt
  const scheduleReconnect = useCallback(() => {
    if (!reconnect?.enabled) return;

    // Use ref to avoid stale closure issues
    if (reconnectAttemptsRef.current >= reconnect.maxAttempts) {
      onReconnectFailed?.();
      return;
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current += 1;
      const newAttempts = reconnectAttemptsRef.current;
      setReconnectAttempts(newAttempts);

      if (newAttempts >= reconnect.maxAttempts) {
        onReconnectFailed?.();
        return;
      }

      // Re-schedule if still disconnected
      const pc = peerConnectionRef.current;
      if (pc && pc.connectionState === 'disconnected') {
        scheduleReconnect();
      }
    }, reconnect.delayMs);
  }, [reconnect, onReconnectFailed]);

  // Create and send offer
  const createOffer = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    signaling.onLocalOffer(offer);
  }, [signaling]);

  // Handle remote offer and create answer
  const handleRemoteOffer = useCallback(
    async (offer: RTCSessionDescriptionInit) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      signaling.onLocalAnswer(answer);
    },
    [signaling]
  );

  // Handle remote answer
  const handleRemoteAnswer = useCallback(
    async (answer: RTCSessionDescriptionInit) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      await pc.setRemoteDescription(answer);
    },
    []
  );

  // Add ICE candidate
  const addIceCandidate = useCallback(
    async (candidate: RTCIceCandidateInit) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      await pc.addIceCandidate(candidate);
    },
    []
  );

  // Create DataChannel
  const createDataChannel = useCallback(
    (label: string, options?: RTCDataChannelInit): RTCDataChannel | null => {
      const pc = peerConnectionRef.current;
      if (!pc) return null;

      const channel = pc.createDataChannel(label, options);
      dataChannelRef.current = channel;

      setDataChannelState('connecting');

      channel.onopen = () => {
        setDataChannelState('open');
      };

      channel.onclose = () => {
        setDataChannelState('closed');
      };

      return channel;
    },
    []
  );

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const channel = dataChannelRef.current;
    if (channel) {
      channel.close();
    }

    const pc = peerConnectionRef.current;
    if (pc) {
      pc.close();
    }
  }, []);

  // Restart ICE (for network changes)
  const restartIce = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    pc.restartIce();
    const offer = await pc.createOffer({ iceRestart: true });
    await pc.setLocalDescription(offer);
    signaling.onLocalOffer(offer);
  }, [signaling]);

  // Get connection stats for diagnostics
  const getConnectionStats = useCallback(async (): Promise<RTCStatsReport | null> => {
    const pc = peerConnectionRef.current;
    if (!pc) return null;

    return pc.getStats();
  }, []);

  return {
    connectionState,
    isConnected,
    dataChannelState,
    remoteStream,
    reconnectAttempts,
    iceGatheringState,
    iceConnectionState,
    createOffer,
    handleRemoteOffer,
    handleRemoteAnswer,
    addIceCandidate,
    createDataChannel,
    disconnect,
    restartIce,
    getConnectionStats,
  };
}
