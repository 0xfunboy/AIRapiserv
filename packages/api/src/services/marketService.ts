import { SymbolResolver, selectProvider } from '@airapiserv/core';
import { getRedisClient, getClickHouseClient, getPgPool } from '@airapiserv/storage';

export class MarketService {
  private readonly resolver = new SymbolResolver();
  private readonly redis = getRedisClient();
  private readonly clickHouse = getClickHouseClient();
  private readonly pg = getPgPool();

  private async scanKeys(pattern: string, limit = 2000) {
    let cursor = '0';
    const keys: string[] = [];
    do {
      const result = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', '500');
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0' && keys.length < limit);
    return keys.slice(0, limit);
  }

  private normalizeMarketId(marketId: string) {
    const [venue, symbol, marketType] = marketId.split(':');
    if (!symbol) return marketId;
    const normalizedSymbol = symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return [venue, normalizedSymbol, marketType].filter(Boolean).join(':');
  }

  async resolveSymbol(params: { symbol: string; chain?: string; marketType?: 'spot' | 'perp'; contractAddress?: string }) {
    return this.resolver.resolveSymbol({
      symbol: params.symbol,
      chainId: params.chain,
      marketType: params.marketType,
      contractAddress: params.contractAddress,
    });
  }

  async searchAssets(query: string) {
    return this.resolver.searchAssets(query);
  }

  async getLastPrice(marketId: string) {
    const normalizedMarketId = this.normalizeMarketId(marketId);
    const data = await this.redis.hgetall(`ticker:${normalizedMarketId}`);
    if (!Object.keys(data).length) {
      return null;
    }
    return {
      marketId: normalizedMarketId,
      last: Number(data.last ?? 0),
      mark: data.mark ? Number(data.mark) : undefined,
      bestBid: data.bestBid ? Number(data.bestBid) : undefined,
      bestAsk: data.bestAsk ? Number(data.bestAsk) : undefined,
      updatedAt: Number(data.updatedAt ?? Date.now()),
    };
  }

  async getTrades(marketId: string, limit = 100) {
    // Placeholder: fetch last trade from Redis while ClickHouse ingestion is still stubbed
    const normalizedMarketId = this.normalizeMarketId(marketId);
    const lastTrade = await this.redis.hgetall(`trade:${normalizedMarketId}`);
    if (!Object.keys(lastTrade).length) {
      return [];
    }
    return [
      {
        marketId: normalizedMarketId,
        price: Number(lastTrade.price ?? 0),
        size: Number(lastTrade.size ?? 0),
        side: lastTrade.side ?? 'unknown',
        timestamp: Number(lastTrade.ts ?? Date.now()),
      },
    ].slice(0, limit);
  }

  async getOhlcv(params: { marketId: string; interval: string; limit?: number }) {
    try {
      const normalizedMarketId = this.normalizeMarketId(params.marketId);
      const intervalMs = this.intervalToMs(params.interval);
      const query = `select start_ts, open, high, low, close, volume, trades_count, is_final
        from candles_1s
        where market_id = {marketId:String}
        and interval_ms = {intervalMs:UInt32}
        order by start_ts desc
        limit {limit:UInt32}`;
      const result = await this.clickHouse.query({
        query,
        format: 'JSONEachRow',
        query_params: {
          marketId: normalizedMarketId,
          intervalMs,
          limit: params.limit ?? 500,
        },
      });
      const rows = (await result.json()) as Array<{
        start_ts: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        trades_count: number;
        is_final: number;
      }>;
      return rows.map((row) => ({
        startTs: new Date(row.start_ts).getTime(),
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
        tradesCount: row.trades_count,
        isFinal: Boolean(row.is_final),
      }));
    } catch (err) {
      // During early bootstrap ClickHouse might be empty; return empty result instead of throwing
      console.warn('ClickHouse query failed', err);
      return [];
    }
  }

  async getProviders(params: { marketType: 'spot' | 'perp'; requestType: any; supportsWs: boolean }) {
    const ranking = selectProvider({
      marketType: params.marketType,
      requestType: params.requestType,
      supportsWs: params.supportsWs,
    } as any);
    return ranking.map((provider, index) => ({ provider, priority: index + 1 }));
  }

  async getActiveMarkets() {
    const tickerKeys = await this.scanKeys('ticker:*');
    const tradeKeys = await this.scanKeys('trade:*');
    const marketIds = new Set<string>();

    for (const key of tickerKeys) {
      marketIds.add(key.replace('ticker:', ''));
    }
    for (const key of tradeKeys) {
      marketIds.add(key.replace('trade:', ''));
    }

    const markets = [];
    let lastTickerTs = 0;
    let lastTradeTs = 0;

    for (const marketId of marketIds) {
      const [venue, symbol, marketType] = marketId.split(':');
      const ticker = await this.redis.hgetall(`ticker:${marketId}`);
      const trade = await this.redis.hgetall(`trade:${marketId}`);
      const tickerUpdatedAt = Number(ticker.updatedAt ?? 0);
      const tradeTs = Number(trade.ts ?? 0);
      const updatedAt = Math.max(tickerUpdatedAt, tradeTs);
      if (tickerUpdatedAt > lastTickerTs) lastTickerTs = tickerUpdatedAt;
      if (tradeTs > lastTradeTs) lastTradeTs = tradeTs;

      markets.push({
        marketId,
        venue,
        symbol,
        marketType: marketType ?? 'spot',
        last: ticker.last ? Number(ticker.last) : trade.price ? Number(trade.price) : null,
        bestBid: ticker.bestBid ? Number(ticker.bestBid) : null,
        bestAsk: ticker.bestAsk ? Number(ticker.bestAsk) : null,
        updatedAt: updatedAt || null,
        lastTradeTs: tradeTs || null,
        hasTicker: Object.keys(ticker).length > 0,
        hasTrade: Object.keys(trade).length > 0,
      });
    }

    markets.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

    const symbols = new Set(markets.map((market) => market.symbol).filter(Boolean));

    return {
      markets,
      tickerKeyCount: tickerKeys.length,
      tradeKeyCount: tradeKeys.length,
      activeMarketCount: marketIds.size,
      activeSymbolCount: symbols.size,
      lastTickerTs,
      lastTradeTs,
    };
  }

  async getStatus() {
    const health = await this.getHealth();
    const redisKeys = await this.redis.dbsize();
    const redisStats = await this.getActiveMarkets();

    let clickhouseRows = 0;
    let clickhouseLatest: number | null = null;
    try {
      const result = await this.clickHouse.query({
        query: 'select count() as rows, max(start_ts) as latest from candles_1s',
        format: 'JSONEachRow',
      });
      const rows = (await result.json()) as Array<{ rows: number; latest: string | null }>;
      if (rows[0]) {
        clickhouseRows = Number(rows[0].rows ?? 0);
        clickhouseLatest = rows[0].latest ? new Date(rows[0].latest).getTime() : null;
      }
    } catch (err) {
      console.warn('ClickHouse status query failed', err);
    }

    let pgAssets = 0;
    let pgMarkets = 0;
    let pgAudits = 0;
    try {
      const [assetsRes, marketsRes, auditsRes] = await Promise.all([
        this.pg.query('select count(*) as count from assets'),
        this.pg.query('select count(*) as count from markets'),
        this.pg.query('select count(*) as count from audit_events'),
      ]);
      pgAssets = Number(assetsRes.rows?.[0]?.count ?? 0);
      pgMarkets = Number(marketsRes.rows?.[0]?.count ?? 0);
      pgAudits = Number(auditsRes.rows?.[0]?.count ?? 0);
    } catch (err) {
      console.warn('Postgres status query failed', err);
    }

    return {
      generatedAt: Date.now(),
      health,
      redis: {
        status: health.redis,
        keysTotal: redisKeys,
        tickerKeys: redisStats.tickerKeyCount,
        tradeKeys: redisStats.tradeKeyCount,
        activeMarkets: redisStats.activeMarketCount,
        activeSymbols: redisStats.activeSymbolCount,
        lastTickerTs: redisStats.lastTickerTs || null,
        lastTradeTs: redisStats.lastTradeTs || null,
      },
      clickhouse: {
        status: health.clickhouse,
        candlesRows: clickhouseRows,
        lastCandleTs: clickhouseLatest,
      },
      postgres: {
        status: health.postgres,
        assets: pgAssets,
        markets: pgMarkets,
        audits: pgAudits,
      },
      activeMarkets: redisStats.markets,
    };
  }

  async getHealth() {
    const redisStatus = (await this.redis.ping()) === 'PONG' ? 'up' : 'down';

    let postgresStatus: 'up' | 'down' = 'down';
    try {
      const pg = await this.pg.query('select now() as ts');
      postgresStatus = pg.rowCount ? 'up' : 'down';
    } catch (err) {
      console.error('postgres health failed', err);
    }

    let clickhouseStatus: 'up' | 'down' = 'down';
    try {
      await this.clickHouse.ping();
      clickhouseStatus = 'up';
    } catch (err) {
      console.error('clickhouse health failed', err);
    }

    return {
      redis: redisStatus,
      postgres: postgresStatus,
      clickhouse: clickhouseStatus,
    };
  }

  private intervalToMs(interval: string) {
    switch (interval) {
      case '1s':
        return 1000;
      case '5s':
        return 5000;
      case '1m':
        return 60_000;
      case '5m':
        return 300_000;
      case '1h':
        return 3_600_000;
      case '1d':
        return 86_400_000;
      default:
        throw new Error(`Unsupported interval ${interval}`);
    }
  }
}
