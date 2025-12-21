'use client';

import { useEffect, useMemo, useState } from 'react';
import { searchTokens, TokenSearchItem } from '../../lib/api';

type TokenResult = TokenSearchItem;

export function TokenSearch({ apiBaseUrl, onSelect }: { apiBaseUrl: string; onSelect: (tokenId: string, token?: TokenResult) => void }) {
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
      const data = await searchTokens(apiBaseUrl, query, 50, controller.signal);
      if (!controller.signal.aborted) {
        const items = normalizeItems(data);
        setResults(filterAndSort(items, query, chainFilter, venueType));
        setLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [apiBaseUrl, query]);

  const isContractLike = useMemo(() => /^0x[a-fA-F0-9]{40}$/.test(query.trim()) || /^[1-9A-HJ-NP-Za-km-z]{26,64}$/.test(query.trim()), [query]);
  const [chainFilter, setChainFilter] = useState('all');
  const [venueType, setVenueType] = useState<'all' | 'cex' | 'dex'>('all');

  const handleSelect = (tokenId: string, token?: TokenResult) => {
    setQuery('');
    setResults([]);
    onSelect(tokenId, token);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query) return;
    setLoading(true);
    setError(null);
    const data = await searchTokens(apiBaseUrl, query, 50);
    setLoading(false);
    const items = filterAndSort(normalizeItems(data), query, chainFilter, venueType);
    if (items.length) {
      handleSelect(items[0].tokenId, items[0]);
    } else {
      setError('No results found');
    }
  };

  return (
    <div className="relative space-y-2">
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ticker or contract address…"
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="flex gap-2 text-xs">
          <select
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1"
            value={chainFilter}
            onChange={(e) => {
              const val = e.target.value;
              setChainFilter(val);
              setResults(filterAndSort(results, query, val, venueType));
            }}
          >
            <option value="all">All chains</option>
            <option value="eth">ETH</option>
            <option value="sol">SOL</option>
            <option value="bsc">BSC</option>
            <option value="polygon">Polygon</option>
            <option value="arbitrum">Arbitrum</option>
            <option value="optimism">Optimism</option>
          </select>
          <select
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1"
            value={venueType}
            onChange={(e) => {
              const val = e.target.value as 'all' | 'cex' | 'dex';
              setVenueType(val);
              setResults(filterAndSort(results, query, chainFilter, val));
            }}
          >
            <option value="all">All venues</option>
            <option value="cex">CEX</option>
            <option value="dex">DEX</option>
          </select>
        </div>
      </form>
      {loading && <p className="text-xs text-slate-400">Searching…</p>}
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg shadow-xl max-h-72 overflow-y-auto">
          {results.map((item) => (
            <button
              key={item.tokenId}
              className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center gap-3"
              onClick={() => handleSelect(item.tokenId, item)}
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

function normalizeItems(data: any): TokenResult[] {
  if (!data) return [];
  const items = Array.isArray(data) ? data : data.items;
  if (!Array.isArray(items)) return [];
  return items.filter((i) => i?.tokenId && i?.symbol);
}

function filterAndSort(items: TokenResult[], query: string, chainFilter: string, venueType: 'all' | 'cex' | 'dex') {
  const q = query.trim().toLowerCase();
  let filtered = items;
  if (chainFilter !== 'all') {
    filtered = filtered.filter((i) => (i.chain ?? '').toLowerCase().includes(chainFilter));
  }
  if (venueType !== 'all') {
    filtered = filtered.filter((i) => {
      const src = (i.source ?? '').toLowerCase();
      if (!src) return true;
      const isDex = src.includes('dex');
      return venueType === 'dex' ? isDex : !isDex;
    });
  }
  return filtered.sort((a, b) => {
    const confA = a.confidence ?? 0;
    const confB = b.confidence ?? 0;
    if (confA !== confB) return confB - confA;
    const exactA = a.symbol?.toLowerCase() === q ? 1 : 0;
    const exactB = b.symbol?.toLowerCase() === q ? 1 : 0;
    if (exactA !== exactB) return exactB - exactA;
    const nameA = a.name?.toLowerCase().includes(q) ? 1 : 0;
    const nameB = b.name?.toLowerCase().includes(q) ? 1 : 0;
    return nameB - nameA;
  });
}
