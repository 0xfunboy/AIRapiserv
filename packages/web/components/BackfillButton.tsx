'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

export function BackfillButton({ tokenId, timeframe = '1m', label = 'Backfill OHLCV' }: { tokenId: string; timeframe?: string; label?: string }) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const run = async () => {
    setStatus('running');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/tokens/${encodeURIComponent(tokenId)}/ohlcv/backfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeframe }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      setMessage(`enqueued ${data.taskId ?? ''}`.trim());
      setStatus('done');
    } catch (err: any) {
      setMessage(err?.message ?? 'failed');
      setStatus('error');
    } finally {
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={run}
        disabled={status === 'running'}
        className="bg-emerald-500 text-slate-900 font-semibold rounded-lg px-3 py-2 text-xs hover:bg-emerald-400 disabled:opacity-60"
      >
        {status === 'running' ? 'Enqueuing...' : label}
      </button>
      {message && (
        <p className={`text-[11px] ${status === 'error' ? 'text-rose-400' : 'text-emerald-300'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
