'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

type TokenRow = {
  tokenId?: string;
  tokenKey?: string;
  symbol?: string;
  name?: string;
  prioritySource?: string | null;
  discoveryConfidence?: number;
};

export function TokenSearchClient() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tokens/search?q=${encodeURIComponent(query)}&limit=50`);
      const data = await res.json();
      setRows(data ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    search('%');
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by ticker, name, or contract..."
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <button
          onClick={() => search(q || '%')}
          className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-emerald-400"
        >
          Search
        </button>
      </div>
      <div className="overflow-auto rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="px-3 py-2">Symbol</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = row.tokenKey ?? row.tokenId ?? row.symbol ?? Math.random().toString();
              return (
                <tr key={key} className="border-t border-slate-800 hover:bg-slate-800/60">
                  <td className="px-3 py-2 font-semibold">
                    <Link href={`/tokens/${encodeURIComponent(row.tokenId ?? row.tokenKey ?? '')}`} className="text-emerald-400 hover:underline">
                      {row.symbol ?? 'n/a'}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.name ?? 'Unknown'}</td>
                  <td className="px-3 py-2 text-slate-400">{row.prioritySource ?? 'auto'}</td>
                  <td className="px-3 py-2 text-slate-400">{row.discoveryConfidence ?? 0}%</td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                  {loading ? 'Loading...' : 'No results'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
