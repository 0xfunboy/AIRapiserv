'use client';

import { useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

export function CompareClient() {
  const [markets, setMarkets] = useState<any[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [symbol, setSymbol] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [marketsRes, tokensRes] = await Promise.all([
          fetch(`${API_BASE}/v1/markets`),
          fetch(`${API_BASE}/v1/tokens?limit=200`),
        ]);
        const marketsData = marketsRes.ok ? await marketsRes.json() : { markets: [] };
        const tokensData = tokensRes.ok ? await tokensRes.json() : [];
        setMarkets(marketsData.markets ?? []);
        setTokens(tokensData ?? []);

        const firstSymbol = marketsData.markets?.[0]?.symbol ?? tokensData?.[0]?.symbol ?? '';
        setSymbol(firstSymbol);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, []);

  const symbols = useMemo(() => {
    const fromMarkets = markets.map((market) => market.symbol).filter(Boolean);
    const fromTokens = tokens.map((token) => token.symbol).filter(Boolean);
    const all = Array.from(new Set([...fromMarkets, ...fromTokens]));
    if (!query) return all.slice(0, 500);
    return all.filter((s) => s?.toUpperCase().includes(query.toUpperCase()));
  }, [markets, tokens, query]);

  const rows = useMemo(() => {
    return markets.filter((market) => market.symbol === symbol);
  }, [markets, symbol]);

  const base = rows[0]?.last ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter token..."
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
        />
        <select
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
          value={symbol}
          onChange={(event) => setSymbol(event.target.value)}
        >
          {symbols.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-400">
          Showing live venue prices for {symbol || 'n/a'} (select any token from catalog).
        </p>
      </div>

      <table className="w-full border border-slate-800 rounded-xl overflow-hidden text-sm">
        <thead className="bg-slate-900 text-left">
          <tr>
            <th className="px-4 py-2">Venue</th>
            <th className="px-4 py-2">Market</th>
            <th className="px-4 py-2">Last Price</th>
            <th className="px-4 py-2">Delta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((market) => {
            const delta = base ? (market.last ?? 0) - base : 0;
            const pct = base ? (delta / base) * 100 : 0;
            return (
              <tr key={market.marketId} className="border-t border-slate-800">
                <td className="px-4 py-2 font-semibold">{market.venue?.toUpperCase() ?? market.marketId}</td>
                <td className="px-4 py-2 text-slate-400">{market.marketId}</td>
                <td className="px-4 py-2">{market.last ?? 'n/a'}</td>
                <td className={`px-4 py-2 ${pct > 0 ? 'text-emerald-400' : pct < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                  {base ? `${pct.toFixed(3)}%` : 'n/a'}
                </td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                No live venues for {symbol || 'this token'} yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
