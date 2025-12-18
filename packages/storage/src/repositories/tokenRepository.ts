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

  async getToken(tokenId: string) {
    const res = await this.pg.query(
      `select token_id as "tokenId",
              symbol,
              name,
              chain,
              contract_address as "contractAddress",
              priority_source as "prioritySource"
       from tokens
       where token_id = $1`,
      [tokenId]
    );
    return res.rows?.[0] ?? null;
  }

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
        coingecko_id = coalesce(excluded.coingecko_id, tokens.coingecko_id),
        coinmarketcap_id = coalesce(excluded.coinmarketcap_id, tokens.coinmarketcap_id),
        cryptocompare_id = coalesce(excluded.cryptocompare_id, tokens.cryptocompare_id),
        codex_id = coalesce(excluded.codex_id, tokens.codex_id),
        dextools_id = coalesce(excluded.dextools_id, tokens.dextools_id),
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

  async searchTokens(q: string, limit = 50) {
    const search = `%${q}%`;
    const res = await this.pg.query(
      `select token_id as "tokenId",
              symbol,
              name,
              chain,
              contract_address as "contractAddress",
              priority_source as "prioritySource",
              discovery_confidence as "discoveryConfidence"
       from tokens
       where symbol ilike $1 or name ilike $1 or contract_address ilike $1
       order by last_seen_at desc
       limit $2`,
      [search, limit]
    );
    return res.rows;
  }

  async getVenues(tokenId: string) {
    const res = await this.pg.query(
      `select venue, market_type as "marketType", base_symbol as "baseSymbol", quote_symbol as "quoteSymbol",
              venue_symbol as "venueSymbol", ws_supported as "wsSupported", ohlcv_supported as "ohlcvSupported",
              last_verified_at as "lastVerifiedAt"
       from token_venues
       where token_id = $1`,
      [tokenId]
    );
    return res.rows;
  }

  async getCandles(tokenId: string, timeframe: string, from?: number, to?: number, limit = 200) {
    const params: any[] = [tokenId, timeframe];
    let where = 'token_id = $1 and timeframe = $2';
    if (from) {
      params.push(from);
      where += ` and open_time >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      where += ` and open_time <= $${params.length}`;
    }
    params.push(limit);
    const res = await this.pg.query(
      `select venue, open_time as "openTime", open, high, low, close, volume, source
       from candles
       where ${where}
       order by open_time desc
       limit $${params.length}`,
      params
    );
    return res.rows;
  }

  async listActiveTokens(limit = 5000) {
    const res = await this.pg.query(
      `select token_id as "tokenId",
              symbol,
              priority_source as "prioritySource"
       from tokens
       where status = 'active' and symbol is not null
       order by last_seen_at desc
       limit $1`,
      [limit]
    );
    return res.rows as Array<{ tokenId: string; symbol: string; prioritySource: string | null }>;
  }

  async setPrioritySource(tokenId: string, source: string | null) {
    await this.pg.query(`update tokens set priority_source = $2, last_seen_at = now() where token_id = $1`, [tokenId, source]);
  }
}
