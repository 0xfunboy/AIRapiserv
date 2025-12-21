'use client';

type Market = {
  marketId: string;
  venue: string;
  pair: string;
  quote: string;
  last?: number;
  volume24h?: number;
  liquidityScore?: number;
  freshnessSeconds?: number;
  ws?: boolean;
};

export function TokenMarketsTable({ markets }: { markets?: Market[] }) {
  if (!markets || !markets.length) {
    return <p className="text-sm text-slate-500">No markets available.</p>;
  }

  const sorted = [...markets].sort((a, b) => {
    const liqA = a.liquidityScore ?? -1;
    const liqB = b.liquidityScore ?? -1;
    if (liqA !== liqB) return liqB - liqA;
    const volA = a.volume24h ?? -1;
    const volB = b.volume24h ?? -1;
    return volB - volA;
  });

  return (
    <div className="overflow-x-auto border border-slate-800 rounded-xl">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-900 text-slate-300">
          <tr>
            <th className="px-3 py-2 text-left">Venue</th>
            <th className="px-3 py-2 text-left">Pair</th>
            <th className="px-3 py-2 text-left">Quote</th>
            <th className="px-3 py-2 text-right">Last</th>
            <th className="px-3 py-2 text-right">Volume 24h</th>
            <th className="px-3 py-2 text-right">Liquidity</th>
            <th className="px-3 py-2 text-right">Freshness</th>
            <th className="px-3 py-2 text-center">WS</th>
            <th className="px-3 py-2 text-center">Open</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sorted.map((m) => (
            <tr key={m.marketId} className="hover:bg-slate-900">
              <td className="px-3 py-2 font-semibold">{m.venue.toUpperCase()}</td>
              <td className="px-3 py-2">{m.pair}</td>
              <td className="px-3 py-2">{m.quote}</td>
              <td className="px-3 py-2 text-right">{m.last !== undefined ? formatNumber(m.last) : '—'}</td>
              <td className="px-3 py-2 text-right">{m.volume24h !== undefined ? formatCompact(m.volume24h) : '—'}</td>
              <td className="px-3 py-2 text-right">{m.liquidityScore !== undefined ? m.liquidityScore.toFixed(2) : '—'}</td>
              <td className="px-3 py-2 text-right">{m.freshnessSeconds !== undefined ? `${Math.floor(m.freshnessSeconds)}s` : '—'}</td>
              <td className="px-3 py-2 text-center">{m.ws ? '✅' : '—'}</td>
              <td className="px-3 py-2 text-center">
                <a href={`/markets?marketId=${encodeURIComponent(m.marketId)}`} className="text-emerald-400 hover:underline">
                  Open
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
}
