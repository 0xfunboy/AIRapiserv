'use client';

import { useEffect, useMemo, useState } from 'react';
import { TokenSearch } from '../../components/tokenTerminal/TokenSearch';
import { TokenHeader } from '../../components/tokenTerminal/TokenHeader';
import { TokenPriceCard } from '../../components/tokenTerminal/TokenPriceCard';
import { TokenStatsGrid } from '../../components/tokenTerminal/TokenStatsGrid';
import { TokenRealtimeChart } from '../../components/tokenTerminal/TokenRealtimeChart';
import { TokenMarketsTable } from '../../components/tokenTerminal/TokenMarketsTable';
import { getTokenMarkets, getTokenSeries, getTokenSummary } from '../../lib/api';

type Summary = Awaited<ReturnType<typeof getTokenSummary>> | null;
type Series = Awaited<ReturnType<typeof getTokenSeries>> | null;
type Markets = Awaited<ReturnType<typeof getTokenMarkets>> | null;

export default function TokenTerminalPage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3333';
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary>(null);
  const [series, setSeries] = useState<Series>(null);
  const [markets, setMarkets] = useState<Markets>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTokenId) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      const [s, p, m] = await Promise.all([
        getTokenSummary(apiBaseUrl, selectedTokenId, controller.signal),
        getTokenSeries(apiBaseUrl, selectedTokenId, controller.signal),
        getTokenMarkets(apiBaseUrl, selectedTokenId, controller.signal),
      ]);
      if (!controller.signal.aborted) {
        setSummary(s);
        setSeries(p);
        if (m?.markets) {
          setMarkets({ markets: m.markets ?? [] });
        } else if (s?.markets) {
          setMarkets({ markets: s.markets ?? [] });
        } else {
          setMarkets(null);
        }
        setLoading(false);
        if (!s) setError('Token summary not available');
      }
    };
    load();
    return () => controller.abort();
  }, [apiBaseUrl, selectedTokenId]);

  useEffect(() => {
    if (!selectedTokenId) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = async () => {
      const s = await getTokenSummary(apiBaseUrl, selectedTokenId);
      if (s) {
        setSummary((prev) => (prev ? { ...prev, price: s.price ?? prev.price, stats: s.stats ?? prev.stats } : s));
        if (s.markets?.length) setMarkets({ markets: s.markets });
      }
    };
    tick();
    timer = setInterval(tick, 2000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [apiBaseUrl, selectedTokenId]);

  useEffect(() => {
    if (!selectedTokenId) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = async () => {
      const p = await getTokenSeries(apiBaseUrl, selectedTokenId);
      if (p) setSeries(p);
    };
    tick();
    timer = setInterval(tick, 10_000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [apiBaseUrl, selectedTokenId]);

  const displayMarkets = useMemo(() => markets?.markets ?? summary?.markets ?? [], [markets, summary]);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Token Terminal</h2>
          <p className="text-sm text-slate-400">Token-centric view: price, realtime preview, coverage.</p>
        </div>
        <div className="text-xs text-slate-500">API: {apiBaseUrl}</div>
      </div>

      <TokenSearch apiBaseUrl={apiBaseUrl} onSelect={setSelectedTokenId} />

      {loading && <p className="text-sm text-slate-400">Loading token data…</p>}
      {error && <p className="text-sm text-rose-400">{error}</p>}

      {summary?.token && (
        <div className="space-y-4">
          <TokenHeader token={summary.token} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-4 lg:col-span-2">
              <TokenPriceCard price={summary.price} stats={summary.stats} />
              <TokenStatsGrid stats={summary.stats} />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm text-slate-400">Realtime preview</div>
                  <div className="text-lg font-semibold">Last 30 minutes</div>
                </div>
              </div>
              <TokenRealtimeChart points={series?.points ?? []} />
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
