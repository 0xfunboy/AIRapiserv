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

export default async function ComparePage() {
  const markets = await fetchMarkets();
  const grouped = new Map<string, any[]>();
  for (const market of markets) {
    if (!grouped.has(market.symbol)) grouped.set(market.symbol, []);
    grouped.get(market.symbol)?.push(market);
  }
  const selectedGroup = Array.from(grouped.values()).find((list) => list.length >= 2) ?? [];

  const prices = await Promise.all(
    selectedGroup.slice(0, 3).map(async (market) => {
      try {
        const res = await fetch(`${API_BASE}/v1/price?marketId=${encodeURIComponent(market.marketId)}`, { cache: 'no-store' });
        const data = res.ok ? await res.json() : null;
        return {
          name: market.venue?.toUpperCase() ?? market.marketId,
          marketId: market.marketId,
          price: data?.last ?? null,
        };
      } catch (err) {
        console.error(err);
        return { name: market.marketId, marketId: market.marketId, price: null };
      }
    })
  );

  const base = prices[0]?.price ?? 1;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Compare</h2>
        <p className="text-sm text-slate-400">Price divergence across venues</p>
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
          {prices.map((provider) => {
            const delta = (provider.price ?? 0) - base;
            const pct = base ? (delta / base) * 100 : 0;
            return (
              <tr key={provider.marketId} className="border-t border-slate-800">
                <td className="px-4 py-2 font-semibold">{provider.name}</td>
                <td className="px-4 py-2 text-slate-400">{provider.marketId}</td>
                <td className="px-4 py-2">{provider.price ?? 'n/a'}</td>
                <td className={`px-4 py-2 ${pct > 0 ? 'text-emerald-400' : pct < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                  {provider.price ? `${pct.toFixed(3)}%` : 'n/a'}
                </td>
              </tr>
            );
          })}
          {!prices.length && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                No active markets to compare yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
