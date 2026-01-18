/**
 * Standardized signaling error codes and messages.
 * Use these constants for consistent error responses across the signaling layer.
 */

export interface SignalingError {
  code: string;
  message: string;
}

/** Error codes for WebSocket signaling authentication and messaging. */
export const SignalingErrors = {
  /** Token is missing from join request. */
  MISSING_TOKEN: { code: 'missing_token', message: 'Token is required' },

  /** Token format is invalid (not a valid JWT). */
  INVALID_TOKEN: { code: 'invalid_token', message: 'Invalid token format' },

  /** Token session ID does not match requested session. */
  SESSION_MISMATCH: { code: 'session_mismatch', message: 'Token session does not match' },

  /** Token is not registered, revoked, or expired. */
  TOKEN_INVALID: { code: 'token_invalid', message: 'Token is not valid or expired' },

  /** Message could not be parsed as valid JSON. */
  INVALID_JSON: { code: 'invalid_json', message: 'Failed to parse message' },

  /** Client must join a session before sending signaling messages. */
  NOT_JOINED: { code: 'not_joined', message: 'Must join a session first' },

  /** Unknown message type received. */
  UNKNOWN_TYPE: { code: 'unknown_type', message: 'Unknown message type' },
} as const;

export type SignalingErrorCode = typeof SignalingErrors[keyof typeof SignalingErrors]['code'];
