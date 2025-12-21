'use client';

type Price = { value: number; ts: number; currency: string };
type Stats = {
  change1m?: number;
  change5m?: number;
  change1h?: number;
  change24h?: number;
  freshnessSeconds?: number;
};

export function TokenPriceCard({ price, stats }: { price?: Price; stats?: Stats }) {
  const updatedAgo = stats?.freshnessSeconds ?? (price ? Math.floor((Date.now() - price.ts) / 1000) : null);
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="text-sm text-slate-400">Price</div>
      <div className="text-3xl font-bold text-slate-100">{price ? formatPrice(price.value) : 'N/A'} {price?.currency ?? ''}</div>
      <div className="flex flex-wrap gap-3 text-sm">
        {renderChange('1m', stats?.change1m)}
        {renderChange('5m', stats?.change5m)}
        {renderChange('1h', stats?.change1h)}
        {renderChange('24h', stats?.change24h)}
      </div>
      {updatedAgo !== null && <div className="text-xs text-slate-500">Updated {updatedAgo}s ago</div>}
    </div>
  );
}

function renderChange(label: string, value?: number) {
  if (value === undefined || value === null) return null;
  const positive = value >= 0;
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${positive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
      {label}: {value.toFixed(2)}%
    </span>
  );
}

function formatPrice(value: number) {
  const opts = { minimumFractionDigits: value > 1 ? 2 : 6, maximumFractionDigits: value > 1 ? 2 : 8 };
  return new Intl.NumberFormat('en-US', opts).format(value);
}
