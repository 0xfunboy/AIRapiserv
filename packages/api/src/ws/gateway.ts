import { FastifyInstance } from 'fastify';
import { MarketService } from '../services/marketService.js';

type Channel = 'ticker' | 'trades' | 'candles';

interface Subscription {
  channel: Channel;
  marketId: string;
  intervalMs: number;
  timer: NodeJS.Timeout;
}

export function registerWsGateway(fastify: FastifyInstance, marketService: MarketService) {
  fastify.get('/v1/ws', { websocket: true }, (connection) => {
    const subscriptions: Subscription[] = [];

    connection.socket.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'subscribe') {
          const subscription: Subscription = {
            channel: msg.channel,
            marketId: msg.marketId,
            intervalMs: msg.intervalMs ?? 1000,
            timer: setInterval(async () => {
              const payload = await fetchPayload(msg.channel, msg.marketId, marketService, msg.interval ?? '1s');
              connection.socket.send(
                JSON.stringify({
                  type: 'update',
                  channel: msg.channel,
                  marketId: msg.marketId,
                  data: payload,
                })
              );
            }, msg.intervalMs ?? 1000),
          };
          subscriptions.push(subscription);
        }
      } catch (err) {
        connection.socket.send(JSON.stringify({ type: 'error', message: (err as Error).message }));
      }
    });

    connection.socket.on('close', () => {
      subscriptions.forEach((subscription) => clearInterval(subscription.timer));
    });
  });
}

async function fetchPayload(channel: Channel, marketId: string, marketService: MarketService, interval: string) {
  switch (channel) {
    case 'ticker':
      return marketService.getLastPrice(marketId);
    case 'trades':
      return marketService.getTrades(marketId, 50);
    case 'candles':
      return marketService.getOhlcv({ marketId, interval, limit: 60 });
    default:
      return null;
  }
}
