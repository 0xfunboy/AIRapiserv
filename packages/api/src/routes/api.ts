import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TokenDirectoryService } from '../services/tokenDirectoryService.js';
import { TaskQueueRepository } from '@airapiserv/storage';

export async function registerApiRoutes(fastify: FastifyInstance) {
  const tokens = new TokenDirectoryService(fastify.log);
  const tasks = new TaskQueueRepository();

  fastify.get('/tokens/search', async (request) => {
    const schema = z.object({ q: z.string(), limit: z.coerce.number().min(1).max(200).optional() });
    const query = schema.parse(request.query);
    return tokens.search(query.q, query.limit);
  });

  fastify.get('/tokens/:tokenId/venues', async (request, reply) => {
    const schema = z.object({ tokenId: z.string() });
    const params = schema.parse(request.params);
    const venues = await tokens.getVenues(params.tokenId);
    if (!venues.length) return reply.status(404).send({ message: 'token not found or no venues' });
    await tokens.updatePrioritySource(params.tokenId, venues);
    return venues;
  });

  fastify.get('/tokens/:tokenId/ohlcv', async (request) => {
    const schema = z.object({
      tokenId: z.string(),
      timeframe: z.string(),
      from: z.coerce.number().optional(),
      to: z.coerce.number().optional(),
      limit: z.coerce.number().optional(),
    });
    const params = schema.parse({
      ...(request.params as any),
      ...(request.query as any),
    });
    const candles = await tokens.getOhlcv(params);
    return { candles, backfill_pending: false };
  });

  fastify.post('/admin/tasks/trigger', async (request) => {
    const schema = z.object({
      type: z.enum(['DISCOVER_TOKENS_API', 'SYNC_VENUE_MARKETS', 'RESOLVE_TOKEN_VENUES']),
      priority: z.coerce.number().optional(),
    });
    const body = schema.parse(request.body);
    const id = await tasks.enqueue({ type: body.type, priority: body.priority });
    return { enqueued: true, taskId: id };
  });
}
