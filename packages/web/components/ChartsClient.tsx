'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

const intervals = ['1s', '5s', '1m', '5m'] as const;

export function ChartsClient() {
  const [markets, setMarkets] = useState<any[]>([]);
  const [marketId, setMarketId] = useState('');
  const [interval, setInterval] = useState<(typeof intervals)[number]>('1s');
  const [candles, setCandles] = useState<any[]>([]);

  useEffect(() => {
    const loadMarkets = async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/markets`);
        const data = res.ok ? await res.json() : { markets: [] };
        setMarkets(data.markets ?? []);
        if (data.markets?.[0]?.marketId) {
          setMarketId(data.markets[0].marketId);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadMarkets();
  }, []);

  useEffect(() => {
    if (!marketId) return;
    let timer: NodeJS.Timeout;
    const loadCandles = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/v1/ohlcv?marketId=${encodeURIComponent(marketId)}&interval=${interval}&limit=120`,
          { cache: 'no-store' }
        );
        const data = res.ok ? await res.json() : [];
        setCandles(data ?? []);
      } catch (err) {
        console.error(err);
      }
    };
    loadCandles();
    const refreshMs = interval === '1s' ? 2000 : interval === '5s' ? 4000 : 8000;
    timer = setInterval(loadCandles, refreshMs);
    return () => clearInterval(timer);
  }, [marketId, interval]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
          value={marketId}
          onChange={(event) => setMarketId(event.target.value)}
        >
          {markets.map((market) => (
            <option key={market.marketId} value={market.marketId}>
              {market.marketId}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          {intervals.map((value) => (
            <button
              key={value}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                interval === value ? 'bg-emerald-500 text-slate-900' : 'bg-slate-800 text-slate-200'
              }`}
              onClick={() => setInterval(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 text-sm">
        {candles.slice(0, 12).map((candle) => (
          <div key={candle.startTs} className="border border-slate-800 rounded-lg p-3">
            <p className="font-semibold">{new Date(candle.startTs).toLocaleTimeString()}</p>
            <p className="text-slate-400">
              O: {candle.open} H: {candle.high} L: {candle.low} C: {candle.close}
            </p>
          </div>
        ))}
        {!candles.length && <p className="text-sm text-slate-500">No candles yet for this market.</p>}
      </div>
    </div>
  );
}
