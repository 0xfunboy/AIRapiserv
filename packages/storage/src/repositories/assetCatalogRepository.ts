import { getPgPool } from '../clients/postgresClient.js';

export type AssetUpsert = {
  assetId: string;
  symbol: string | null;
  name: string | null;
  chain: string | null;
  contractAddress: string | null;
  sources: string[];
  metadata: Record<string, unknown>;
  firstSeenSource: string;
};

export class AssetCatalogRepository {
  private readonly pg = getPgPool();

  async upsertAssets(tokens: AssetUpsert[]) {
    if (!tokens.length) return;

    const now = new Date();

    const assetRows = tokens.map((token) => ({
      asset_id: token.assetId,
      symbol: token.symbol,
      name: token.name,
      primary_chain: token.chain,
      primary_contract: token.contractAddress,
      coingecko_id: (token.metadata as any)?.coingeckoId ?? null,
      coinmarketcap_id: (token.metadata as any)?.cmcId ?? null,
      defillama_id: (token.metadata as any)?.defillamaId ?? null,
      first_seen_source: token.firstSeenSource,
      first_seen_at: now.toISOString(),
      updated_at: now.toISOString(),
    }));

    const aliases = tokens.flatMap((token) => {
      const rows: Array<{ asset_id: string; alias: string; kind: string; source: string }> = [];
      if (token.symbol) rows.push({ asset_id: token.assetId, alias: token.symbol, kind: 'symbol', source: token.firstSeenSource });
      if (token.name) rows.push({ asset_id: token.assetId, alias: token.name, kind: 'name', source: token.firstSeenSource });
      return rows;
    });

    const contracts = tokens
      .filter((token) => token.chain && token.contractAddress)
      .map((token) => ({
        asset_id: token.assetId,
        chain: token.chain,
        contract_address: token.contractAddress,
        source: token.firstSeenSource,
        first_seen_at: now.toISOString(),
        last_seen_at: now.toISOString(),
      }));

    const sources = tokens.flatMap((token) =>
      token.sources.map((source) => ({
        asset_id: token.assetId,
        source,
        confidence: 80,
        metadata: token.metadata,
        first_seen_at: now.toISOString(),
        last_seen_at: now.toISOString(),
      }))
    );

    await this.pg.query(
      `insert into assets (asset_id, symbol, name, primary_chain, primary_contract, coingecko_id, coinmarketcap_id, defillama_id, first_seen_source, first_seen_at, updated_at)
       select * from unnest(
         $1::text[],
         $2::text[],
         $3::text[],
         $4::text[],
         $5::text[],
         $6::text[],
         $7::text[],
         $8::text[],
         $9::text[],
         $10::timestamptz[],
         $11::timestamptz[]
       )
       on conflict (asset_id) do update set
         symbol = coalesce(excluded.symbol, assets.symbol),
         name = coalesce(excluded.name, assets.name),
         primary_chain = coalesce(excluded.primary_chain, assets.primary_chain),
         primary_contract = coalesce(excluded.primary_contract, assets.primary_contract),
         coingecko_id = coalesce(excluded.coingecko_id, assets.coingecko_id),
         coinmarketcap_id = coalesce(excluded.coinmarketcap_id, assets.coinmarketcap_id),
         defillama_id = coalesce(excluded.defillama_id, assets.defillama_id),
         updated_at = excluded.updated_at;`,
      [
        assetRows.map((row) => row.asset_id),
        assetRows.map((row) => row.symbol),
        assetRows.map((row) => row.name),
        assetRows.map((row) => row.primary_chain),
        assetRows.map((row) => row.primary_contract),
        assetRows.map((row) => row.coingecko_id),
        assetRows.map((row) => row.coinmarketcap_id),
        assetRows.map((row) => row.defillama_id),
        assetRows.map((row) => row.first_seen_source),
        assetRows.map((row) => row.first_seen_at),
        assetRows.map((row) => row.updated_at),
      ]
    );

    if (contracts.length) {
      await this.pg.query(
        `insert into asset_contracts (asset_id, chain, contract_address, source, primary, first_seen_at, last_seen_at)
         select * from unnest(
           $1::text[],
           $2::text[],
           $3::text[],
           $4::text[],
           $5::boolean[],
           $6::timestamptz[],
           $7::timestamptz[]
         )
         on conflict (asset_id, chain, contract_address) do update set
           source = coalesce(excluded.source, asset_contracts.source),
           last_seen_at = excluded.last_seen_at;`,
        [
          contracts.map((c) => c.asset_id),
          contracts.map((c) => c.chain),
          contracts.map((c) => c.contract_address),
          contracts.map((c) => c.source),
          contracts.map(() => false),
          contracts.map((c) => c.first_seen_at),
          contracts.map((c) => c.last_seen_at),
        ]
      );
    }

    if (aliases.length) {
      await this.pg.query(
        `insert into asset_aliases (asset_id, alias, kind, source, created_at)
         select * from unnest(
           $1::text[],
           $2::text[],
           $3::text[],
           $4::text[],
           $5::timestamptz[]
         )
         on conflict (asset_id, alias, kind) do nothing;`,
        [
          aliases.map((a) => a.asset_id),
          aliases.map((a) => a.alias),
          aliases.map((a) => a.kind),
          aliases.map((a) => a.source),
          aliases.map(() => now.toISOString()),
        ]
      );
    }

    if (sources.length) {
      await this.pg.query(
        `insert into asset_sources (asset_id, source, confidence, metadata, first_seen_at, last_seen_at)
         select * from unnest(
           $1::text[],
           $2::text[],
           $3::int[],
           $4::jsonb[],
           $5::timestamptz[],
           $6::timestamptz[]
         )
         on conflict (asset_id, source) do update set
           confidence = excluded.confidence,
           metadata = asset_sources.metadata || excluded.metadata,
           last_seen_at = excluded.last_seen_at;`,
        [
          sources.map((s) => s.asset_id),
          sources.map((s) => s.source),
          sources.map((s) => s.confidence),
          sources.map((s) => s.metadata as any),
          sources.map((s) => s.first_seen_at),
          sources.map((s) => s.last_seen_at),
        ]
      );
    }
  }

  async listTokens(params: { q?: string; limit?: number; offset?: number }) {
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;
    const q = params.q?.trim();
    const search = q ? `%${q}%` : null;
    const query = `
      select a.asset_id as "tokenKey",
             a.symbol,
             a.name,
             array_agg(distinct ac.chain) as chains,
             count(distinct ac.contract_address) as contracts,
             array_agg(distinct al.alias) filter (where al.kind = 'symbol') as aliases,
             array_agg(distinct s.source) as sources,
             a.updated_at as "updatedAt"
      from assets a
      left join asset_contracts ac on ac.asset_id = a.asset_id
      left join asset_aliases al on al.asset_id = a.asset_id
      left join asset_sources s on s.asset_id = a.asset_id
      where ($1::text is null)
         or (a.symbol ilike $1 or a.name ilike $1 or exists (
            select 1 from asset_aliases al2 where al2.asset_id = a.asset_id and al2.alias ilike $1
         ) or exists (
            select 1 from asset_contracts ac2 where ac2.asset_id = a.asset_id and ac2.contract_address ilike $1
         ))
      group by a.asset_id
      order by a.updated_at desc nulls last
      limit $2 offset $3;
    `;
    const result = await this.pg.query(query, [search, limit, offset]);
    return result.rows;
  }

  async getTokenDetail(tokenKey: string) {
    const assetRes = await this.pg.query(
      `select asset_id as "assetId",
              symbol,
              name,
              primary_chain as "primaryChain",
              primary_contract as "primaryContract",
              coalesce(coingecko_id,'') as "coingeckoId",
              coalesce(coinmarketcap_id,'') as "coinmarketcapId",
              coalesce(defillama_id,'') as "defillamaId",
              first_seen_source as "firstSeenSource",
              first_seen_at as "firstSeenAt",
              updated_at as "updatedAt"
       from assets where asset_id = $1`,
      [tokenKey]
    );
    if (!assetRes.rowCount) return null;
    const contractsRes = await this.pg.query(
      `select chain, contract_address as "contractAddress", source, first_seen_at as "firstSeenAt", last_seen_at as "lastSeenAt"
       from asset_contracts where asset_id = $1 order by chain`,
      [tokenKey]
    );
    const aliasesRes = await this.pg.query(
      `select alias, kind, source, created_at as "createdAt" from asset_aliases where asset_id = $1`,
      [tokenKey]
    );
    const sourcesRes = await this.pg.query(
      `select source, confidence, metadata, first_seen_at as "firstSeenAt", last_seen_at as "lastSeenAt" from asset_sources where asset_id = $1`,
      [tokenKey]
    );
    const marketsRes = await this.pg.query(
      `select market_id as "marketId", venue, venue_symbol as "venueSymbol", market_type as "marketType", status, ws_capable as "wsCapable",
              rest_capable as "restCapable", updated_at as "updatedAt"
       from markets where base_asset_id = $1 or quote_asset_id = $1
       order by updated_at desc nulls last
       limit 200`,
      [tokenKey]
    );

    return {
      ...assetRes.rows[0],
      contracts: contractsRes.rows,
      aliases: aliasesRes.rows,
      sources: sourcesRes.rows,
      markets: marketsRes.rows,
    };
  }
}
