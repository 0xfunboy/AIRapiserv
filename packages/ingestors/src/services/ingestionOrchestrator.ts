import pino from 'pino';
import { MarketEvent, TradeEvent, CandleEvent } from '@airapiserv/core';
import { CandleRepository, getRedisClient } from '@airapiserv/storage';
import { MarketConnector } from '../connectors/baseConnector.js';
import { BinanceSpotConnector } from '../connectors/binanceConnector.js';
import { BybitConnector } from '../connectors/bybitConnector.js';
import { CoinGeckoFallbackConnector, CryptoCompareFallbackConnector } from '../connectors/fallbackRest.js';

export class IngestionOrchestrator {
  private readonly connectors: MarketConnector[] = [];
  private readonly logger = pino({ name: 'ingestion-orchestrator' });
  private readonly redis = getRedisClient();
  private readonly candleRepo = new CandleRepository();
  private readonly rollingCandles = new Map<string, CandleEvent>();

  constructor() {
    this.registerConnector(new BinanceSpotConnector());
    this.registerConnector(new BybitConnector());

    if (process.env.ENABLE_COINGECKO_FALLBACK !== 'false') {
      this.registerConnector(new CoinGeckoFallbackConnector());
    }
    if (process.env.ENABLE_CRYPTOCOMPARE_FALLBACK !== 'false') {
      this.registerConnector(new CryptoCompareFallbackConnector());
    }
  }

  private registerConnector(connector: MarketConnector) {
    connector.on('event', (event: MarketEvent) => this.handleEvent(event));
    this.connectors.push(connector);
  }

  async start() {
    this.logger.info({ connectors: this.connectors.length }, 'starting ingestion connectors');
    await Promise.all(this.connectors.map((connector) => connector.start()));
  }

  async stop() {
    await Promise.all(this.connectors.map((connector) => connector.stop()));
  }

  private async handleEvent(event: MarketEvent) {
    switch (event.kind) {
      case 'trade':
        await this.persistTrade(event);
        break;
      case 'ticker':
        await this.redis.hset(`ticker:${event.marketId}`, {
          last: event.last,
          mark: event.mark ?? '',
          bestBid: event.bestBid ?? '',
          bestAsk: event.bestAsk ?? '',
          updatedAt: event.timestamp,
        });
        break;
      case 'candle':
        await this.candleRepo.upsert(event);
        break;
      default:
        break;
    }
  }

  private async persistTrade(event: TradeEvent) {
    await this.redis.hset(`trade:${event.marketId}`, {
      price: event.price,
      size: event.size,
      side: event.side,
      ts: event.timestamp,
    });

    if (process.env.ENABLE_ROLLING_CANDLES !== 'false') {
      const bucketSize = event.marketId.includes('perp') ? 5000 : 1000;
      const bucket = Math.floor(event.timestamp / bucketSize) * bucketSize;
      const key = `${event.marketId}:${bucketSize}`;
      const existing = this.rollingCandles.get(key);
      const nextCandle: CandleEvent = existing
        ? {
            ...existing,
            high: Math.max(existing.high, event.price),
            low: Math.min(existing.low, event.price),
            close: event.price,
            volume: existing.volume + event.size,
            tradesCount: (existing.tradesCount ?? 0) + 1,
          }
        : {
            kind: 'candle',
            startTs: bucket,
            intervalMs: bucketSize,
            marketId: event.marketId,
            open: event.price,
            high: event.price,
            low: event.price,
            close: event.price,
            volume: event.size,
            tradesCount: 1,
            isFinal: false,
            source: event.source,
            rolling: true,
          };
      this.rollingCandles.set(key, nextCandle);
      await this.candleRepo.upsert(nextCandle);
    }
  }
}
