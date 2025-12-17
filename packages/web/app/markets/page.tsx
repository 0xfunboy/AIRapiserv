const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

export const dynamic = 'force-dynamic';

async function fetchProviders() {
  try {
    const res = await fetch(`${API_BASE}/v1/providers?marketType=spot&requestType=getLastPrice`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}

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

export default async function MarketsPage() {
  const providers = await fetchProviders();
  const markets = await fetchMarkets();

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Markets</h2>
        <p className="text-sm text-slate-400">Live markets and provider priority</p>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
        <h3 className="text-lg font-semibold">Active markets</h3>
        <p className="text-sm text-slate-400">Markets discovered from live Redis tickers/trades</p>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2">Market</th>
                <th className="py-2">Last</th>
                <th className="py-2">Updated</th>
                <th className="py-2">Ticker</th>
                <th className="py-2">Trades</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((market: any) => (
                <tr key={market.marketId} className="border-t border-slate-800">
                  <td className="py-2 font-semibold">{market.marketId}</td>
                  <td className="py-2">{market.last ?? 'n/a'}</td>
                  <td className="py-2 text-slate-400">
                    {market.updatedAt ? new Date(market.updatedAt).toLocaleTimeString() : 'n/a'}
                  </td>
                  <td className="py-2">{market.hasTicker ? 'yes' : 'no'}</td>
                  <td className="py-2">{market.hasTrade ? 'yes' : 'no'}</td>
                </tr>
              ))}
              {!markets.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No active markets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
        <p className="text-sm text-slate-400">Routing policy priority for live market requests.</p>
        <ul className="space-y-2 text-sm">
          {providers.map((item: any) => (
            <li key={item.provider} className="flex items-center justify-between border border-slate-800 rounded-lg px-4 py-2">
              <span className="font-semibold uppercase">{item.provider}</span>
              <span className="text-xs text-slate-400">priority {item.priority}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
