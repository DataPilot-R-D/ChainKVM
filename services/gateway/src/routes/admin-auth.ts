/**
 * Admin authentication helpers for protected endpoints.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Config } from '../config.js';

export interface AdminAuthError {
  error: string;
  message: string;
}

/** Extract admin API key from request headers. */
export function extractAdminKey(request: FastifyRequest): string | null {
  const key = request.headers['x-admin-api-key'];
  if (typeof key !== 'string') return null;
  return key;
}

/** Validate admin API key against config. */
export function validateAdminKey(key: string | null, config: Config): boolean {
  if (!key) return false;
  return key === config.adminApiKey;
}

/** Check admin auth and send 401/403 if invalid. Returns true if authorized. */
export function requireAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  config: Config
): boolean {
  const key = extractAdminKey(request);

  if (!key) {
    reply.status(401).send({
      error: 'missing_admin_key',
      message: 'X-Admin-API-Key header is required',
    });
    return false;
  }

  if (!validateAdminKey(key, config)) {
    reply.status(403).send({
      error: 'invalid_admin_key',
      message: 'Invalid admin API key',
    });
    return false;
  }

  return true;
}
