'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

type Props = {
  label: string;
  taskType: string;
  payload?: Record<string, any>;
  priority?: number;
  variant?: 'primary' | 'ghost';
};

export function ActionButton({ label, taskType, payload, priority, variant = 'primary' }: Props) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const run = async () => {
    setStatus('running');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/tasks/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: taskType, payload, priority }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      setMessage(`taskId: ${data.taskId ?? 'queued'}`);
      setStatus('done');
    } catch (err: any) {
      setMessage(err?.message ?? 'failed');
      setStatus('error');
    } finally {
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const base =
    variant === 'primary'
      ? 'bg-emerald-500 text-slate-900 hover:bg-emerald-400'
      : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700';

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={run}
        disabled={status === 'running'}
        className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${base} disabled:opacity-60`}
      >
        {status === 'running' ? 'Working...' : label}
      </button>
      {message && (
        <p className={`text-[11px] ${status === 'error' ? 'text-rose-400' : 'text-emerald-300'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
