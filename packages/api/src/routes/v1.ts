import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MarketService } from '../services/marketService.js';
import { TokenCatalogService } from '../services/tokenCatalogService.js';
import { ConfigService } from '../services/configService.js';
import { DiscoveryService } from '../services/discoveryService.js';
import { VenueSyncService } from '../services/venueSyncService.js';
import { TaskQueueRepository } from '@airapiserv/storage';

export async function registerV1Routes(
  fastify: FastifyInstance,
  opts: { marketService: MarketService; tokenCatalogService: TokenCatalogService; configService: ConfigService }
) {
  const { marketService, tokenCatalogService, configService } = opts;
  const discovery = new DiscoveryService(fastify.log);
  const venueSync = new VenueSyncService(fastify.log);
  const tasks = new TaskQueueRepository();

  fastify.get('/resolve', async (request, reply) => {
    const schema = z.object({
      symbol: z.string(),
      chain: z.string().optional(),
      marketType: z.enum(['spot', 'perp']).optional(),
      contractAddress: z.string().optional(),
    });
    const query = schema.parse(request.query);
    const result = await marketService.resolveSymbol(query);
    if (!result) {
      return reply.status(404).send({ message: 'symbol not found' });
    }
    return result;
  });

  fastify.get('/price', async (request, reply) => {
    const schema = z.object({ marketId: z.string() });
    const query = schema.parse(request.query);
    const data = await marketService.getLastPrice(query.marketId);
    if (!data) {
      return reply.status(404).send({ message: 'price not available' });
    }
    return data;
  });

  fastify.get('/ohlcv', async (request) => {
    const schema = z.object({
      marketId: z.string(),
      interval: z.enum(['1s', '5s', '1m', '5m', '1h', '1d']),
      limit: z.coerce.number().min(1).max(1000).optional(),
    });
    const query = schema.parse(request.query);
    return marketService.getOhlcv(query);
  });

  fastify.get('/trades', async (request) => {
    const schema = z.object({
      marketId: z.string(),
      limit: z.coerce.number().min(1).max(500).optional(),
    });
    const query = schema.parse(request.query);
    return marketService.getTrades(query.marketId, query.limit);
  });

  fastify.get('/search', async (request) => {
    const schema = z.object({ q: z.string() });
    const query = schema.parse(request.query);
    return marketService.searchAssets(query.q);
  });

  fastify.get('/providers', async (request) => {
    const schema = z.object({
      marketType: z.enum(['spot', 'perp']).default('spot'),
      requestType: z.string().default('getLastPrice'),
      supportsWs: z.coerce.boolean().default(true),
    });
    const query = schema.parse(request.query);
    return marketService.getProviders(query as any);
  });

  fastify.get('/markets', async (request) => {
    const schema = z.object({
      limit: z.coerce.number().min(1).max(5000).optional(),
    });
    const query = schema.parse(request.query);
    const data = await marketService.getActiveMarkets();
    return {
      total: data.activeMarketCount,
      markets: query.limit ? data.markets.slice(0, query.limit) : data.markets,
    };
  });

  fastify.get('/tokens', async (request) => {
    const schema = z.object({
      q: z.string().optional(),
      limit: z.coerce.number().min(1).max(500).optional(),
      offset: z.coerce.number().min(0).optional(),
    });
    const query = schema.parse(request.query);
    return tokenCatalogService.listTokens(query);
  });

  fastify.get('/tokens/:tokenKey', async (request, reply) => {
    const schema = z.object({ tokenKey: z.string() });
    const params = schema.parse(request.params);
    const detail = await tokenCatalogService.getTokenDetail(params.tokenKey);
    if (!detail) {
      return reply.status(404).send({ message: 'token not found' });
    }
    return detail;
  });

  fastify.post('/tokens/refresh', async () => {
    fastify.log.info('Manual token refresh requested');
    return tokenCatalogService.refreshTokens({ force: true });
  });

  fastify.get('/config', async () => {
    return configService.getEffectiveConfig();
  });

  fastify.post('/config', async (request) => {
    const payload = request.body as Record<string, unknown>;
    return configService.updateConfig(payload ?? {});
  });

  fastify.get('/status', async () => {
    const status = await marketService.getStatus();
    const tokenStats = await tokenCatalogService.getStats();
    return { ...status, tokens: tokenStats };
  });

  fastify.post('/maintenance/clickhouse/optimize', async () => {
    await marketService.optimizeClickhouse();
    return { status: 'ok' };
  });

  fastify.post('/maintenance/clickhouse/reset', async () => {
    await marketService.resetClickhouseCandles();
    return { status: 'ok' };
  });

  fastify.post('/admin/tasks/trigger', async (request) => {
    const body = (request.body as any) ?? {};
    const type = body.type as string;
    if (type === 'DISCOVER_TOKENS_API') {
      await discovery.run();
      return { status: 'ok' };
    }
    if (type === 'SYNC_VENUE_MARKETS') {
      await venueSync.run();
      return { status: 'ok' };
    }
    if (type) {
      await tasks.enqueue({ type, priority: 50 });
      return { status: 'queued', type };
    }
    return { status: 'noop' };
  });

  fastify.get('/health', async () => {
    return marketService.getHealth();
  });
}
