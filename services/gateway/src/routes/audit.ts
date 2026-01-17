import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuditEvent, AuditQueryParams, AuditEventsResponse } from '../types.js';

// Stub audit events for development
const stubEvents: AuditEvent[] = [
  {
    event_id: 'evt_stub_001',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    robot_id: 'robot-001',
    operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
    session_id: 'ses_stub_001',
    event_type: 'SESSION_GRANTED',
    metadata: {
      policy_id: 'default-policy',
      policy_version: '1.0.0',
      effective_scope: ['teleop:view', 'teleop:control'],
    },
  },
  {
    event_id: 'evt_stub_002',
    timestamp: new Date(Date.now() - 3500000).toISOString(),
    robot_id: 'robot-001',
    operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
    session_id: 'ses_stub_001',
    event_type: 'SESSION_STARTED',
    metadata: {},
  },
  {
    event_id: 'evt_stub_003',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    robot_id: 'robot-001',
    operator_did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
    session_id: 'ses_stub_001',
    event_type: 'PRIVILEGED_ACTION',
    metadata: {
      action: 'E_STOP',
      reason: 'Operator initiated emergency stop',
    },
  },
];

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  // GET /v1/audit/events - Query audit events
  app.get<{ Querystring: AuditQueryParams }>(
    '/v1/audit/events',
    async (request: FastifyRequest<{ Querystring: AuditQueryParams }>, reply: FastifyReply) => {
      const {
        session_id,
        robot_id,
        actor_did,
        event_type,
        from,
        to,
        page = 1,
        page_size = 20,
      } = request.query;

      // Filter stub events based on query params
      let filtered = [...stubEvents];

      if (session_id) {
        filtered = filtered.filter((e) => e.session_id === session_id);
      }
      if (robot_id) {
        filtered = filtered.filter((e) => e.robot_id === robot_id);
      }
      if (actor_did) {
        filtered = filtered.filter((e) => e.operator_did === actor_did);
      }
      if (event_type) {
        filtered = filtered.filter((e) => e.event_type === event_type);
      }
      if (from) {
        const fromDate = new Date(from);
        filtered = filtered.filter((e) => new Date(e.timestamp) >= fromDate);
      }
      if (to) {
        const toDate = new Date(to);
        filtered = filtered.filter((e) => new Date(e.timestamp) <= toDate);
      }

      // Paginate
      const total = filtered.length;
      const startIdx = (page - 1) * page_size;
      const paginated = filtered.slice(startIdx, startIdx + page_size);

      const response: AuditEventsResponse = {
        events: paginated,
        total,
        page,
        page_size,
      };

      return response;
    }
  );

  // GET /v1/audit/events/:event_id - Get single event
  app.get<{ Params: { event_id: string } }>(
    '/v1/audit/events/:event_id',
    async (request: FastifyRequest<{ Params: { event_id: string } }>, reply: FastifyReply) => {
      const { event_id } = request.params;
      const event = stubEvents.find((e) => e.event_id === event_id);

      if (!event) {
        return reply.status(404).send({
          error: 'event_not_found',
          message: 'Audit event not found',
        });
      }

      return event;
    }
  );
}
