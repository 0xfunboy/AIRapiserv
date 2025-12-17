import { SymbolResolver, selectProvider } from '@airapiserv/core';
import { getRedisClient, getClickHouseClient, getPgPool } from '@airapiserv/storage';

export class MarketService {
  private readonly resolver = new SymbolResolver();
  private readonly redis = getRedisClient();
  private readonly clickHouse = getClickHouseClient();
  private readonly pg = getPgPool();

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
    const data = await this.redis.hgetall(`ticker:${marketId}`);
    if (!Object.keys(data).length) {
      return null;
    }
    return {
      marketId,
      last: Number(data.last ?? 0),
      mark: data.mark ? Number(data.mark) : undefined,
      bestBid: data.bestBid ? Number(data.bestBid) : undefined,
      bestAsk: data.bestAsk ? Number(data.bestAsk) : undefined,
      updatedAt: Number(data.updatedAt ?? Date.now()),
    };
  }

  async getTrades(marketId: string, limit = 100) {
    // Placeholder: fetch last trade from Redis while ClickHouse ingestion is still stubbed
    const lastTrade = await this.redis.hgetall(`trade:${marketId}`);
    if (!Object.keys(lastTrade).length) {
      return [];
    }
    return [
      {
        marketId,
        price: Number(lastTrade.price ?? 0),
        size: Number(lastTrade.size ?? 0),
        side: lastTrade.side ?? 'unknown',
        timestamp: Number(lastTrade.ts ?? Date.now()),
      },
    ].slice(0, limit);
  }

  async getOhlcv(params: { marketId: string; interval: string; limit?: number }) {
    try {
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
          marketId: params.marketId,
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
