const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

async function fetchAssets() {
  try {
    const res = await fetch(`${API_BASE}/v1/search?q=btc`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}

export default async function AssetsPage() {
  const assets = await fetchAssets();

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Assets</h2>
        <p className="text-sm text-slate-400">Search e mapping multi-chain</p>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <p className="text-sm text-slate-400">La UI completa includerà ricerca dinamica, filtri chain e override manuali. Per ora vengono mostrati alcuni asset seed dal resolver.</p>
        <ul className="space-y-3 text-sm">
          {assets.map((asset: any) => (
            <li key={asset.assetId} className="border border-slate-800 rounded-lg p-3">
              <p className="font-semibold">{asset.name} ({asset.symbol})</p>
              <p className="text-slate-400">Aliases: {(asset.aliases ?? []).join(', ') || 'n/a'}</p>
              <p className="text-slate-400">Chains: {Object.keys(asset.contractAddresses ?? {}).join(', ') || 'n/a'}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
