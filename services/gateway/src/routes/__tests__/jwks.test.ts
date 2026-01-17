import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { jwksRoutes, getJWKS, getCurrentKeyId } from '../jwks.js';
import type { JWKS, JWK } from '../../types.js';

describe('jwksRoutes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(jwksRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /.well-known/jwks.json', () => {
    it('should return valid JWKS structure', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/jwks.json',
      });

      expect(response.statusCode).toBe(200);
      const body: JWKS = JSON.parse(response.body);
      expect(body.keys).toBeInstanceOf(Array);
      expect(body.keys.length).toBeGreaterThan(0);
    });

    it('should contain Ed25519 keys', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/jwks.json',
      });

      const body: JWKS = JSON.parse(response.body);
      const ed25519Keys = body.keys.filter((k) => k.crv === 'Ed25519');
      expect(ed25519Keys.length).toBeGreaterThan(0);
    });

    it('should include required JWK properties', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/jwks.json',
      });

      const body: JWKS = JSON.parse(response.body);
      const key: JWK = body.keys[0];
      expect(key.kty).toBe('OKP');
      expect(key.crv).toBe('Ed25519');
      expect(key.x).toBeDefined();
      expect(key.kid).toBeDefined();
      expect(key.use).toBe('sig');
      expect(key.alg).toBe('EdDSA');
    });

    it('should have unique key IDs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/jwks.json',
      });

      const body: JWKS = JSON.parse(response.body);
      const kids = body.keys.map((k) => k.kid);
      const uniqueKids = new Set(kids);
      expect(uniqueKids.size).toBe(kids.length);
    });

    it('should not contain private key material', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/jwks.json',
      });

      const body: JWKS = JSON.parse(response.body);
      for (const key of body.keys) {
        expect((key as Record<string, unknown>).d).toBeUndefined();
      }
    });
  });

  describe('GET /v1/jwks', () => {
    it('should return same JWKS as .well-known endpoint', async () => {
      const wellKnownResponse = await app.inject({
        method: 'GET',
        url: '/.well-known/jwks.json',
      });

      const v1Response = await app.inject({
        method: 'GET',
        url: '/v1/jwks',
      });

      expect(v1Response.statusCode).toBe(200);
      expect(JSON.parse(v1Response.body)).toEqual(JSON.parse(wellKnownResponse.body));
    });
  });
});

describe('jwks helper functions', () => {
  describe('getJWKS', () => {
    it('should return JWKS with keys', () => {
      const jwks = getJWKS();
      expect(jwks.keys).toBeInstanceOf(Array);
      expect(jwks.keys.length).toBeGreaterThan(0);
    });

    it('should include current key', () => {
      const jwks = getJWKS();
      const currentKeyId = getCurrentKeyId();
      const hasCurrentKey = jwks.keys.some((k) => k.kid === currentKeyId);
      expect(hasCurrentKey).toBe(true);
    });
  });

  describe('getCurrentKeyId', () => {
    it('should return a non-empty string', () => {
      const keyId = getCurrentKeyId();
      expect(typeof keyId).toBe('string');
      expect(keyId.length).toBeGreaterThan(0);
    });

    it('should return dev-key-1 for development', () => {
      const keyId = getCurrentKeyId();
      expect(keyId).toBe('dev-key-1');
    });
  });
});
