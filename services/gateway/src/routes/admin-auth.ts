/**
 * Admin authentication helpers for protected endpoints.
 */

import { timingSafeEqual } from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Config } from '../config.js';

export type AdminAuthErrorCode = 'missing_admin_key' | 'invalid_admin_key';

export interface AdminAuthError {
  error: AdminAuthErrorCode;
  message: string;
}

/** Extract admin API key from request headers. */
export function extractAdminKey(request: FastifyRequest): string | null {
  const key = request.headers['x-admin-api-key'];
  if (typeof key !== 'string') return null;
  return key;
}

/** Validate admin API key using timing-safe comparison. */
export function validateAdminKey(key: string | null, config: Config): boolean {
  if (!key) return false;
  const keyBuffer = Buffer.from(key);
  const configBuffer = Buffer.from(config.adminApiKey);
  if (keyBuffer.length !== configBuffer.length) return false;
  return timingSafeEqual(keyBuffer, configBuffer);
}

/** Log admin auth failure for security monitoring. */
function logAuthFailure(request: FastifyRequest, reason: string): void {
  console.warn('[ADMIN_AUTH_FAILURE]', {
    reason,
    ip: request.ip,
    path: request.url,
    timestamp: new Date().toISOString(),
  });
}

/** Check admin auth and send 401/403 if invalid. Returns true if authorized. */
export function requireAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  config: Config
): boolean {
  const key = extractAdminKey(request);

  if (!key) {
    logAuthFailure(request, 'missing_key');
    reply.status(401).send({
      error: 'missing_admin_key',
      message: 'X-Admin-API-Key header is required',
    } as AdminAuthError);
    return false;
  }

  if (!validateAdminKey(key, config)) {
    logAuthFailure(request, 'invalid_key');
    reply.status(403).send({
      error: 'invalid_admin_key',
      message: 'Invalid admin API key',
    } as AdminAuthError);
    return false;
  }

  return true;
}
