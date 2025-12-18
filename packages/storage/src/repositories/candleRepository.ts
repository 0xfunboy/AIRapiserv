import { getClickHouseClient } from '../clients/clickhouseClient.js';
import { getPgPool } from '../clients/postgresClient.js';
import { CandleEvent } from '@airapiserv/core';

const intervalToTf = (intervalMs: number) => {
  switch (intervalMs) {
    case 1000:
      return '1s';
    case 5000:
      return '5s';
    case 60_000:
      return '1m';
    default:
      return `${intervalMs}ms`;
  }
};

export class CandleRepository {
  private readonly pg = getPgPool();

  async upsert(event: CandleEvent, meta?: { tokenId?: string; venue?: string; timeframe?: string }) {
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

    if (meta?.tokenId) {
      const venue = meta.venue ?? event.marketId.split(':')[0] ?? 'unknown';
      const timeframe = meta.timeframe ?? intervalToTf(event.intervalMs);
      await this.pg.query(
        `insert into candles (token_id, venue, timeframe, open_time, open, high, low, close, volume, source)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (token_id, venue, timeframe, open_time) do update set
           open = excluded.open,
           high = excluded.high,
           low = excluded.low,
           close = excluded.close,
           volume = excluded.volume,
           source = excluded.source`,
        [
          meta.tokenId,
          venue,
          timeframe,
          event.startTs,
          event.open,
          event.high,
          event.low,
          event.close,
          event.volume,
          event.source,
        ]
      );
    }
  }
}
