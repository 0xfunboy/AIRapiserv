import Link from 'next/link';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

export default async function TokensPage() {
  const tokens = await fetch(`${API_BASE}/api/tokens/search?q=%25&limit=200`, { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : []))
    .catch(() => []);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Tokens</h2>
          <p className="text-sm text-slate-400">Global catalog (persisted in Postgres)</p>
        </div>
        <Link
          href="/assets"
          className="text-xs bg-slate-800 px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-700"
        >
          Go to resolver
        </Link>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="px-3 py-2">Symbol</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Chains</th>
              <th className="px-3 py-2">Contracts</th>
              <th className="px-3 py-2">Sources</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token: any) => (
              <tr key={token.tokenKey} className="border-t border-slate-800 hover:bg-slate-800/60">
                <td className="px-3 py-2 font-semibold">
                  <Link href={`/tokens/${encodeURIComponent(token.tokenKey)}`} className="text-emerald-400 hover:underline">
                    {token.symbol ?? 'n/a'}
                  </Link>
                </td>
                <td className="px-3 py-2">{token.name ?? 'Unknown'}</td>
                <td className="px-3 py-2 text-slate-400">{(token.chains ?? []).filter(Boolean).join(', ') || 'n/a'}</td>
                <td className="px-3 py-2">{token.contracts ?? 0}</td>
                <td className="px-3 py-2 text-slate-400">
                  {(token.sources ?? []).slice(0, 4).join(', ') || 'n/a'}
                </td>
                <td className="px-3 py-2 text-slate-400">
                  {token.updatedAt ? new Date(token.updatedAt).toLocaleTimeString() : 'n/a'}
                </td>
              </tr>
            ))}
            {!tokens.length && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Token catalog empty. Run “Update token list” from Status or Assets.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
