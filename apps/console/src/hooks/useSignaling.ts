import { useCallback, useEffect, useRef, useState } from 'react';

export type SignalingMessageType =
  | 'join'
  | 'offer'
  | 'answer'
  | 'ice'
  | 'leave'
  | 'session_state'
  | 'revoked'
  | 'error';

export interface SignalingMessage {
  type: SignalingMessageType;
  session_id?: string;
  role?: 'operator' | 'robot';
  token?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  state?: string;
  reason?: string;
  code?: string;
  message?: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseSignalingOptions {
  url: string;
  enabled?: boolean;
  onOffer?: (sessionId: string, sdp: RTCSessionDescriptionInit) => void;
  onAnswer?: (sessionId: string, sdp: RTCSessionDescriptionInit) => void;
  onIceCandidate?: (sessionId: string, candidate: RTCIceCandidateInit) => void;
  onSessionState?: (sessionId: string, state: string) => void;
  onRevoked?: (sessionId: string, reason: string) => void;
  onError?: (code: string, message: string) => void;
}

export interface UseSignalingReturn {
  status: ConnectionStatus;
  revocationReason: string | null;
  sendJoin: (sessionId: string, role: 'operator' | 'robot', token: string) => void;
  sendOffer: (sessionId: string, sdp: RTCSessionDescriptionInit) => void;
  sendAnswer: (sessionId: string, sdp: RTCSessionDescriptionInit) => void;
  sendIce: (sessionId: string, candidate: RTCIceCandidateInit) => void;
  sendLeave: () => void;
  disconnect: () => void;
}

export function useSignaling({
  url,
  enabled = true,
  onOffer,
  onAnswer,
  onIceCandidate,
  onSessionState,
  onRevoked,
  onError,
}: UseSignalingOptions): UseSignalingReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [revocationReason, setRevocationReason] = useState<string | null>(null);

  // Handle incoming messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      let msg: SignalingMessage;
      try {
        msg = JSON.parse(event.data) as SignalingMessage;
      } catch {
        console.error('[Signaling] Invalid message format');
        return;
      }

      switch (msg.type) {
        case 'offer':
          if (msg.session_id && msg.sdp) {
            onOffer?.(msg.session_id, msg.sdp);
          }
          break;
        case 'answer':
          if (msg.session_id && msg.sdp) {
            onAnswer?.(msg.session_id, msg.sdp);
          }
          break;
        case 'ice':
          if (msg.session_id && msg.candidate) {
            onIceCandidate?.(msg.session_id, msg.candidate);
          }
          break;
        case 'session_state':
          if (msg.session_id && msg.state) {
            onSessionState?.(msg.session_id, msg.state);
          }
          break;
        case 'revoked': {
          const reason = msg.reason || 'Unknown reason';
          console.warn('[Signaling] Session revoked:', reason);
          setRevocationReason(reason);
          onRevoked?.(msg.session_id || '', reason);
          break;
        }
        case 'error':
          console.error('[Signaling] Error:', msg.code, msg.message);
          onError?.(msg.code || 'UNKNOWN', msg.message || 'Unknown error');
          break;
      }
    },
    [onOffer, onAnswer, onIceCandidate, onSessionState, onRevoked, onError]
  );

  // Connect to signaling server
  useEffect(() => {
    if (!enabled) {
      return;
    }

    setStatus('connecting');
    setRevocationReason(null);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Signaling] Connected');
      setStatus('connected');
    };

    ws.onmessage = handleMessage;

    ws.onclose = (event) => {
      console.log('[Signaling] Disconnected:', event.code, event.reason);
      setStatus('disconnected');
    };

    ws.onerror = () => {
      console.error('[Signaling] Connection error');
      setStatus('error');
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [url, enabled, handleMessage]);

  // Send message helper
  const send = useCallback((msg: SignalingMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[Signaling] Cannot send - not connected');
      return;
    }
    ws.send(JSON.stringify(msg));
  }, []);

  const sendJoin = useCallback(
    (sessionId: string, role: 'operator' | 'robot', token: string) => {
      send({ type: 'join', session_id: sessionId, role, token });
    },
    [send]
  );

  const sendOffer = useCallback(
    (sessionId: string, sdp: RTCSessionDescriptionInit) => {
      send({ type: 'offer', session_id: sessionId, sdp });
    },
    [send]
  );

  const sendAnswer = useCallback(
    (sessionId: string, sdp: RTCSessionDescriptionInit) => {
      send({ type: 'answer', session_id: sessionId, sdp });
    },
    [send]
  );

  const sendIce = useCallback(
    (sessionId: string, candidate: RTCIceCandidateInit) => {
      send({ type: 'ice', session_id: sessionId, candidate });
    },
    [send]
  );

  const sendLeave = useCallback(() => {
    send({ type: 'leave' });
  }, [send]);

  const disconnect = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      ws.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  return {
    status,
    revocationReason,
    sendJoin,
    sendOffer,
    sendAnswer,
    sendIce,
    sendLeave,
    disconnect,
  };
}
