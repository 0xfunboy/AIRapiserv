import pino from 'pino';
import { MarketEvent, TradeEvent, CandleEvent } from '@airapiserv/core';
import { CandleRepository, MarketRepository, getRedisClient } from '@airapiserv/storage';
import { MarketConnector } from '../connectors/baseConnector.js';
import { BinanceSpotConnector } from '../connectors/binanceConnector.js';
import { BybitConnector } from '../connectors/bybitConnector.js';
import { CoinGeckoFallbackConnector, CryptoCompareFallbackConnector } from '../connectors/fallbackRest.js';

export class IngestionOrchestrator {
  private readonly connectors: MarketConnector[] = [];
  private readonly logger = pino({ name: 'ingestion-orchestrator' });
  private readonly redis = getRedisClient();
  private readonly candleRepo = new CandleRepository();
  private readonly marketRepo = new MarketRepository();
  private readonly rollingCandles = new Map<string, CandleEvent>();
  private initialized = false;

  constructor() {
  }

  private registerConnector(connector: MarketConnector) {
    connector.on('event', (event: MarketEvent) => this.handleEvent(event));
    this.connectors.push(connector);
  }

  async start() {
    await this.applyOverrides();
    if (!this.initialized) {
      this.initConnectors();
      this.initialized = true;
    }
    this.logger.info(
      {
        connectors: this.connectors.length,
        binanceSymbols: process.env.BINANCE_SYMBOLS ?? 'btcusdt,ethusdt',
        bybitSymbols: process.env.BYBIT_SYMBOLS ?? 'BTCUSDT',
      },
      'starting ingestion connectors'
    );
    await Promise.all(this.connectors.map((connector) => connector.start()));
  }

  async stop() {
    await Promise.all(this.connectors.map((connector) => connector.stop()));
  }

  private initConnectors() {
    this.registerConnector(new BinanceSpotConnector());
    this.registerConnector(new BybitConnector());

    if (process.env.ENABLE_COINGECKO_FALLBACK !== 'false') {
      this.registerConnector(new CoinGeckoFallbackConnector());
    }
    if (process.env.ENABLE_CRYPTOCOMPARE_FALLBACK !== 'false') {
      this.registerConnector(new CryptoCompareFallbackConnector());
    }
  }

  private async applyOverrides() {
    try {
      const overrides = await this.redis.hgetall('config:overrides');
      if (!overrides || Object.keys(overrides).length === 0) return;
      for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined || value === null || value === '') continue;
        process.env[key] = String(value);
      }
      this.logger.info({ keys: Object.keys(overrides) }, 'applied runtime overrides');
    } catch (err) {
      this.logger.warn({ err }, 'failed to load runtime overrides');
    }
  }

  private async handleEvent(event: MarketEvent) {
    await this.upsertMarketCoverage(event.marketId);
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

  private async upsertMarketCoverage(marketId: string) {
    try {
      const [venue, symbol, marketType = 'spot'] = marketId.split(':');
      await this.marketRepo.upsertMarket({
        marketId,
        venue: venue ?? 'unknown',
        symbol: symbol ?? marketId,
        marketType,
        status: 'active',
        wsCapable: true,
        restCapable: true,
        metadata: {},
      });
    } catch (err) {
      this.logger.warn({ err, marketId }, 'failed to upsert market coverage');
    }
  }
}
