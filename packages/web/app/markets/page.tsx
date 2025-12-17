const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

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

export default async function MarketsPage() {
  const providers = await fetchProviders();

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Markets</h2>
        <p className="text-sm text-slate-400">Provider coverage e priorità</p>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
        <p className="text-sm text-slate-400">Placeholder view per mappare i mercati disponibili e la policy di routing. Ogni riga mostra il provider in ordine di preferenza.</p>
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
