'use client';

import { Chart as ChartJS, TimeScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import 'chartjs-adapter-date-fns';
import { useMemo } from 'react';
import { Chart } from 'react-chartjs-2';

ChartJS.register(CandlestickController, CandlestickElement, TimeScale, LinearScale, Tooltip, Legend);

type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function CandlesChart({ candles }: { candles: Candle[] }) {
  const data = useMemo(() => {
    const sorted = [...candles].sort((a, b) => a.openTime - b.openTime);
    return {
      datasets: [
        {
          label: 'OHLC',
          data: sorted.map((c) => ({
            x: c.openTime,
            o: c.open,
            h: c.high,
            l: c.low,
            c: c.close,
          })),
          color: {
            up: '#10b981',
            down: '#ef4444',
            unchanged: '#94a3b8',
          },
        },
      ],
    };
  }, [candles]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { type: 'time', time: { unit: 'minute' }, ticks: { color: '#94a3b8' } },
        y: { ticks: { color: '#94a3b8' } },
      },
    }),
    []
  );

  if (!candles.length) return <p className="text-sm text-slate-500">No candles yet.</p>;

  return (
    <div className="h-72">
      <Chart type="candlestick" data={data as any} options={options as any} />
    </div>
  );
}
