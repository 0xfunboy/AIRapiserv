'use client';

import { useEffect, useMemo, useState } from 'react';
import { TokenSearch } from '../../components/tokenTerminal/TokenSearch';
import { TokenHeader } from '../../components/tokenTerminal/TokenHeader';
import { TokenPriceCard } from '../../components/tokenTerminal/TokenPriceCard';
import { TokenStatsGrid } from '../../components/tokenTerminal/TokenStatsGrid';
import { TokenRealtimeChart } from '../../components/tokenTerminal/TokenRealtimeChart';
import { TokenMarketsTable } from '../../components/tokenTerminal/TokenMarketsTable';
import {
  getMarketPrice,
  getTokenOhlcvByToken,
  getTokenVenues,
  pickBestMarketIdFromVenues,
  searchTokens,
} from '../../lib/api';

export default function TokenTerminalPage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3333';
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<any | null>(null);
  const [venues, setVenues] = useState<any[] | null>(null);
  const [bestMarketId, setBestMarketId] = useState<string | null>(null);
  const [price, setPrice] = useState<any | null>(null);
  const [seriesPoints, setSeriesPoints] = useState<Array<{ ts: number; price: number }>>([]);
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTokenId) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      const v = await getTokenVenues(apiBaseUrl, selectedTokenId, controller.signal);
      if (!controller.signal.aborted) {
        setVenues(Array.isArray(v) ? v : []);
        setBestMarketId(pickBestMarketIdFromVenues(Array.isArray(v) ? v : []));
        setStats((prev: any) => ({ ...prev, marketsCount: Array.isArray(v) ? v.length : 0 }));
        setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [apiBaseUrl, selectedTokenId]);

  useEffect(() => {
    if (!selectedTokenId || !bestMarketId) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = async () => {
      const p = await getMarketPrice(apiBaseUrl, bestMarketId);
      if (p) {
        setPrice(p);
        if (p.ts) {
          setStats((prev: any) => ({ ...prev, freshnessSeconds: Math.floor((Date.now() - p.ts) / 1000) }));
        }
        if (p.volume24h) {
          setStats((prev: any) => ({ ...prev, volume24h: p.volume24h }));
        }
      }
    };
    tick();
    timer = setInterval(tick, 2000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [apiBaseUrl, selectedTokenId, bestMarketId]);

  useEffect(() => {
    if (!selectedTokenId) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = async () => {
      const res = await getTokenOhlcvByToken(apiBaseUrl, selectedTokenId, '1m', 1800);
      const candles = res?.candles ?? [];
      const pts = candles
        .map((c: any) => ({
          ts: (c.time ?? c.ts ?? 0) * (c.time && c.time < 10_000_000_000 ? 1000 : 1),
          price: c.close ?? c.last ?? c.price ?? null,
          high: c.high,
          low: c.low,
          volume: c.volume,
        }))
        .filter((p: any) => p.price !== null && p.ts);
      const cutoff = Date.now() - 30 * 60 * 1000;
      setSeriesPoints(pts.filter((p: any) => p.ts >= cutoff));
      if (candles.length) {
        setStats((prev: any) => ({
          ...prev,
          high24h: Math.max(...candles.map((c: any) => c.high ?? 0)),
          low24h: Math.min(...candles.map((c: any) => c.low ?? 0)),
          volume24h: candles.reduce((acc: number, c: any) => acc + (c.volume ?? 0), 0),
        }));
      }
    };
    tick();
    timer = setInterval(tick, 10_000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [apiBaseUrl, selectedTokenId]);

  useEffect(() => {
    if (selectedTokenId) return;
    const controller = new AbortController();
    const bootstrap = async () => {
      const res = await searchTokens(apiBaseUrl, 'BTC', 10, controller.signal);
      const items = (res?.items ?? []).filter((i) => i.symbol?.toUpperCase() === 'BTC');
      const pick = items[0] ?? res?.items?.[0];
      if (pick) {
        setSelectedTokenId(pick.tokenId);
        setTokenInfo(pick);
      }
    };
    bootstrap();
    return () => controller.abort();
  }, [apiBaseUrl, selectedTokenId]);

  const displayMarkets = useMemo(() => mapVenuesToRows(venues ?? []), [venues]);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Token Terminal</h2>
          <p className="text-sm text-slate-400">Token-centric view: price, realtime preview, coverage.</p>
        </div>
        <div className="text-xs text-slate-500">API: {apiBaseUrl}</div>
      </div>

      <TokenSearch
        apiBaseUrl={apiBaseUrl}
        onSelect={(tokenId, token) => {
          setSelectedTokenId(tokenId);
          if (token) setTokenInfo(token);
          setPrice(null);
          setSeriesPoints([]);
          setStats(null);
        }}
      />

      {loading && <p className="text-sm text-slate-400">Loading token data…</p>}
      {error && <p className="text-sm text-rose-400">{error}</p>}

      {tokenInfo && (
        <div className="space-y-4">
          <TokenHeader token={tokenInfo} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-4 lg:col-span-2">
              <TokenPriceCard price={price} stats={stats ?? { marketsCount: displayMarkets.length }} />
              <TokenStatsGrid stats={{ ...(stats ?? {}), marketsCount: displayMarkets.length }} />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm text-slate-400">Realtime preview</div>
                  <div className="text-lg font-semibold">Last 30 minutes</div>
                </div>
              </div>
              <TokenRealtimeChart points={seriesPoints} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Market coverage</h3>
              <div className="text-xs text-slate-500">Count: {displayMarkets?.length ?? 0}</div>
            </div>
            <TokenMarketsTable markets={displayMarkets} />
          </div>
        </div>
      )}
    </section>
  );
}

function mapVenuesToRows(venues: any[]) {
  return (venues ?? []).map((v) => ({
    marketId: v.marketId ?? v.id ?? '',
    venue: v.venue ?? v.provider ?? v.source ?? 'unknown',
    pair: v.pair ?? v.symbol ?? `${v.baseSymbol ?? ''}/${v.quote ?? ''}`,
    quote: v.quote ?? v.quoteSymbol ?? '',
    last: v.last ?? v.price ?? null,
    volume24h: v.volume24h ?? v.volume ?? null,
    liquidityScore: v.liquidityScore ?? null,
    freshnessSeconds: v.freshnessSeconds ?? null,
    ws: v.ws ?? v.wsSupported ?? false,
  }));
}
