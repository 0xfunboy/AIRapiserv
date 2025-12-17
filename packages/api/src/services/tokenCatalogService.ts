import { TokenCatalogRepository } from '@airapiserv/storage';
import { loadEnv } from '../config/loadEnv.js';

type TokenRecord = {
  tokenKey: string;
  symbol: string | null;
  name: string | null;
  chain: string | null;
  contractAddress: string | null;
  sources: string[];
  metadata: Record<string, unknown>;
};

type RefreshResult = {
  refreshed: boolean;
  tokens: number;
  sources: string[];
  tookMs: number;
  lastRefreshAt: number;
};

const DEFAULT_REFRESH_MS = 30 * 60 * 1000;

export class TokenCatalogService {
  private readonly repo = new TokenCatalogRepository();
  private readonly logger: { info: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void };
  private lastRefreshAt = 0;
  private lastStats: RefreshResult | null = null;
  private inFlight?: Promise<RefreshResult>;

  constructor(logger: { child?: (bindings: Record<string, unknown>) => any } & Record<string, any>) {
    if (logger?.child) {
      this.logger = logger.child({ name: 'token-catalog' });
    } else {
      this.logger = console;
    }
  }

  start() {
    loadEnv();
    const enabled = process.env.ENABLE_TOKEN_CATALOG !== 'false';
    if (!enabled) {
      this.logger.info('Token catalog refresh disabled via ENABLE_TOKEN_CATALOG=false');
      return;
    }
    const interval = Number(process.env.TOKEN_CATALOG_REFRESH_MS ?? DEFAULT_REFRESH_MS);
    this.refreshTokens({ force: true }).catch((err) => this.logger.error({ err }, 'initial token refresh failed'));
    setInterval(() => {
      this.refreshTokens().catch((err) => this.logger.error({ err }, 'scheduled token refresh failed'));
    }, interval).unref();
  }

  async refreshTokens(params: { force?: boolean } = {}) {
    loadEnv();
    const interval = Number(process.env.TOKEN_CATALOG_REFRESH_MS ?? DEFAULT_REFRESH_MS);
    if (!params.force && this.lastRefreshAt && Date.now() - this.lastRefreshAt < interval) {
      return this.lastStats ?? {
        refreshed: false,
        tokens: 0,
        sources: [],
        tookMs: 0,
        lastRefreshAt: this.lastRefreshAt,
      };
    }
    if (this.inFlight) return this.inFlight;

    this.logger.info({ force: params.force ?? false }, 'token refresh started');
    this.inFlight = this.doRefresh().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  getLastStats() {
    return this.lastStats;
  }

  async getStats() {
    const dbStats = await this.repo.countTokens();
    return {
      count: dbStats.count,
      lastUpdatedAt: dbStats.lastUpdatedAt,
      lastRefreshAt: this.lastRefreshAt || null,
      lastRefresh: this.lastStats,
    };
  }

  async listTokens(params: { q?: string; limit?: number; offset?: number }) {
    return this.repo.listTokens(params);
  }

  private async doRefresh(): Promise<RefreshResult> {
    const startedAt = Date.now();
    const sourceTokens: TokenRecord[] = [];
    const sources: string[] = [];

    const tokenMap = new Map<string, TokenRecord>();
    const mergeToken = (token: TokenRecord) => {
      if (!token.tokenKey) return;
      const existing = tokenMap.get(token.tokenKey);
      if (!existing) {
        tokenMap.set(token.tokenKey, token);
        return;
      }
      tokenMap.set(token.tokenKey, {
        tokenKey: token.tokenKey,
        symbol: existing.symbol ?? token.symbol,
        name: existing.name ?? token.name,
        chain: existing.chain ?? token.chain,
        contractAddress: existing.contractAddress ?? token.contractAddress,
        sources: Array.from(new Set([...existing.sources, ...token.sources])),
        metadata: { ...existing.metadata, ...token.metadata },
      });
    };

    const [cg, cmc, cc, ds, dt, cx] = await Promise.all([
      this.fetchCoinGecko(),
      this.fetchCoinMarketCap(),
      this.fetchCryptoCompare(),
      this.fetchDexScreener(),
      this.fetchDexTools(),
      this.fetchCodex(),
    ]);

    for (const batch of [cg, cmc, cc, ds, dt, cx]) {
      if (!batch?.tokens?.length) continue;
      sources.push(batch.source);
      sourceTokens.push(...batch.tokens);
    }

    sourceTokens.forEach((token) => mergeToken(token));

    const tokens = Array.from(tokenMap.values());
    await this.repo.upsertTokens(tokens);

    this.lastRefreshAt = Date.now();
    this.lastStats = {
      refreshed: true,
      tokens: tokens.length,
      sources,
      tookMs: Date.now() - startedAt,
      lastRefreshAt: this.lastRefreshAt,
    };

    this.logger.info({ tokens: tokens.length, sources, tookMs: this.lastStats.tookMs }, 'token catalog refreshed');
    return this.lastStats;
  }

  private normalizeSymbol(symbol?: string) {
    if (!symbol) return null;
    const cleaned = symbol.trim().toUpperCase();
    return cleaned || null;
  }

  private normalizeChain(chain?: string) {
    if (!chain) return null;
    return chain.trim().toLowerCase() || null;
  }

  private normalizeAddress(address?: string) {
    if (!address) return null;
    const cleaned = address.trim();
    return cleaned ? cleaned.toLowerCase() : null;
  }

  private buildTokenKey(symbol?: string, chain?: string, address?: string) {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    const normalizedChain = this.normalizeChain(chain);
    const normalizedAddress = this.normalizeAddress(address);

    if (normalizedAddress) {
      return `${normalizedChain ?? 'unknown'}:${normalizedAddress}`;
    }
    if (normalizedSymbol) {
      return `symbol:${normalizedSymbol}`;
    }
    return '';
  }

  private async fetchJson(url: string, options: Record<string, unknown> = {}, timeoutMs = 30000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal } as any);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchCoinGecko() {
    const apiKey = process.env.COINGECKO_API_KEY ?? '';
    const headers = apiKey ? { 'x-cg-pro-api-key': apiKey } : undefined;
    const url = 'https://api.coingecko.com/api/v3/coins/list?include_platform=true';
    try {
      const data = (await this.fetchJson(url, { headers })) as Array<{
        id: string;
        symbol: string;
        name: string;
        platforms?: Record<string, string>;
      }>;
      const tokens: TokenRecord[] = [];
      for (const coin of data) {
        const symbol = this.normalizeSymbol(coin.symbol);
        const name = coin.name ?? null;
        const platforms = coin.platforms ?? {};
        const platformEntries = Object.entries(platforms);

        if (platformEntries.length === 0) {
          const tokenKey = this.buildTokenKey(symbol ?? undefined);
          if (!tokenKey) continue;
          tokens.push({
            tokenKey,
            symbol,
            name,
            chain: null,
            contractAddress: null,
            sources: ['coingecko'],
            metadata: { coingeckoId: coin.id },
          });
          continue;
        }

        for (const [chain, address] of platformEntries) {
          if (!address) continue;
          const tokenKey = this.buildTokenKey(symbol ?? undefined, chain, address);
          if (!tokenKey) continue;
          tokens.push({
            tokenKey,
            symbol,
            name,
            chain: this.normalizeChain(chain),
            contractAddress: this.normalizeAddress(address),
            sources: ['coingecko'],
            metadata: { coingeckoId: coin.id },
          });
        }
      }
      return { source: 'coingecko', tokens };
    } catch (err) {
      this.logger.warn({ err }, 'CoinGecko token list failed');
      return null;
    }
  }

  private async fetchCoinMarketCap() {
    const apiKey = process.env.COINMARKETCAP_API_KEY ?? '';
    if (!apiKey) return null;
    const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?limit=5000';
    try {
      const data = (await this.fetchJson(url, {
        headers: { 'X-CMC_PRO_API_KEY': apiKey },
      })) as { data: Array<{ id: number; symbol: string; name: string; platform?: { name: string; token_address: string } }> };

      const tokens: TokenRecord[] = data.data.map((entry) => {
        const symbol = this.normalizeSymbol(entry.symbol);
        const name = entry.name ?? null;
        const chain = entry.platform?.name ?? null;
        const address = entry.platform?.token_address ?? null;
        const tokenKey = this.buildTokenKey(symbol ?? undefined, chain ?? undefined, address ?? undefined);
        return {
          tokenKey,
          symbol,
          name,
          chain: this.normalizeChain(chain ?? undefined),
          contractAddress: this.normalizeAddress(address ?? undefined),
          sources: ['coinmarketcap'],
          metadata: { cmcId: entry.id },
        };
      });

      return { source: 'coinmarketcap', tokens: tokens.filter((token) => token.tokenKey) };
    } catch (err) {
      this.logger.warn({ err }, 'CoinMarketCap token list failed');
      return null;
    }
  }

  private async fetchCryptoCompare() {
    const apiKey = process.env.CRYPTOCOMPARE_API_KEY ?? '';
    const url = 'https://min-api.cryptocompare.com/data/all/coinlist';
    try {
      const data = (await this.fetchJson(url, {
        headers: apiKey ? { Authorization: `Apikey ${apiKey}` } : undefined,
      })) as { Data: Record<string, { Symbol: string; CoinName: string; FullName?: string; Id?: string }> };

      const tokens: TokenRecord[] = Object.values(data.Data ?? {}).map((entry) => {
        const symbol = this.normalizeSymbol(entry.Symbol);
        const name = entry.CoinName ?? entry.FullName ?? null;
        const tokenKey = this.buildTokenKey(symbol ?? undefined);
        return {
          tokenKey,
          symbol,
          name,
          chain: null,
          contractAddress: null,
          sources: ['cryptocompare'],
          metadata: { cryptocompareId: entry.Id },
        };
      });

      return { source: 'cryptocompare', tokens: tokens.filter((token) => token.tokenKey) };
    } catch (err) {
      this.logger.warn({ err }, 'CryptoCompare token list failed');
      return null;
    }
  }

  private async fetchDexScreener() {
    const baseUrl = process.env.DEXSCREENER_BASE_URL ?? 'https://api.dexscreener.io';
    const url = `${baseUrl}/token-profiles/latest/v1`;
    try {
      const data = (await this.fetchJson(url)) as Array<{
        chainId: string;
        tokenAddress: string;
        tokenSymbol?: string;
        tokenName?: string;
      }>;
      const tokens: TokenRecord[] = data.map((entry) => {
        const symbol = this.normalizeSymbol(entry.tokenSymbol);
        const name = entry.tokenName ?? null;
        const tokenKey = this.buildTokenKey(symbol ?? undefined, entry.chainId, entry.tokenAddress);
        return {
          tokenKey,
          symbol,
          name,
          chain: this.normalizeChain(entry.chainId),
          contractAddress: this.normalizeAddress(entry.tokenAddress),
          sources: ['dexscreener'],
          metadata: {},
        };
      });
      return { source: 'dexscreener', tokens: tokens.filter((token) => token.tokenKey) };
    } catch (err) {
      this.logger.warn({ err }, 'DexScreener token list failed');
      return null;
    }
  }

  private async fetchDexTools() {
    const url = process.env.DEXTOOLS_TOKEN_LIST_URL ?? '';
    if (!url) return null;
    const apiKey = process.env.DEXTOOLS_API_KEY ?? '';
    return this.fetchCustomTokenList('dextools', url, apiKey);
  }

  private async fetchCodex() {
    const url = process.env.CODEX_TOKEN_LIST_URL ?? '';
    if (!url) return null;
    const apiKey = process.env.CODEX_API_KEY ?? '';
    return this.fetchCustomTokenList('codex', url, apiKey);
  }

  private async fetchCustomTokenList(source: string, url: string, apiKey?: string) {
    try {
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
        headers.Authorization = `Bearer ${apiKey}`;
      }
      const payload = await this.fetchJson(url, { headers });
      const items =
        Array.isArray(payload) ? payload : Array.isArray((payload as any)?.data) ? (payload as any).data : (payload as any)?.tokens ?? [];

      const tokens: TokenRecord[] = items.map((item: any) => {
        const symbol = this.normalizeSymbol(item.symbol ?? item.ticker ?? item.tokenSymbol);
        const name = item.name ?? item.tokenName ?? null;
        const chain = item.chain ?? item.chainId ?? item.network ?? null;
        const address = item.contractAddress ?? item.address ?? item.tokenAddress ?? null;
        const tokenKey = this.buildTokenKey(symbol ?? undefined, chain ?? undefined, address ?? undefined);
        return {
          tokenKey,
          symbol,
          name,
          chain: this.normalizeChain(chain ?? undefined),
          contractAddress: this.normalizeAddress(address ?? undefined),
          sources: [source],
          metadata: {},
        };
      });

      return { source, tokens: tokens.filter((token) => token.tokenKey) };
    } catch (err) {
      this.logger.warn({ err }, `${source} token list failed`);
      return null;
    }
  }
}
