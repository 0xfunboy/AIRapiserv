import { StatCard } from '../components/StatCard';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/v1/health`, { cache: 'no-store' });
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
  const health = await fetchHealth();
  const status = health ?? { redis: 'unknown', postgres: 'unknown', clickhouse: 'unknown' };

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Realtime overview</h2>
        <p className="text-sm text-slate-400">Lag, provider coverage, and storage health</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Redis" value={status.redis} subtitle="Realtime cache" />
        <StatCard title="ClickHouse" value={status.clickhouse} subtitle="Time series" />
        <StatCard title="Postgres" value={status.postgres} subtitle="Catalogue" />
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-2">Event rate (demo)</h3>
        <p className="text-sm text-slate-400">When ingestion workers are active this panel shows trades/tickers per market.</p>
        <ul className="mt-4 space-y-2 text-sm">
          <li>binance:BTC-USDT ~ 1.2k trades/min</li>
          <li>bybit:BTC-USDT ~ 980 trades/min</li>
          <li>fallback pool ~ 12 polls/5min</li>
        </ul>
      </div>
    </section>
  );
}
