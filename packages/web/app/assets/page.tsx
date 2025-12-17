import { AssetSearch } from '../../components/AssetSearch';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

async function fetchMarkets() {
  try {
    const res = await fetch(`${API_BASE}/v1/markets`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.markets ?? [];
  } catch (err) {
    console.error(err);
    return [];
  }
}

export default async function AssetsPage() {
  const markets = await fetchMarkets();
  const symbols = Array.from(new Set(markets.map((market: any) => market.symbol))).slice(0, 30);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Assets</h2>
        <p className="text-sm text-slate-400">Search, resolve, and verify incoming assets</p>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold">Live symbols (from ingestion)</h3>
        <p className="text-sm text-slate-400">Symbols observed on live market streams.</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {symbols.map((symbol) => (
            <span key={symbol} className="px-3 py-1 rounded-full bg-slate-800 text-slate-200">
              {symbol}
            </span>
          ))}
          {!symbols.length && <span className="text-slate-500">No symbols yet.</span>}
        </div>
      </div>

      <AssetSearch />
    </section>
  );
}
