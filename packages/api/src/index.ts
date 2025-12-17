import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { MarketService } from './services/marketService.js';
import { TokenCatalogService } from './services/tokenCatalogService.js';
import { registerV1Routes } from './routes/v1.js';
import { registerWsGateway } from './ws/gateway.js';

const server = Fastify({ logger: true });
const marketService = new MarketService();
const tokenCatalogService = new TokenCatalogService(server.log);

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

server.register(async (instance) => registerV1Routes(instance, { marketService, tokenCatalogService }), { prefix: '/v1' });
registerWsGateway(server, marketService);
tokenCatalogService.start();

const port = Number(process.env.API_PORT ?? 3333);
server.listen({ port, host: '0.0.0.0' }).catch((err) => {
  server.log.error(err, 'failed to start api');
  process.exit(1);
});
