'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

export function AssetSearch() {
  const [query, setQuery] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [assets, setAssets] = useState<any[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [resolution, setResolution] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query && !contractAddress) return;
    setLoading(true);
    try {
      if (query) {
        const res = await fetch(`${API_BASE}/v1/search?q=${encodeURIComponent(query)}`);
        const data = res.ok ? await res.json() : [];
        setAssets(data);
      } else {
        setAssets([]);
      }

      if (query || contractAddress) {
        const resolveUrl = new URL(`${API_BASE}/v1/resolve`);
        if (query) resolveUrl.searchParams.set('symbol', query);
        if (contractAddress) resolveUrl.searchParams.set('contractAddress', contractAddress);
        const res = await fetch(resolveUrl.toString());
        setResolution(res.ok ? await res.json() : null);
      }

      if (query || contractAddress) {
        const tokenQuery = contractAddress || query;
        const res = await fetch(`${API_BASE}/v1/tokens?q=${encodeURIComponent(tokenQuery)}`);
        const data = res.ok ? await res.json() : [];
        setTokens(data);
      } else {
        setTokens([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <h3 className="text-lg font-semibold">Search by ticker or contract address</h3>
        <p className="text-xs text-slate-400">Use the resolver to validate the mapping stored in AIRapiserv.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            placeholder="Ticker (e.g. BTC)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <input
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            placeholder="Contract address (optional)"
            value={contractAddress}
            onChange={(event) => setContractAddress(event.target.value)}
          />
          <button
            className="bg-emerald-500 text-slate-900 font-semibold rounded-lg px-4 py-2 text-sm hover:bg-emerald-400"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-slate-300">Resolver match</h4>
          {resolution ? (
            <div className="mt-3 text-sm space-y-1">
              <p className="font-semibold">
                {resolution.asset?.name} ({resolution.asset?.symbol})
              </p>
              <p className="text-slate-400">Asset ID: {resolution.asset?.assetId}</p>
              <p className="text-slate-400">Matched by: {resolution.matchedBy}</p>
              <p className="text-slate-400">Confidence: {resolution.confidence}</p>
              {resolution.market && <p className="text-slate-400">Market: {resolution.market.marketId}</p>}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">No resolver match yet.</p>
          )}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-slate-300">Search results</h4>
          <div className="mt-3 space-y-2 text-sm">
            {assets.map((asset) => (
              <div key={asset.assetId} className="border border-slate-800 rounded-lg p-3">
                <p className="font-semibold">
                  {asset.name} ({asset.symbol})
                </p>
                <p className="text-xs text-slate-400">Aliases: {(asset.aliases ?? []).join(', ') || 'n/a'}</p>
                <p className="text-xs text-slate-400">Chains: {Object.keys(asset.contractAddresses ?? {}).join(', ') || 'n/a'}</p>
              </div>
            ))}
            {!assets.length && <p className="text-xs text-slate-500">No search results yet.</p>}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-slate-300">Token catalog matches</h4>
          <div className="mt-3 space-y-2 text-sm">
            {tokens.map((token) => (
              <div key={token.tokenKey} className="border border-slate-800 rounded-lg p-3">
                <p className="font-semibold">
                  {token.name ?? 'Unknown'} ({token.symbol ?? 'n/a'})
                </p>
                <p className="text-xs text-slate-400">Chain: {token.chain ?? 'n/a'}</p>
                <p className="text-xs text-slate-400">CA: {token.contractAddress ?? 'n/a'}</p>
                <p className="text-xs text-slate-500">Sources: {(token.sources ?? []).join(', ') || 'n/a'}</p>
              </div>
            ))}
            {!tokens.length && <p className="text-xs text-slate-500">No token catalog matches.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
