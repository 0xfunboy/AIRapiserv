import { getPgPool } from '../clients/postgresClient.js';

export type TokenRecord = {
  tokenId?: string;
  symbol?: string | null;
  name?: string | null;
  chain?: string | null;
  contractAddress?: string | null;
  coingeckoId?: string | null;
  coinmarketcapId?: string | null;
  cryptocompareId?: string | null;
  codexId?: string | null;
  dextoolsId?: string | null;
  status?: string;
  prioritySource?: string | null;
  discoveryConfidence?: number;
};

export type TokenVenueRecord = {
  tokenId: string;
  venue: string;
  marketType: string;
  baseSymbol?: string | null;
  quoteSymbol?: string | null;
  venueSymbol: string;
  wsSupported?: boolean;
  ohlcvSupported?: boolean;
  lastVerifiedAt?: Date;
};

export type CandleRecord = {
  tokenId: string;
  venue: string;
  timeframe: string;
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: string;
};

export class TokenRepository {
  private readonly pg = getPgPool();

  async upsertTokens(tokens: TokenRecord[]) {
    if (!tokens.length) return;
    const now = new Date();
    const rows = tokens.map((t) => ({
      token_id: t.tokenId,
      symbol: t.symbol ?? null,
      name: t.name ?? null,
      chain: t.chain ?? null,
      contract_address: t.contractAddress ?? null,
      coingecko_id: t.coingeckoId ?? null,
      coinmarketcap_id: t.coinmarketcapId ?? null,
      cryptocompare_id: t.cryptocompareId ?? null,
      codex_id: t.codexId ?? null,
      dextools_id: t.dextoolsId ?? null,
      status: t.status ?? 'active',
      priority_source: t.prioritySource ?? null,
      discovery_confidence: t.discoveryConfidence ?? 0,
      first_seen_at: now,
      last_seen_at: now,
    }));

    const sql = `
      insert into tokens (
        token_id, symbol, name, chain, contract_address,
        coingecko_id, coinmarketcap_id, cryptocompare_id, codex_id, dextools_id,
        status, priority_source, discovery_confidence, first_seen_at, last_seen_at
      )
      select
        coalesce(data.token_id, gen_random_uuid()),
        data.symbol, data.name, data.chain, data.contract_address,
        data.coingecko_id, data.coinmarketcap_id, data.cryptocompare_id, data.codex_id, data.dextools_id,
        data.status, data.priority_source, data.discovery_confidence, data.first_seen_at, data.last_seen_at
      from jsonb_to_recordset($1::jsonb) as data(
        token_id uuid,
        symbol text,
        name text,
        chain text,
        contract_address text,
        coingecko_id text,
        coinmarketcap_id text,
        cryptocompare_id text,
        codex_id text,
        dextools_id text,
        status text,
        priority_source text,
        discovery_confidence real,
        first_seen_at timestamptz,
        last_seen_at timestamptz
      )
      on conflict (token_id) do update set
        symbol = coalesce(excluded.symbol, tokens.symbol),
        name = coalesce(excluded.name, tokens.name),
        chain = coalesce(excluded.chain, tokens.chain),
        contract_address = coalesce(excluded.contract_address, tokens.contract_address),
        coalesce(coingecko_id, excluded.coingecko_id),
        coalesce(coinmarketcap_id, excluded.coinmarketcap_id),
        coalesce(cryptocompare_id, excluded.cryptocompare_id),
        coalesce(codex_id, excluded.codex_id),
        coalesce(dextools_id, excluded.dextools_id),
        status = excluded.status,
        priority_source = coalesce(excluded.priority_source, tokens.priority_source),
        discovery_confidence = greatest(tokens.discovery_confidence, excluded.discovery_confidence),
        last_seen_at = excluded.last_seen_at;`;

    await this.pg.query(sql, [JSON.stringify(rows)]);
  }

  async upsertVenues(venues: TokenVenueRecord[]) {
    if (!venues.length) return;
    const rows = venues.map((v) => ({
      ...v,
      baseSymbol: v.baseSymbol ?? null,
      quoteSymbol: v.quoteSymbol ?? null,
      wsSupported: v.wsSupported ?? false,
      ohlcvSupported: v.ohlcvSupported ?? false,
      lastVerifiedAt: v.lastVerifiedAt ?? new Date(),
    }));

    const sql = `
      insert into token_venues (
        token_id, venue, market_type, base_symbol, quote_symbol, venue_symbol, ws_supported, ohlcv_supported, last_verified_at
      )
      select
        data.token_id, data.venue, data.market_type, data.base_symbol, data.quote_symbol,
        data.venue_symbol, data.ws_supported, data.ohlcv_supported, data.last_verified_at
      from jsonb_to_recordset($1::jsonb) as data(
        token_id uuid,
        venue text,
        market_type text,
        base_symbol text,
        quote_symbol text,
        venue_symbol text,
        ws_supported boolean,
        ohlcv_supported boolean,
        last_verified_at timestamptz
      )
      on conflict (token_id, venue, market_type, venue_symbol) do update set
        base_symbol = coalesce(excluded.base_symbol, token_venues.base_symbol),
        quote_symbol = coalesce(excluded.quote_symbol, token_venues.quote_symbol),
        ws_supported = excluded.ws_supported,
        ohlcv_supported = excluded.ohlcv_supported,
        last_verified_at = excluded.last_verified_at;`;

    await this.pg.query(sql, [JSON.stringify(rows)]);
  }

  async insertCandles(candles: CandleRecord[]) {
    if (!candles.length) return;
    const sql = `
      insert into candles (
        token_id, venue, timeframe, open_time, open, high, low, close, volume, source
      )
      select
        data.token_id, data.venue, data.timeframe, data.open_time, data.open, data.high, data.low, data.close, data.volume, data.source
      from jsonb_to_recordset($1::jsonb) as data(
        token_id uuid,
        venue text,
        timeframe text,
        open_time bigint,
        open double precision,
        high double precision,
        low double precision,
        close double precision,
        volume double precision,
        source text
      )
      on conflict (token_id, venue, timeframe, open_time) do update set
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        volume = excluded.volume,
        source = excluded.source;`;
    await this.pg.query(sql, [JSON.stringify(candles)]);
  }
}
