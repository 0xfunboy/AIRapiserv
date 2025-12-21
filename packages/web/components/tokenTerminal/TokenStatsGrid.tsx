'use client';

type Stats = {
  volume24h?: number;
  high24h?: number;
  low24h?: number;
  volatility1h?: number;
  marketsCount?: number;
  freshnessSeconds?: number;
};

const cards: Array<{ key: keyof Stats; label: string; formatter?: (v: number) => string }> = [
  { key: 'volume24h', label: '24h Volume', formatter: formatCompact },
  { key: 'high24h', label: '24h High' },
  { key: 'low24h', label: '24h Low' },
  { key: 'volatility1h', label: 'Volatility 1h', formatter: (v) => `${v.toFixed(2)}%` },
  { key: 'marketsCount', label: '# Markets' },
  { key: 'freshnessSeconds', label: 'Freshness', formatter: (v) => `${Math.floor(v)}s` },
];

export function TokenStatsGrid({ stats }: { stats?: Stats }) {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {cards.map(({ key, label, formatter }) => {
        const value = stats[key];
        if (value === undefined || value === null) return null;
        return (
          <div key={key as string} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <div className="text-xs text-slate-400">{label}</div>
            <div className="text-lg font-semibold text-slate-100">{formatter ? formatter(value as number) : formatNumber(value as number)}</div>
          </div>
        );
      })}
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
}
