import { getPgPool } from '../clients/postgresClient.js';

export class MarketRepository {
  private readonly pg = getPgPool();

  async upsertMarket(params: {
    marketId: string;
    venue: string;
    symbol: string;
    marketType: string;
    status?: string;
    wsCapable?: boolean;
    restCapable?: boolean;
    metadata?: Record<string, unknown>;
    baseAssetId?: string | null;
    quoteAssetId?: string | null;
  }) {
    await this.pg.query(
      `insert into markets (market_id, base_asset_id, quote_asset_id, market_type, venue, venue_symbol, status, ws_capable, rest_capable, metadata, discovered_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now(), now())
       on conflict (market_id) do update set
         base_asset_id = coalesce(excluded.base_asset_id, markets.base_asset_id),
         quote_asset_id = coalesce(excluded.quote_asset_id, markets.quote_asset_id),
         market_type = excluded.market_type,
         venue = excluded.venue,
         venue_symbol = excluded.venue_symbol,
         status = excluded.status,
         ws_capable = excluded.ws_capable,
         rest_capable = excluded.rest_capable,
         metadata = markets.metadata || excluded.metadata,
         updated_at = now();`,
      [
        params.marketId,
        params.baseAssetId ?? null,
        params.quoteAssetId ?? null,
        params.marketType,
        params.venue,
        params.symbol,
        params.status ?? 'active',
        params.wsCapable ?? true,
        params.restCapable ?? true,
        params.metadata ?? {},
      ]
    );
  }
}
