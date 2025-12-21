'use client';

import { useEffect, useMemo, useState } from 'react';
import { resolveToken } from '../../lib/api';

type TokenResult = { tokenId: string; symbol: string; name?: string; chain?: string; contractAddress?: string; logo?: string; confidence?: number };

export function TokenSearch({ apiBaseUrl, onSelect }: { apiBaseUrl: string; onSelect: (tokenId: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TokenResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const data = await resolveToken(apiBaseUrl, query, controller.signal);
      if (!controller.signal.aborted) {
        setResults(data?.items?.slice(0, 10) ?? []);
        setLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [apiBaseUrl, query]);

  const isContractLike = useMemo(() => /^0x[a-fA-F0-9]{40}$/.test(query.trim()) || /^[1-9A-HJ-NP-Za-km-z]{26,64}$/.test(query.trim()), [query]);

  const handleSelect = (tokenId: string) => {
    setQuery('');
    setResults([]);
    onSelect(tokenId);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query) return;
    setLoading(true);
    setError(null);
    const data = await resolveToken(apiBaseUrl, query);
    setLoading(false);
    if (data?.items?.length) {
      handleSelect(data.items[0].tokenId);
    } else {
      setError('No results found');
    }
  };

  return (
    <div className="relative space-y-2">
      <form onSubmit={handleSubmit}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ticker or contract address…"
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </form>
      {loading && <p className="text-xs text-slate-400">Searching…</p>}
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg shadow-xl max-h-72 overflow-y-auto">
          {results.map((item) => (
            <button
              key={item.tokenId}
              className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center gap-3"
              onClick={() => handleSelect(item.tokenId)}
              type="button"
            >
              {item.logo ? <img src={item.logo} alt={item.symbol} className="h-6 w-6 rounded-full" /> : <div className="h-6 w-6 rounded-full bg-slate-700" />}
              <div className="flex flex-col text-sm">
                <span className="font-semibold text-slate-100">
                  {item.symbol} <span className="text-slate-400">{item.name}</span>
                </span>
                <span className="text-xs text-slate-500">
                  {item.chain ?? 'unknown'} {item.contractAddress ? `• ${shorten(item.contractAddress)}` : ''}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      {!results.length && isContractLike && !loading && query && <p className="text-xs text-slate-400">Press Enter to resolve this contract.</p>}
    </div>
  );
}

function shorten(addr?: string) {
  if (!addr) return '';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
