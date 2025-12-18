import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { loadEnv } from './config/loadEnv.js';
import { ConfigService } from './services/configService.js';
import { MarketService } from './services/marketService.js';
import { TokenCatalogService } from './services/tokenCatalogService.js';
import { registerV1Routes } from './routes/v1.js';
import { registerWsGateway } from './ws/gateway.js';
import { registerApiRoutes } from './routes/api.js';
import { startIdleScheduler } from './services/idleScheduler.js';
import { RequestMetricsRepository, TaskQueueRepository } from '@airapiserv/storage';
import { DiscoveryService } from './services/discoveryService.js';
import { VenueSyncService } from './services/venueSyncService.js';

loadEnv();

const server = Fastify({ logger: true });
const configService = new ConfigService();
const marketService = new MarketService();
const tokenCatalogService = new TokenCatalogService(server.log, configService);
const metricsRepo = new RequestMetricsRepository();
const taskQueue = new TaskQueueRepository();

server.register(cors, {
  origin: (process.env.CORS_ORIGINS ?? '*').split(',').map((o) => o.trim()),
});

server.register(websocket);
server.register(rateLimit, {
  max: Number(process.env.API_RATE_LIMIT ?? 200),
  timeWindow: '1 minute',
});

server.register(jwt, {
  secret: process.env.JWT_SECRET ?? 'change-me',
});

server.decorate('authenticate', async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

server.addHook('onRequest', async () => {
  const now = new Date();
  now.setSeconds(0, 0);
  await metricsRepo.increment(now);
});

server.register(async (instance) => registerV1Routes(instance, { marketService, tokenCatalogService, configService }), { prefix: '/v1' });
server.register(async (instance) => registerApiRoutes(instance), { prefix: '/api' });
registerWsGateway(server, marketService);
tokenCatalogService.start();

// Seed queue with discovery and venue sync
(async () => {
  await taskQueue.enqueue({ type: 'DISCOVER_TOKENS_API', priority: 50 });
  await taskQueue.enqueue({ type: 'SYNC_VENUE_MARKETS', priority: 40 });
  await taskQueue.enqueue({ type: 'RESOLVE_TOKEN_VENUES', priority: 35 });
  // periodic maintenance placeholders
  await taskQueue.enqueue({ type: 'REVERIFY_API_ONLY', priority: 20, runAfter: new Date(Date.now() + 60 * 60 * 1000) });
})();

startIdleScheduler(server.log, { intervalMs: 5000, idleThreshold: Number(process.env.IDLE_REQUEST_THRESHOLD ?? 5) });

const port = Number(process.env.API_PORT ?? 3333);
server.listen({ port, host: '0.0.0.0' }).catch((err) => {
  server.log.error(err, 'failed to start api');
  process.exit(1);
});
