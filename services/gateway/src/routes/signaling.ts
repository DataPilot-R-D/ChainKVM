import type { FastifyInstance } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import type { WebSocket } from 'ws';
import type { SignalingMessage, ErrorMessage } from '../types.js';

// Room-based signaling: session_id -> connected peers
interface Peer {
  ws: WebSocket;
  role: 'operator' | 'robot';
  sessionId: string;
}

const rooms = new Map<string, Map<string, Peer>>();

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

export async function signalingRoutes(app: FastifyInstance): Promise<void> {
  // WebSocket signaling endpoint
  app.get('/v1/signal', { websocket: true }, (connection: SocketStream, request) => {
    const socket = connection.socket;
    const peerId = getPeerId();
    let currentSessionId: string | null = null;
    let currentRole: 'operator' | 'robot' | null = null;

    request.log.info({ peerId }, 'WebSocket connected');

    socket.on('message', (data: Buffer) => {
      let msg: SignalingMessage;
      try {
        msg = JSON.parse(data.toString()) as SignalingMessage;
      } catch {
        sendError(socket, 'invalid_json', 'Failed to parse message');
        return;
      }

      request.log.debug({ peerId, type: msg.type }, 'Received signaling message');

      switch (msg.type) {
        case 'join': {
          // TODO: Validate capability token from Authorization header (M3-010)
          const { session_id, role } = msg;

          // Leave previous room if any
          if (currentSessionId) {
            const oldRoom = rooms.get(currentSessionId);
            oldRoom?.delete(peerId);
            if (oldRoom?.size === 0) rooms.delete(currentSessionId);
          }

          // Join new room
          currentSessionId = session_id;
          currentRole = role;

          if (!rooms.has(session_id)) {
            rooms.set(session_id, new Map());
          }
          rooms.get(session_id)!.set(peerId, { ws: socket, role, sessionId: session_id });

          // Notify other peers in the room
          broadcast(session_id, { type: 'session_state', session_id, state: `${role}_joined` }, peerId);

          // Confirm join
          socket.send(JSON.stringify({ type: 'session_state', session_id, state: 'joined' }));
          break;
        }

        case 'offer':
        case 'answer':
        case 'ice': {
          if (!currentSessionId) {
            sendError(socket, 'not_joined', 'Must join a session first');
            return;
          }
          // Forward to other peers in the same session
          broadcast(currentSessionId, msg, peerId);
          break;
        }

        case 'leave': {
          if (currentSessionId) {
            const room = rooms.get(currentSessionId);
            room?.delete(peerId);
            if (room?.size === 0) rooms.delete(currentSessionId);
            broadcast(currentSessionId, { type: 'session_state', session_id: currentSessionId, state: `${currentRole}_left` });
            currentSessionId = null;
            currentRole = null;
          }
          break;
        }

        default:
          sendError(socket, 'unknown_type', `Unknown message type: ${(msg as { type: string }).type}`);
      }
    });

    socket.on('close', () => {
      request.log.info({ peerId }, 'WebSocket disconnected');
      if (currentSessionId) {
        const room = rooms.get(currentSessionId);
        room?.delete(peerId);
        if (room?.size === 0) {
          rooms.delete(currentSessionId);
        } else {
          broadcast(currentSessionId, {
            type: 'session_state',
            session_id: currentSessionId,
            state: `${currentRole}_disconnected`,
          });
        }
      }
    });

    socket.on('error', (err) => {
      request.log.error({ peerId, err }, 'WebSocket error');
    });
  });
}

// Export for revocation integration
export function notifyRevocation(sessionId: string, reason: string): void {
  broadcast(sessionId, { type: 'revoked', session_id: sessionId, reason });
  // Close all connections in the room
  const room = rooms.get(sessionId);
  if (room) {
    for (const peer of room.values()) {
      peer.ws.close(1000, 'Session revoked');
    }
    rooms.delete(sessionId);
  }
}
