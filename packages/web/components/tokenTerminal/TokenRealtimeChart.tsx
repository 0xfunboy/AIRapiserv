'use client';

import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { Chart } from 'react-chartjs-2';
import { useMemo } from 'react';

ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export function TokenRealtimeChart({ points }: { points: Array<{ ts: number; price: number }> }) {
  const { data, options } = useMemo(() => {
    const chartData: ChartData<'line'> = {
      datasets: [
        {
          label: 'Price',
          data: points.map((p) => ({ x: p.ts, y: p.price })),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          tension: 0.25,
          pointRadius: 0,
        },
      ],
    };
    const chartOptions: ChartOptions<'line'> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'minute', displayFormats: { second: 'HH:mm:ss', minute: 'HH:mm' } },
          ticks: { color: '#94a3b8', autoSkip: true },
        },
        y: {
          ticks: { color: '#94a3b8' },
        },
      },
    };
    return { data: chartData, options: chartOptions };
  }, [points]);

  if (!points.length) {
    return <p className="text-sm text-slate-500">No realtime series available.</p>;
  }

  return (
    <div className="h-80">
      <Chart type="line" data={data} options={options} />
    </div>
  );
}
