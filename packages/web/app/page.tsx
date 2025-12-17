import { StatCard } from '../components/StatCard';
import { LiveTicker } from '../components/LiveTicker';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

export const dynamic = 'force-dynamic';

async function fetchStatus() {
  try {
    const res = await fetch(`${API_BASE}/v1/status`, { cache: 'no-store' });
    if (!res.ok) {
      return null;
    }
    return res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

export default async function DashboardPage() {
  const status = await fetchStatus();
  const health = status?.health ?? { redis: 'unknown', postgres: 'unknown', clickhouse: 'unknown' };
  const redis = status?.redis ?? {};
  const activeMarkets = status?.activeMarkets ?? [];
  const primaryMarket = activeMarkets[0]?.marketId ?? 'binance:BTCUSDT:spot';

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Realtime overview</h2>
        <p className="text-sm text-slate-400">Live ingestion, storage health, and rolling updates</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Redis" value={health.redis} subtitle={`${redis.keysTotal ?? 0} keys`} />
        <StatCard title="ClickHouse" value={health.clickhouse} subtitle={`${status?.clickhouse?.candlesRows ?? 0} rows`} />
        <StatCard
          title="Postgres"
          value={health.postgres}
          subtitle={`${status?.postgres?.tokens ?? 0} tokens · ${status?.postgres?.assets ?? 0} assets`}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <LiveTicker marketId={primaryMarket} />
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
          <h3 className="text-lg font-semibold">Live markets</h3>
          <p className="text-sm text-slate-400">Active tickers/trades detected from Redis</p>
          <ul className="space-y-2 text-sm">
            {activeMarkets.slice(0, 6).map((market: any) => (
              <li key={market.marketId} className="flex items-center justify-between border border-slate-800 rounded-lg px-3 py-2">
                <span className="font-semibold">{market.marketId}</span>
                <span className="text-slate-400">{market.last ?? 'n/a'}</span>
              </li>
            ))}
            {!activeMarkets.length && <li className="text-slate-500">No markets yet - start ingestors.</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}
