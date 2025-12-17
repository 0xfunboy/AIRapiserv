export default function AdminPage() {
  const overrides = [{ symbol: 'PEPE', assetId: 'pepe-eth', provider: 'dexscreener', note: 'manual CA override' }];

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Admin & Overrides</h2>
        <p className="text-sm text-slate-400">Manage mappings, watchlists, and fallback policy</p>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 text-sm">
        <p>
          The full WebGUI will manage CA/symbol overrides, provider pinning, and retention settings. This section shows the expected data
          shape.
        </p>
        <ul className="space-y-2">
          {overrides.map((item) => (
            <li key={item.symbol} className="flex flex-col border border-slate-800 rounded-lg p-3">
              <span className="font-semibold">{item.symbol}</span>
              <span className="text-slate-400">assetId: {item.assetId}</span>
              <span className="text-slate-400">provider: {item.provider}</span>
              <span className="text-slate-500">note: {item.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
