import pino from 'pino';
import { MarketEvent, TradeEvent, CandleEvent } from '@airapiserv/core';
import { CandleRepository, MarketRepository, TokenRepository, getRedisClient } from '@airapiserv/storage';
import { MarketConnector } from '../connectors/baseConnector.js';
import { BinanceSpotConnector } from '../connectors/binanceConnector.js';
import { BybitConnector } from '../connectors/bybitConnector.js';
import { CoinGeckoFallbackConnector, CryptoCompareFallbackConnector } from '../connectors/fallbackRest.js';
import { OkxConnector } from '../connectors/okxConnector.js';
import { CoinbaseConnector } from '../connectors/coinbaseConnector.js';
import { BitfinexConnector } from '../connectors/bitfinexConnector.js';

export class IngestionOrchestrator {
  private readonly connectors: MarketConnector[] = [];
  private readonly logger = pino({ name: 'ingestion-orchestrator' });
  private readonly redis = getRedisClient();
  private readonly candleRepo = new CandleRepository();
  private readonly marketRepo = new MarketRepository();
  private readonly tokenRepo = new TokenRepository();
  private readonly rollingCandles = new Map<string, CandleEvent>();
  private readonly tokenCache = new Map<string, string>();
  private initialized = false;
  private flushTimer?: NodeJS.Timeout;

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
      await this.primeTokenCache();
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
    if (this.flushTimer) clearInterval(this.flushTimer);
    await Promise.all(this.connectors.map((connector) => connector.stop()));
  }

  private initConnectors() {
    this.registerConnector(new BinanceSpotConnector());
    this.registerConnector(new BybitConnector());
    this.registerConnector(new OkxConnector());
    this.registerConnector(new CoinbaseConnector());
    this.registerConnector(new BitfinexConnector());

    if (process.env.ENABLE_COINGECKO_FALLBACK !== 'false') {
      this.registerConnector(new CoinGeckoFallbackConnector());
    }
    if (process.env.ENABLE_CRYPTOCOMPARE_FALLBACK !== 'false') {
      this.registerConnector(new CryptoCompareFallbackConnector());
    }

    this.flushTimer = setInterval(() => this.flushStale(), 2_000).unref();
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
    const parsed = this.parseMarket(event.marketId);
    await this.upsertMarketCoverage(parsed);
    switch (event.kind) {
      case 'trade':
        await this.persistTrade(event, parsed);
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
        await this.candleRepo.upsert(event, { tokenId: await this.resolveTokenId(parsed.baseSymbol), venue: parsed.venue });
        break;
      default:
        break;
    }
  }

  private async persistTrade(event: TradeEvent, parsed: ReturnType<IngestionOrchestrator['parseMarket']>) {
    await this.redis.hset(`trade:${event.marketId}`, {
      price: event.price,
      size: event.size,
      side: event.side,
      ts: event.timestamp,
    });

    if (process.env.ENABLE_ROLLING_CANDLES !== 'false') {
      const buckets = [1000, 5000, 60_000];
      for (const bucketSize of buckets) {
        const bucket = Math.floor(event.timestamp / bucketSize) * bucketSize;
        const key = `${event.marketId}:${bucketSize}`;
        const existing = this.rollingCandles.get(key);
        if (existing && existing.startTs !== bucket) {
          existing.isFinal = true;
          await this.candleRepo.upsert(existing, { tokenId: await this.resolveTokenId(parsed.baseSymbol), venue: parsed.venue });
          this.rollingCandles.delete(key);
        }
        const nextCandle: CandleEvent = this.rollingCandles.get(key) ?? {
          kind: 'candle',
          startTs: bucket,
          intervalMs: bucketSize,
          marketId: event.marketId,
          open: event.price,
          high: event.price,
          low: event.price,
          close: event.price,
          volume: 0,
          tradesCount: 0,
          isFinal: false,
          source: event.source,
          rolling: true,
        };
        nextCandle.high = Math.max(nextCandle.high, event.price);
        nextCandle.low = Math.min(nextCandle.low, event.price);
        nextCandle.close = event.price;
        nextCandle.volume += event.size;
        nextCandle.tradesCount = (nextCandle.tradesCount ?? 0) + 1;
        this.rollingCandles.set(key, nextCandle);
        await this.candleRepo.upsert(nextCandle, { tokenId: await this.resolveTokenId(parsed.baseSymbol), venue: parsed.venue });
      }
    }
  }

  private async upsertMarketCoverage(parsed: { venue: string; venueSymbol: string; marketType: string; baseSymbol: string; quoteSymbol: string }) {
    try {
      const baseId = await this.resolveTokenId(parsed.baseSymbol);
      const quoteId = await this.resolveTokenId(parsed.quoteSymbol);
      await this.marketRepo.upsertMarket({
        marketId: `${parsed.venue}:${parsed.venueSymbol}:${parsed.marketType}`,
        venue: parsed.venue ?? 'unknown',
        symbol: parsed.venueSymbol ?? 'unknown',
        marketType: parsed.marketType,
        status: 'active',
        wsCapable: true,
        restCapable: true,
        metadata: {},
        baseAssetId: baseId ?? null,
        quoteAssetId: quoteId ?? null,
      });
    } catch (err) {
      this.logger.warn({ err, parsed }, 'failed to upsert market coverage');
    }
  }

  private parseMarket(marketId: string) {
    const [venueRaw, symbolRaw, marketTypeRaw] = marketId.split(':');
    const venueSymbol = symbolRaw ?? marketId;
    const venue = (venueRaw ?? 'unknown').toLowerCase();
    const marketType = marketTypeRaw ?? 'spot';
    const { base, quote } = this.splitPair(venueSymbol);
    return { venue, venueSymbol, marketType, baseSymbol: base, quoteSymbol: quote };
  }

  private splitPair(pair: string) {
    const cleaned = pair.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const knownQuotes = ['USDT', 'USD', 'USDC', 'BUSD', 'EUR', 'BTC', 'ETH', 'DAI'];
    for (const quote of knownQuotes) {
      if (cleaned.endsWith(quote) && cleaned.length > quote.length) {
        return { base: cleaned.slice(0, cleaned.length - quote.length), quote };
      }
    }
    const mid = Math.floor(cleaned.length / 2);
    return { base: cleaned.slice(0, mid), quote: cleaned.slice(mid) };
  }

  private async primeTokenCache() {
    try {
      const tokens = await this.tokenRepo.listActiveTokens();
      tokens.forEach((t) => this.tokenCache.set(t.symbol.toUpperCase(), t.tokenId));
      this.logger.info({ cached: tokens.length }, 'primed token cache');
    } catch (err) {
      this.logger.warn({ err }, 'failed to prime token cache');
    }
  }

  private async resolveTokenId(symbol?: string | null) {
    if (!symbol) return null;
    const key = symbol.toUpperCase();
    if (this.tokenCache.has(key)) return this.tokenCache.get(key)!;
    const found = await this.tokenRepo.searchTokens(symbol, 1);
    const tokenId = found?.[0]?.tokenId ?? null;
    if (tokenId) this.tokenCache.set(key, tokenId);
    return tokenId;
  }

  private async flushStale() {
    const now = Date.now();
    for (const [key, candle] of Array.from(this.rollingCandles.entries())) {
      const age = now - candle.startTs;
      const interval = candle.intervalMs;
      if (age > interval * 2) {
        candle.isFinal = true;
        const parsed = this.parseMarket(candle.marketId);
        await this.candleRepo.upsert(candle, { tokenId: await this.resolveTokenId(parsed.baseSymbol), venue: parsed.venue });
        this.rollingCandles.delete(key);
      }
    }
  }
}
