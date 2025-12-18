import { getPgPool } from '../clients/postgresClient.js';
import { VenueMarket } from '@airapiserv/core';

export class MarketsCacheRepository {
  private readonly pg = getPgPool();

  async upsertMarkets(venue: string, markets: VenueMarket[]) {
    if (!markets.length) return;
    const rows = markets.map((m) => ({
      venue,
      market_type: m.marketType,
      base_symbol: m.baseSymbol,
      quote_symbol: m.quoteSymbol,
      venue_symbol: m.venueSymbol,
      updated_at: new Date(),
    }));
    const sql = `
      insert into markets_cache (venue, market_type, base_symbol, quote_symbol, venue_symbol, updated_at)
      select
        data.venue, data.market_type, data.base_symbol, data.quote_symbol, data.venue_symbol, data.updated_at
      from jsonb_to_recordset($1::jsonb) as data(
        venue text,
        market_type text,
        base_symbol text,
        quote_symbol text,
        venue_symbol text,
        updated_at timestamptz
      )
      on conflict (venue, venue_symbol) do update set
        market_type = excluded.market_type,
        base_symbol = excluded.base_symbol,
        quote_symbol = excluded.quote_symbol,
        updated_at = excluded.updated_at;`;
    await this.pg.query(sql, [JSON.stringify(rows)]);
  }

  async listByBaseSymbols(symbols: string[]) {
    if (!symbols.length) return [];
    const upper = symbols.map((s) => (s ?? '').toUpperCase()).filter(Boolean);
    if (!upper.length) return [];
    const res = await this.pg.query(
      `select venue, market_type as "marketType", base_symbol as "baseSymbol", quote_symbol as "quoteSymbol", venue_symbol as "venueSymbol", updated_at as "updatedAt"
       from markets_cache
       where upper(base_symbol) = any($1)`,
      [upper]
    );
    return res.rows as Array<{
      venue: string;
      marketType: string;
      baseSymbol: string | null;
      quoteSymbol: string | null;
      venueSymbol: string;
      updatedAt: string;
    }>;
  }

  async listAll(limit = 500000) {
    const res = await this.pg.query(
      `select venue, market_type as "marketType", base_symbol as "baseSymbol", quote_symbol as "quoteSymbol", venue_symbol as "venueSymbol", updated_at as "updatedAt"
       from markets_cache
       order by updated_at desc
       limit $1`,
      [limit]
    );
    return res.rows as Array<{
      venue: string;
      marketType: string;
      baseSymbol: string | null;
      quoteSymbol: string | null;
      venueSymbol: string;
      updatedAt: string;
    }>;
  }
}
