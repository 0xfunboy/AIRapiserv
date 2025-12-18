import { getPgPool } from '../clients/postgresClient.js';

export interface TokenCatalogEntry {
  tokenKey: string;
  symbol: string | null;
  name: string | null;
  chain: string | null;
  contractAddress: string | null;
  sources: string[];
  metadata: Record<string, unknown>;
}

export class TokenCatalogRepository {
  private readonly pg = getPgPool();

  async upsertTokens(tokens: TokenCatalogEntry[]) {
    if (!tokens.length) return;

    const tokenKeys = tokens.map((token) => token.tokenKey);
    const symbols = tokens.map((token) => token.symbol);
    const names = tokens.map((token) => token.name);
    const chains = tokens.map((token) => token.chain);
    const contracts = tokens.map((token) => token.contractAddress);
    const sources = tokens.map((token) => token.sources);
    const metadata = tokens.map((token) => token.metadata);

    const query = `
      insert into token_catalog (token_key, symbol, name, chain, contract_address, sources, metadata, updated_at)
      select * from unnest(
        $1::text[],
        $2::text[],
        $3::text[],
        $4::text[],
        $5::text[],
        $6::text[][],
        $7::jsonb[],
        $8::timestamptz[]
      )
      on conflict (token_key) do update set
        symbol = coalesce(excluded.symbol, token_catalog.symbol),
        name = coalesce(excluded.name, token_catalog.name),
        chain = coalesce(excluded.chain, token_catalog.chain),
        contract_address = coalesce(excluded.contract_address, token_catalog.contract_address),
        sources = (
          select array(
            select distinct unnest(token_catalog.sources || excluded.sources)
          )
        ),
        metadata = token_catalog.metadata || excluded.metadata,
        updated_at = now()
    `;

    const now = new Date();
    await this.pg.query(query, [tokenKeys, symbols, names, chains, contracts, sources, metadata, tokens.map(() => now)]);
  }

  async listTokens(params: { q?: string; limit?: number; offset?: number }) {
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;
    const q = params.q?.trim();
    const search = q ? `%${q}%` : null;
    const query = `
      select token_key as "tokenKey",
             symbol,
             name,
             chain,
             contract_address as "contractAddress",
             sources,
             updated_at as "updatedAt"
      from token_catalog
      where ($1::text is null)
         or (symbol ilike $1 or name ilike $1 or contract_address ilike $1)
      order by updated_at desc nulls last
      limit $2 offset $3
    `;
    const result = await this.pg.query(query, [search, limit, offset]);
    return result.rows;
  }

  async countTokens() {
    const result = await this.pg.query('select count(*) as count, max(updated_at) as last_updated from token_catalog');
    return {
      count: Number(result.rows?.[0]?.count ?? 0),
      lastUpdatedAt: result.rows?.[0]?.last_updated ? new Date(result.rows[0].last_updated).getTime() : null,
    };
  }
}
