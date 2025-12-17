import { getClickHouseClient } from '../clients/clickhouseClient.js';
import { CandleEvent } from '@airapiserv/core';

export class CandleRepository {
  async upsert(event: CandleEvent) {
    const client = getClickHouseClient();
    const startTs = new Date(event.startTs);
    const startTsString = startTs.toISOString().slice(0, 19).replace('T', ' ');
    await client.insert({
      table: 'candles_1s',
      values: [
        {
          start_ts: startTsString,
          interval_ms: event.intervalMs,
          market_id: event.marketId,
          open: event.open,
          high: event.high,
          low: event.low,
          close: event.close,
          volume: event.volume,
          trades_count: event.tradesCount ?? 0,
          is_final: event.isFinal ? 1 : 0,
        },
      ],
      format: 'JSONEachRow',
    });
  }
}
