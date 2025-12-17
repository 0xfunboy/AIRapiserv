const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

async function fetchCandles() {
  try {
    const res = await fetch(`${API_BASE}/v1/ohlcv?marketId=binance:BTC-USDT:spot&interval=1s&limit=120`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}

export default async function ChartsPage() {
  const candles = await fetchCandles();

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Charts</h2>
        <p className="text-sm text-slate-400">Rolling candles across sources (demo data)</p>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <p className="text-sm text-slate-400">
          In production we will use lightweight-charts for live plotting. Here we render a numeric preview to keep the page SSR friendly.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm">
          {candles.slice(0, 10).map((candle: any) => (
            <div key={candle.startTs} className="border border-slate-800 rounded-lg p-3">
              <p className="font-semibold">{new Date(candle.startTs).toLocaleTimeString()}</p>
              <p className="text-slate-400">
                O: {candle.open} H: {candle.high} L: {candle.low} C: {candle.close}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
