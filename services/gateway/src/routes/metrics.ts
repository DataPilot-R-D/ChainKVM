import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { MetricsIngestRequest, MetricsIngestResponse, MetricsLogEvent } from '../types.js';
import type { MetricsLogger } from '../metrics/logger.js';

function normalizeEvent(event: MetricsLogEvent, fallbackTimestamp: string): MetricsLogEvent | null {
  if (!event || typeof event.metric !== 'string' || typeof event.value !== 'number') {
    return null;
  }

  return {
    ...event,
    ts: event.ts ?? fallbackTimestamp,
  };
}

export async function metricsRoutes(
  app: FastifyInstance,
  metrics: MetricsLogger
): Promise<void> {
  app.post<{ Body: MetricsIngestRequest }>(
    '/v1/metrics',
    async (request: FastifyRequest<{ Body: MetricsIngestRequest }>, reply: FastifyReply) => {
      if (!metrics.enabled) {
        return reply.status(503).send({
          error: 'metrics_disabled',
          message: 'Metrics logging is disabled',
        });
      }

      const { events } = request.body ?? {};
      if (!Array.isArray(events) || events.length === 0) {
        return reply.status(400).send({
          error: 'invalid_request',
          message: 'events must be a non-empty array',
        });
      }

      const fallbackTimestamp = new Date().toISOString();
      let accepted = 0;

      for (const event of events) {
        const normalized = normalizeEvent(event, fallbackTimestamp);
        if (!normalized) {
          continue;
        }
        void metrics.log(normalized);
        accepted += 1;
      }

      const response: MetricsIngestResponse = { accepted };
      return reply.status(202).send(response);
    }
  );
}
