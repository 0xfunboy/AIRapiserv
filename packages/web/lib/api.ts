const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3333';

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(path, { signal, cache: 'no-store' });
    if (res.status === 404 || res.status === 501) return null;
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function resolveToken(apiBaseUrl: string | undefined, q: string, signal?: AbortSignal) {
  const base = apiBaseUrl || DEFAULT_API_BASE;
  return fetchJson<{ items: Array<{ tokenId: string; symbol: string; name?: string; chain?: string; contractAddress?: string; logo?: string; confidence?: number }> }>(
    `${base}/v1/token/resolve?q=${encodeURIComponent(q)}`,
    signal
  );
}

export async function getTokenSummary(apiBaseUrl: string | undefined, tokenId: string, signal?: AbortSignal) {
  const base = apiBaseUrl || DEFAULT_API_BASE;
  return fetchJson<{
    token: { tokenId: string; symbol: string; name?: string; chain?: string; contractAddress?: string; decimals?: number; logo?: string };
    price?: { value: number; ts: number; currency: string; sources?: Array<{ marketId: string; venue: string; price: number; ts: number }> };
    stats?: {
      change1m?: number;
      change5m?: number;
      change1h?: number;
      change24h?: number;
      high24h?: number;
      low24h?: number;
      volume24h?: number;
      volatility1h?: number;
      marketsCount?: number;
      freshnessSeconds?: number;
    };
    markets?: Array<{
      marketId: string;
      venue: string;
      pair: string;
      quote: string;
      last?: number;
      volume24h?: number;
      liquidityScore?: number;
      freshnessSeconds?: number;
      ws?: boolean;
    }>;
  }>(`${base}/v1/token/summary?tokenId=${encodeURIComponent(tokenId)}`, signal);
}

export async function getTokenSeries(apiBaseUrl: string | undefined, tokenId: string, signal?: AbortSignal) {
  const base = apiBaseUrl || DEFAULT_API_BASE;
  return fetchJson<{ points: Array<{ ts: number; price: number }> }>(
    `${base}/v1/token/series?tokenId=${encodeURIComponent(tokenId)}&window=30m&step=5s`,
    signal
  );
}

export async function getTokenMarkets(apiBaseUrl: string | undefined, tokenId: string, signal?: AbortSignal) {
  const base = apiBaseUrl || DEFAULT_API_BASE;
  return fetchJson<{ markets: Array<{ marketId: string; venue: string; pair: string; quote: string; last?: number; volume24h?: number; liquidityScore?: number; freshnessSeconds?: number; ws?: boolean }> }>(
    `${base}/v1/token/markets?tokenId=${encodeURIComponent(tokenId)}`,
    signal
  );
}

export type TokenSearchItem = {
  tokenId: string;
  symbol: string;
  name?: string;
  chain?: string;
  contractAddress?: string;
  logo?: string;
  confidence?: number;
  source?: string;
};

export async function searchTokens(apiBaseUrl: string, q: string, limit = 50, signal?: AbortSignal) {
  const res = await fetchJson<{ items?: TokenSearchItem[] } | TokenSearchItem[]>(`${apiBaseUrl}/api/tokens/search?q=${encodeURIComponent(q)}&limit=${limit}`, signal);
  if (!res) return { items: [] as TokenSearchItem[] };
  if (Array.isArray(res)) return { items: res };
  return { items: res.items ?? [] };
}

export async function getTokenVenues(apiBaseUrl: string, tokenId: string, signal?: AbortSignal) {
  return fetchJson<any[]>(`${apiBaseUrl}/api/tokens/${encodeURIComponent(tokenId)}/venues`, signal);
}

export async function getTokenOhlcvByToken(apiBaseUrl: string, tokenId: string, timeframe: string, limit = 600, signal?: AbortSignal) {
  const res = await fetchJson<{ candles?: any[] }>(
    `${apiBaseUrl}/api/tokens/${encodeURIComponent(tokenId)}/ohlcv?timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`,
    signal
  );
  return res ?? null;
}

export function pickBestMarketIdFromVenues(venues: any[]): string | null {
  if (!Array.isArray(venues)) return null;
  const prefQuotes = ['USDT', 'USDC', 'USD'];
  const scored = venues
    .filter((v) => v?.marketId)
    .map((v) => {
      const quote = (v.quote ?? v.pair?.split('/')?.[1] ?? '').toUpperCase();
      const isPreferredQuote = prefQuotes.includes(quote);
      const liq = v.liquidityScore ?? 0;
      const vol = v.volume24h ?? 0;
      const isSpot = (v.marketType ?? '').toLowerCase() !== 'perp';
      return { v, score: (isPreferredQuote ? 10 : 0) + (isSpot ? 5 : 0) + liq + vol / 1e6 };
    });
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  return scored[0].v.marketId ?? null;
}

export async function getMarketPrice(apiBaseUrl: string, marketId: string, signal?: AbortSignal) {
  return fetchJson<any>(`${apiBaseUrl}/v1/price?marketId=${encodeURIComponent(marketId)}`, signal);
}
