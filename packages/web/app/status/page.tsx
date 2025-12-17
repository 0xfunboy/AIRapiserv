import { StatCard } from '../../components/StatCard';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

async function fetchStatus() {
  try {
    const res = await fetch(`${API_BASE}/v1/status`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

function formatTs(ts: number | null) {
  if (!ts) return 'n/a';
  return new Date(ts).toLocaleTimeString();
}

export default async function StatusPage() {
  const status = await fetchStatus();
  const redis = status?.redis ?? {};
  const clickhouse = status?.clickhouse ?? {};
  const postgres = status?.postgres ?? {};
  const activeMarkets = status?.activeMarkets ?? [];

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Status</h2>
        <p className="text-sm text-slate-400">Live storage health and ingestion counters</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Redis" value={redis.status ?? 'unknown'} subtitle={`${redis.keysTotal ?? 0} keys`} />
        <StatCard title="ClickHouse" value={clickhouse.status ?? 'unknown'} subtitle={`${clickhouse.candlesRows ?? 0} candle rows`} />
        <StatCard title="Postgres" value={postgres.status ?? 'unknown'} subtitle={`${postgres.assets ?? 0} assets`} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Active Markets" value={`${redis.activeMarkets ?? 0}`} subtitle="From Redis tickers/trades" />
        <StatCard title="Active Symbols" value={`${redis.activeSymbols ?? 0}`} subtitle="Unique symbols live" />
        <StatCard title="Latest Tick" value={formatTs(redis.lastTickerTs ?? null)} subtitle="Last ticker update" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Active markets</h3>
            <p className="text-xs text-slate-400">Live markets detected from Redis keys</p>
          </div>
          <div className="text-xs text-slate-500">
            last trade: {formatTs(redis.lastTradeTs ?? null)}
          </div>
        </div>
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
              {activeMarkets.map((market: any) => (
                <tr key={market.marketId} className="border-t border-slate-800">
                  <td className="py-2 font-semibold">{market.marketId}</td>
                  <td className="py-2">{market.last ?? 'n/a'}</td>
                  <td className="py-2 text-slate-400">{formatTs(market.updatedAt ?? null)}</td>
                  <td className="py-2">{market.hasTicker ? 'yes' : 'no'}</td>
                  <td className="py-2">{market.hasTrade ? 'yes' : 'no'}</td>
                </tr>
              ))}
              {!activeMarkets.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No active markets detected yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
