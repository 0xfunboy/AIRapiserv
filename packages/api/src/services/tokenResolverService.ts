import { TokenCatalogRepository, TokenRepository } from '@airapiserv/storage';

type CatalogRow = {
  tokenKey: string;
  symbol: string | null;
  name: string | null;
  chain: string | null;
  contractAddress: string | null;
  sources: string[];
  metadata: Record<string, any>;
};

type MergeKey = string;

const normalizeSymbol = (s?: string | null) => (s ?? '').trim().toUpperCase() || null;
const normalizeChain = (c?: string | null) => (c ?? '').trim().toLowerCase() || null;
const normalizeAddress = (a?: string | null) => (a ?? '').trim().toLowerCase() || null;

export class TokenResolverService {
  private readonly catalog = new TokenCatalogRepository();
  private readonly tokens = new TokenRepository();
  private readonly logger: any;

  constructor(logger?: any) {
    this.logger = logger?.child ? logger.child({ name: 'token-resolver' }) : console;
  }

  async run() {
    const entries = await this.catalog.listAll();
    if (!entries.length) return;

    const merged = this.mergeEntries(entries);
    await this.tokens.upsertTokens(merged);
    this.logger.info?.({ tokens: merged.length }, 'resolved tokens from catalog');
  }

  private mergeEntries(rows: CatalogRow[]) {
    const map = new Map<MergeKey, CatalogRow[]>();

    // strong keys: chain+contract, provider ids
    const addToKey = (key: MergeKey, row: CatalogRow) => {
      if (!key) return;
      const arr = map.get(key) ?? [];
      arr.push(row);
      map.set(key, arr);
    };

    rows.forEach((row) => {
      const chain = normalizeChain(row.chain);
      const addr = normalizeAddress(row.contractAddress);
      if (chain && addr) addToKey(`ca:${chain}:${addr}`, row);
      const md = row.metadata || {};
      if (md.coingeckoId) addToKey(`cg:${md.coingeckoId}`, row);
      if (md.cmcId) addToKey(`cmc:${md.cmcId}`, row);
      if (md.cryptocompareId) addToKey(`cc:${md.cryptocompareId}`, row);
      if (md.codexId) addToKey(`cx:${md.codexId}`, row);
      if (md.dextoolsId) addToKey(`dt:${md.dextoolsId}`, row);
      const sym = normalizeSymbol(row.symbol);
      const name = (row.name ?? '').trim().toLowerCase();
      if (sym && name) addToKey(`symname:${sym}:${name}`, row);
    });

    // merge per key, pick best fields
    const merged: any[] = [];
    for (const bucket of map.values()) {
      const mergedRow = this.mergeBucket(bucket);
      merged.push(mergedRow);
    }

    return merged;
  }

  private mergeBucket(bucket: CatalogRow[]) {
    const symbol = this.pickFirst(bucket.map((b) => normalizeSymbol(b.symbol)));
    const name = this.pickFirst(bucket.map((b) => (b.name ?? '').trim()).filter(Boolean)) ?? null;
    const chain = this.pickFirst(bucket.map((b) => normalizeChain(b.chain)));
    const contract = this.pickFirst(bucket.map((b) => normalizeAddress(b.contractAddress)));
    const md = Object.assign({}, ...bucket.map((b) => b.metadata ?? {}));
    const sources = Array.from(new Set(bucket.flatMap((b) => b.sources || [])));
    const confidence = contract ? 90 : md.coingeckoId || md.cmcId ? 75 : symbol ? 50 : 10;

    return {
      symbol,
      name,
      chain,
      contractAddress: contract,
      coingeckoId: md.coingeckoId ?? null,
      coinmarketcapId: md.cmcId ?? null,
      cryptocompareId: md.cryptocompareId ?? null,
      codexId: md.codexId ?? null,
      dextoolsId: md.dextoolsId ?? null,
      status: 'active',
      prioritySource: null,
      discoveryConfidence: confidence,
    };
  }

  private pickFirst<T>(values: Array<T | null | undefined>) {
    return values.find((v) => v !== null && v !== undefined) ?? null;
  }
}
