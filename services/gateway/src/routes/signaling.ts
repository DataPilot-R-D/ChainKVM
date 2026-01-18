import type { FastifyInstance } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import type { WebSocket } from 'ws';
import type { SignalingMessage, ErrorMessage } from '../types.js';
import type { TokenRegistry } from '../tokens/index.js';
import { SignalingErrors } from './signaling-errors.js';

interface Peer {
  ws: WebSocket;
  role: 'operator' | 'robot';
  sessionId: string;
}

const rooms = new Map<string, Map<string, Peer>>();
let tokenRegistry: TokenRegistry | null = null;

export function setTokenRegistry(registry: TokenRegistry): void {
  tokenRegistry = registry;
}

function decodeTokenClaims(token: string): { jti: string; sid: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const { jti, sid } = payload;
    if (typeof jti !== 'string' || typeof sid !== 'string') return null;
    return { jti, sid };
  } catch {
    return null;
  }
}

function getPeerId(): string {
  return `peer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function broadcast(sessionId: string, message: SignalingMessage, excludePeerId?: string): void {
  const room = rooms.get(sessionId);
  if (!room) return;

  const payload = JSON.stringify(message);
  for (const [peerId, peer] of room) {
    if (peerId !== excludePeerId && peer.ws.readyState === 1) {
      peer.ws.send(payload);
    }
  }
}

function sendError(ws: WebSocket, code: string, message: string): void {
  const error: ErrorMessage = { type: 'error', code, message };
  ws.send(JSON.stringify(error));
}

function leaveRoom(peerId: string, sessionId: string): void {
  const room = rooms.get(sessionId);
  room?.delete(peerId);
  if (room?.size === 0) rooms.delete(sessionId);
}

function joinRoom(peerId: string, sessionId: string, ws: WebSocket, role: 'operator' | 'robot'): void {
  if (!rooms.has(sessionId)) rooms.set(sessionId, new Map());
  rooms.get(sessionId)!.set(peerId, { ws, role, sessionId });
}

interface PeerState {
  sessionId: string | null;
  role: 'operator' | 'robot' | null;
}

function validateJoinToken(
  msg: { session_id: string; token?: string },
): { error: { code: string; message: string } } | { claims: { jti: string; sid: string } } {
  if (!msg.token) {
    return { error: SignalingErrors.MISSING_TOKEN };
  }

  const claims = decodeTokenClaims(msg.token);
  if (!claims) {
    return { error: SignalingErrors.INVALID_TOKEN };
  }

  if (claims.sid !== msg.session_id) {
    return { error: SignalingErrors.SESSION_MISMATCH };
  }

  if (tokenRegistry && !tokenRegistry.isValid(claims.jti)) {
    return { error: SignalingErrors.TOKEN_INVALID };
  }

  return { claims };
}

function handleJoin(
  ws: WebSocket,
  peerId: string,
  state: PeerState,
  msg: { session_id: string; role: 'operator' | 'robot'; token?: string },
): void {
  const result = validateJoinToken(msg);
  if ('error' in result) {
    sendError(ws, result.error.code, result.error.message);
    return;
  }

  if (state.sessionId) leaveRoom(peerId, state.sessionId);

  state.sessionId = msg.session_id;
  state.role = msg.role;
  joinRoom(peerId, msg.session_id, ws, msg.role);

  broadcast(msg.session_id, { type: 'session_state', session_id: msg.session_id, state: `${msg.role}_joined` }, peerId);
  ws.send(JSON.stringify({ type: 'session_state', session_id: msg.session_id, state: 'joined' }));
}

function handleLeave(peerId: string, state: PeerState): void {
  if (!state.sessionId) return;

  leaveRoom(peerId, state.sessionId);
  broadcast(state.sessionId, { type: 'session_state', session_id: state.sessionId, state: `${state.role}_left` });
  state.sessionId = null;
  state.role = null;
}

function handleDisconnect(peerId: string, state: PeerState): void {
  if (!state.sessionId) return;

  const room = rooms.get(state.sessionId);
  room?.delete(peerId);

  if (room?.size === 0) {
    rooms.delete(state.sessionId);
  } else {
    broadcast(state.sessionId, { type: 'session_state', session_id: state.sessionId, state: `${state.role}_disconnected` });
  }
}

export async function signalingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/signal', { websocket: true }, (connection: SocketStream, request) => {
    const socket = connection.socket;
    const peerId = getPeerId();
    const state: PeerState = { sessionId: null, role: null };

    request.log.info({ peerId }, 'WebSocket connected');

    socket.on('message', (data: Buffer) => {
      let msg: SignalingMessage;
      try {
        msg = JSON.parse(data.toString()) as SignalingMessage;
      } catch {
        sendError(socket, SignalingErrors.INVALID_JSON.code, SignalingErrors.INVALID_JSON.message);
        return;
      }

      request.log.debug({ peerId, type: msg.type }, 'Received signaling message');

      switch (msg.type) {
        case 'join':
          handleJoin(socket, peerId, state, msg);
          break;
        case 'offer':
        case 'answer':
        case 'ice':
          if (!state.sessionId) {
            sendError(socket, SignalingErrors.NOT_JOINED.code, SignalingErrors.NOT_JOINED.message);
            return;
          }
          broadcast(state.sessionId, msg, peerId);
          break;
        case 'leave':
          handleLeave(peerId, state);
          break;
        default:
          sendError(socket, SignalingErrors.UNKNOWN_TYPE.code, `${SignalingErrors.UNKNOWN_TYPE.message}: ${(msg as { type: string }).type}`);
      }
    });

    socket.on('close', () => {
      request.log.info({ peerId }, 'WebSocket disconnected');
      handleDisconnect(peerId, state);
    });

    socket.on('error', (err) => {
      request.log.error({ peerId, err }, 'WebSocket error');
    });
  });
}

export function notifyRevocation(sessionId: string, reason: string): void {
  broadcast(sessionId, { type: 'revoked', session_id: sessionId, reason });

  const room = rooms.get(sessionId);
  if (!room) return;

  for (const peer of room.values()) {
    peer.ws.close(1000, 'Session revoked');
  }
  rooms.delete(sessionId);
}
