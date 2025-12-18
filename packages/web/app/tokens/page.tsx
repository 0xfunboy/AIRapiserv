import Link from 'next/link';
import { TokenSearchClient } from '../../components/TokenSearchClient';
import { TokenRefreshButton } from '../../components/TokenRefreshButton';

export const dynamic = 'force-dynamic';

export default async function TokensPage() {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Tokens</h2>
          <p className="text-sm text-slate-400">Global catalog (persisted in Postgres) with disambiguation and priority sources</p>
        </div>
        <div className="flex items-center gap-2">
          <TokenRefreshButton />
          <Link href="/assets" className="text-xs bg-slate-800 px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-700">
            Resolver
          </Link>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-lg font-semibold">Search</h3>
        <p className="text-xs text-slate-400">
          Search by ticker/name/contract. Click a symbol to view coverage, venues, and OHLCV with backfill.
        </p>
        <TokenSearchClient />
      </div>
    </section>
  );
}
