import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { auditRoutes } from '../audit.js';
import type { AuditEventsResponse, AuditEvent } from '../../types.js';

describe('auditRoutes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(auditRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /v1/audit/events', () => {
    it('should return list of audit events', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/audit/events',
      });

      expect(response.statusCode).toBe(200);
      const body: AuditEventsResponse = JSON.parse(response.body);
      expect(body.events).toBeInstanceOf(Array);
      expect(body.total).toBeGreaterThan(0);
      expect(body.page).toBe(1);
      expect(body.page_size).toBe(20);
    });

    it('should include required fields in audit events', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/audit/events',
      });

      const body: AuditEventsResponse = JSON.parse(response.body);
      const event = body.events[0];
      expect(event.event_id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.robot_id).toBeDefined();
      expect(event.operator_did).toBeDefined();
      expect(event.session_id).toBeDefined();
      expect(event.event_type).toBeDefined();
      expect(event.metadata).toBeDefined();
    });

    it('should filter by session_id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/audit/events?session_id=ses_stub_001',
      });

      expect(response.statusCode).toBe(200);
      const body: AuditEventsResponse = JSON.parse(response.body);
      for (const event of body.events) {
        expect(event.session_id).toBe('ses_stub_001');
      }
    });

    it('should filter by robot_id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/audit/events?robot_id=robot-001',
      });

      expect(response.statusCode).toBe(200);
      const body: AuditEventsResponse = JSON.parse(response.body);
      for (const event of body.events) {
        expect(event.robot_id).toBe('robot-001');
      }
    });

    it('should filter by actor_did', async () => {
      const did = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
      const response = await app.inject({
        method: 'GET',
        url: `/v1/audit/events?actor_did=${encodeURIComponent(did)}`,
      });

      expect(response.statusCode).toBe(200);
      const body: AuditEventsResponse = JSON.parse(response.body);
      for (const event of body.events) {
        expect(event.operator_did).toBe(did);
      }
    });

    it('should filter by event_type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/audit/events?event_type=SESSION_GRANTED',
      });

      expect(response.statusCode).toBe(200);
      const body: AuditEventsResponse = JSON.parse(response.body);
      for (const event of body.events) {
        expect(event.event_type).toBe('SESSION_GRANTED');
      }
    });

    it('should filter by date range (from)', async () => {
      const fromDate = new Date(Date.now() - 7200000).toISOString();
      const response = await app.inject({
        method: 'GET',
        url: `/v1/audit/events?from=${encodeURIComponent(fromDate)}`,
      });

      expect(response.statusCode).toBe(200);
      const body: AuditEventsResponse = JSON.parse(response.body);
      for (const event of body.events) {
        expect(new Date(event.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(fromDate).getTime());
      }
    });

    it('should filter by date range (to)', async () => {
      const toDate = new Date().toISOString();
      const response = await app.inject({
        method: 'GET',
        url: `/v1/audit/events?to=${encodeURIComponent(toDate)}`,
      });

      expect(response.statusCode).toBe(200);
      const body: AuditEventsResponse = JSON.parse(response.body);
      for (const event of body.events) {
        expect(new Date(event.timestamp).getTime()).toBeLessThanOrEqual(new Date(toDate).getTime());
      }
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/audit/events?page=1&page_size=2',
      });

      expect(response.statusCode).toBe(200);
      const body: AuditEventsResponse = JSON.parse(response.body);
      expect(Number(body.page)).toBe(1);
      expect(Number(body.page_size)).toBe(2);
      expect(body.events.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array for non-matching filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/audit/events?session_id=nonexistent_session',
      });

      expect(response.statusCode).toBe(200);
      const body: AuditEventsResponse = JSON.parse(response.body);
      expect(body.events).toEqual([]);
      expect(body.total).toBe(0);
    });
  });

  describe('GET /v1/audit/events/:event_id', () => {
    it('should return a single audit event by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/audit/events/evt_stub_001',
      });

      expect(response.statusCode).toBe(200);
      const event: AuditEvent = JSON.parse(response.body);
      expect(event.event_id).toBe('evt_stub_001');
      expect(event.event_type).toBe('SESSION_GRANTED');
    });

    it('should return 404 for non-existent event', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/audit/events/nonexistent_event',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('event_not_found');
    });

    it('should include metadata in returned event', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/audit/events/evt_stub_003',
      });

      expect(response.statusCode).toBe(200);
      const event: AuditEvent = JSON.parse(response.body);
      expect(event.event_type).toBe('PRIVILEGED_ACTION');
      expect(event.metadata.action).toBe('E_STOP');
    });
  });
});
