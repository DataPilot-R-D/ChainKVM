// API types for ChainKVM Gateway

// ============ Session Management ============

export interface CreateSessionRequest {
  robot_id: string;
  operator_did: string;
  vc_or_vp: string; // JWT-encoded VC/VP
  requested_scope: string[];
}

export interface CreateSessionResponse {
  session_id: string;
  capability_token: string;
  signaling_url: string;
  ice_servers: IceServer[];
  expires_at: string; // ISO 8601
  effective_scope: string[];
  limits: SessionLimits;
  policy: PolicyInfo;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface SessionLimits {
  max_control_rate_hz: number;
  max_video_bitrate_kbps: number;
}

export interface PolicyInfo {
  policy_id: string;
  version: string;
  hash: string;
}

export interface SessionState {
  session_id: string;
  robot_id: string;
  operator_did: string;
  state: 'pending' | 'active' | 'terminated' | 'revoked';
  created_at: string;
  expires_at: string;
  effective_scope: string[];
}

// ============ Revocation ============

export interface CreateRevocationRequest {
  session_id?: string;
  operator_did?: string;
  reason: string;
}

export interface CreateRevocationResponse {
  revocation_id: string;
  affected_sessions: string[];
  timestamp: string;
}

// ============ Audit ============

export interface AuditEvent {
  event_id: string;
  timestamp: string;
  robot_id: string;
  operator_did: string;
  session_id: string;
  event_type: AuditEventType;
  metadata: Record<string, unknown>;
}

export type AuditEventType =
  | 'SESSION_REQUESTED'
  | 'SESSION_GRANTED'
  | 'SESSION_STARTED'
  | 'SESSION_ENDED'
  | 'SESSION_REVOKED'
  | 'PRIVILEGED_ACTION';

export interface AuditQueryParams {
  session_id?: string;
  robot_id?: string;
  actor_did?: string;
  event_type?: AuditEventType;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

export interface AuditEventsResponse {
  events: AuditEvent[];
  total: number;
  page: number;
  page_size: number;
}

// ============ JWKS ============

export interface JWK {
  kty: string;
  crv: string;
  x: string;
  kid: string;
  use: string;
  alg: string;
}

export interface JWKS {
  keys: JWK[];
}

// ============ Signaling ============

export type SignalingMessage =
  | JoinMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage
  | LeaveMessage
  | SessionStateMessage
  | RevokedMessage
  | ErrorMessage;

export interface JoinMessage {
  type: 'join';
  session_id: string;
  role: 'operator' | 'robot';
}

export interface OfferMessage {
  type: 'offer';
  session_id: string;
  sdp: string;
}

export interface AnswerMessage {
  type: 'answer';
  session_id: string;
  sdp: string;
}

export interface IceCandidateMessage {
  type: 'ice';
  session_id: string;
  candidate: string;
}

export interface LeaveMessage {
  type: 'leave';
  session_id: string;
}

export interface SessionStateMessage {
  type: 'session_state';
  session_id: string;
  state: string;
}

export interface RevokedMessage {
  type: 'revoked';
  session_id: string;
  reason: string;
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}
