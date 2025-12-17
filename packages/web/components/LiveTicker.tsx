'use client';

import { useEffect, useMemo, useState } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3333/v1/ws';

interface Props {
  marketId: string;
}

export function LiveTicker({ marketId }: Props) {
  const [last, setLast] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');

  const payload = useMemo(
    () =>
      JSON.stringify({
        type: 'subscribe',
        channel: 'ticker',
        marketId,
        intervalMs: 1000,
      }),
    [marketId]
  );

  useEffect(() => {
    let socket: WebSocket | null = new WebSocket(WS_URL);
    setStatus('connecting');

    socket.onopen = () => {
      setStatus('live');
      socket?.send(payload);
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'update' && message.channel === 'ticker' && message.data) {
          setLast(message.data.last ?? null);
          setUpdatedAt(message.data.updatedAt ?? Date.now());
        }
      } catch {
        // ignore malformed payloads
      }
    };
    socket.onclose = () => setStatus('offline');
    socket.onerror = () => setStatus('offline');

    return () => {
      socket?.close();
      socket = null;
    };
  }, [payload]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{marketId}</span>
        <span className={status === 'live' ? 'text-emerald-400' : 'text-rose-400'}>{status}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold">{last ?? 'n/a'}</div>
      <div className="text-xs text-slate-500 mt-1">
        Updated: {updatedAt ? new Date(updatedAt).toLocaleTimeString() : 'n/a'}
      </div>
    </div>
  );
}
