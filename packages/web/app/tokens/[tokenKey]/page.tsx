import Link from 'next/link';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

async function fetchToken(tokenKey: string) {
  try {
    const res = await fetch(`${API_BASE}/v1/tokens/${encodeURIComponent(tokenKey)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="px-2 py-1 rounded-md bg-slate-800 text-xs text-slate-200">{children}</span>;
}

export default async function TokenDetailPage({ params }: { params: { tokenKey: string } }) {
  const token = await fetchToken(params.tokenKey);

  if (!token) {
    return (
      <section className="space-y-4">
        <p className="text-slate-400">Token not found.</p>
        <Link href="/tokens" className="text-emerald-400 hover:underline">
          Back to tokens
        </Link>
      </section>
    );
  }

  const chains = new Set<string>();
  (token.contracts ?? []).forEach((c: any) => chains.add(c.chain));

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">
            {token.symbol ?? 'n/a'} <span className="text-slate-400">({token.name ?? 'Unknown'})</span>
          </h2>
          <p className="text-sm text-slate-400">Asset ID: {token.assetId}</p>
        </div>
        <Link href="/tokens" className="text-xs bg-slate-800 px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-700">
          Back to catalog
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <p className="text-sm text-slate-400">Aliases</p>
          <div className="flex flex-wrap gap-2 text-xs">
            {(token.aliases ?? []).map((alias: any) => (
              <Badge key={`${alias.alias}-${alias.kind}`}>{alias.alias}</Badge>
            ))}
            {!(token.aliases ?? []).length && <span className="text-slate-500 text-xs">No aliases yet.</span>}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <p className="text-sm text-slate-400">Chains</p>
          <div className="flex flex-wrap gap-2 text-xs">
            {Array.from(chains).map((chain) => (
              <Badge key={chain}>{chain || 'n/a'}</Badge>
            ))}
            {!chains.size && <span className="text-slate-500 text-xs">No chain info yet.</span>}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <p className="text-sm text-slate-400">Provider IDs</p>
          <div className="text-xs text-slate-300 space-y-1">
            <p>CoinGecko: {token.coingeckoId || 'n/a'}</p>
            <p>CoinMarketCap: {token.coinmarketcapId || 'n/a'}</p>
            <p>DefiLlama: {token.defillamaId || 'n/a'}</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Coverage</h3>
            <p className="text-xs text-slate-400">Markets where this asset is tradable.</p>
          </div>
          <div className="text-xs text-slate-400">
            First seen: {token.firstSeenAt ? new Date(token.firstSeenAt).toLocaleString() : 'n/a'}
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2">Market</th>
                <th className="py-2">Source</th>
                <th className="py-2">Capabilities</th>
                <th className="py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {(token.markets ?? []).map((market: any) => (
                <tr key={market.marketId} className="border-t border-slate-800">
                  <td className="py-2 font-semibold">{market.marketId}</td>
                  <td className="py-2 text-slate-400">{market.venue}</td>
                  <td className="py-2 text-slate-400">
                    {market.wsCapable ? 'WS' : 'REST'} · {market.restCapable ? 'REST' : 'n/a'}
                  </td>
                  <td className="py-2 text-slate-400">
                    {market.updatedAt ? new Date(market.updatedAt).toLocaleTimeString() : 'n/a'}
                  </td>
                </tr>
              ))}
              {!(token.markets ?? []).length && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    No markets yet. They appear automatically when ingestion sees new venues.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <h3 className="text-lg font-semibold">Contracts</h3>
          <div className="space-y-2 text-xs">
            {(token.contracts ?? []).map((c: any) => (
              <div key={`${c.chain}-${c.contractAddress}`} className="border border-slate-800 rounded-lg p-3">
                <p className="font-semibold">{c.chain}</p>
                <p className="text-slate-300 break-all">{c.contractAddress}</p>
                <p className="text-slate-500">Source: {c.source ?? 'n/a'}</p>
              </div>
            ))}
            {!(token.contracts ?? []).length && <p className="text-slate-500">No contract addresses yet.</p>}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <h3 className="text-lg font-semibold">Sources</h3>
          <div className="space-y-2 text-xs">
            {(token.sources ?? []).map((s: any) => (
              <div key={s.source} className="border border-slate-800 rounded-lg p-3">
                <p className="font-semibold uppercase">{s.source}</p>
                <p className="text-slate-400">Confidence: {s.confidence ?? 0}</p>
                <p className="text-slate-500">Last seen: {s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString() : 'n/a'}</p>
              </div>
            ))}
            {!(token.sources ?? []).length && <p className="text-slate-500">No source metadata yet.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
