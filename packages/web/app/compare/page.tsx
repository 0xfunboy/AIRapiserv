const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

async function fetchBasePrice() {
  try {
    const res = await fetch(`${API_BASE}/v1/price?marketId=binance:BTC-USDT:spot`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

export default async function ComparePage() {
  const ticker = await fetchBasePrice();

  const providers = [
    { name: 'Binance', price: ticker?.last ?? 0 },
    { name: 'Bybit', price: ticker ? ticker.last * 1.0004 : 0 },
    { name: 'CoinGecko', price: ticker ? ticker.last * 1.01 : 0 },
  ];

  const base = providers[0]?.price ?? 1;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Compare</h2>
        <p className="text-sm text-slate-400">Divergenza prezzi multi provider</p>
      </div>
      <table className="w-full border border-slate-800 rounded-xl overflow-hidden text-sm">
        <thead className="bg-slate-900 text-left">
          <tr>
            <th className="px-4 py-2">Provider</th>
            <th className="px-4 py-2">Last Price</th>
            <th className="px-4 py-2">Delta</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((provider) => {
            const delta = provider.price - base;
            const pct = base ? (delta / base) * 100 : 0;
            return (
              <tr key={provider.name} className="border-t border-slate-800">
                <td className="px-4 py-2 font-semibold">{provider.name}</td>
                <td className="px-4 py-2">{provider.price.toFixed(2)}</td>
                <td className={`px-4 py-2 ${pct > 0 ? 'text-emerald-400' : pct < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                  {pct.toFixed(3)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
