'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

export function TokenRefreshButton() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');

  const run = async () => {
    setStatus('running');
    try {
      const res = await fetch(`${API_BASE}/v1/tokens/refresh`, { method: 'POST' });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    } finally {
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const label =
    status === 'running'
      ? 'Updating...'
      : status === 'done'
      ? 'Updated'
      : status === 'error'
      ? 'Failed'
      : 'Update token list';

  return (
    <button
      className="bg-emerald-500 text-slate-900 font-semibold rounded-lg px-4 py-2 text-sm hover:bg-emerald-400 disabled:opacity-60"
      onClick={run}
      disabled={status === 'running'}
    >
      {label}
    </button>
  );
}
