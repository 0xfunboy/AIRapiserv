'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

export function TokenRefreshButton() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const run = async () => {
    setStatus('running');
    setErrorMessage('');
    try {
      const res = await fetch(`${API_BASE}/v1/tokens/refresh`, { method: 'POST' });
      if (res.ok) {
        setStatus('done');
        return;
      }
      const text = await res.text();
      console.error('Token refresh failed', text);
      setErrorMessage(text || 'Request failed');
      setStatus('error');
    } catch {
      setErrorMessage('Network error');
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
    <div className="flex flex-col items-end gap-2">
      <button
        className="bg-emerald-500 text-slate-900 font-semibold rounded-lg px-4 py-2 text-sm hover:bg-emerald-400 disabled:opacity-60"
        onClick={run}
        disabled={status === 'running'}
      >
        {label}
      </button>
      {status === 'error' && <p className="text-xs text-rose-400">{errorMessage}</p>}
    </div>
  );
}
