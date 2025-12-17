'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3333';

type ConfigValues = {
  ENABLE_COINGECKO_FALLBACK?: string;
  ENABLE_CRYPTOCOMPARE_FALLBACK?: string;
  FALLBACK_POLL_INTERVAL_MS?: string;
  FALLBACK_SYMBOLS?: string;
  BINANCE_SYMBOLS?: string;
  BYBIT_SYMBOLS?: string;
  COINGECKO_MARKETS_FALLBACK?: string;
  COINGECKO_MARKETS_LIMIT?: string;
  COINGECKO_MARKETS_VS?: string;
  COINGECKO_MARKETS_QUOTE?: string;
  CRYPTOCOMPARE_SYMBOLS?: string;
  ENABLE_TOKEN_CATALOG?: string;
  TOKEN_CATALOG_REFRESH_MS?: string;
  API_PORT?: string;
  WEB_PORT?: string;
};

export function AdminClient() {
  const [values, setValues] = useState<ConfigValues>({});
  const [keysPresent, setKeysPresent] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/config`);
        if (!res.ok) return;
        const data = await res.json();
        setValues(data.values ?? {});
        setKeysPresent(data.keysPresent ?? {});
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, []);

  const handleChange = (key: keyof ConfigValues, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setStatus('saving');
    try {
      const res = await fetch(`${API_BASE}/v1/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json();
      setValues(data.values ?? {});
      setKeysPresent(data.keysPresent ?? {});
      setStatus('saved');
    } catch (err) {
      console.error(err);
      setStatus('error');
    } finally {
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 text-sm">
        <div>
          <h3 className="text-lg font-semibold">Runtime configuration</h3>
          <p className="text-xs text-slate-400">Overrides are stored in Redis. Ingestors apply changes on restart.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-400">Binance symbols (comma separated)</span>
            <input
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              value={values.BINANCE_SYMBOLS ?? ''}
              onChange={(event) => handleChange('BINANCE_SYMBOLS', event.target.value)}
              placeholder="btcusdt,ethusdt,solusdt"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-400">Bybit symbols (comma separated)</span>
            <input
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              value={values.BYBIT_SYMBOLS ?? ''}
              onChange={(event) => handleChange('BYBIT_SYMBOLS', event.target.value)}
              placeholder="BTCUSDT,ETHUSDT,SOLUSDT"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-400">Fallback poll interval (ms)</span>
            <input
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              value={values.FALLBACK_POLL_INTERVAL_MS ?? ''}
              onChange={(event) => handleChange('FALLBACK_POLL_INTERVAL_MS', event.target.value)}
              placeholder="300000"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-400">Fallback symbols (comma separated)</span>
            <input
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              value={values.FALLBACK_SYMBOLS ?? ''}
              onChange={(event) => handleChange('FALLBACK_SYMBOLS', event.target.value)}
              placeholder="BTC,ETH,SOL,BNB,XRP"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-400">Token catalog refresh (ms)</span>
            <input
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              value={values.TOKEN_CATALOG_REFRESH_MS ?? ''}
              onChange={(event) => handleChange('TOKEN_CATALOG_REFRESH_MS', event.target.value)}
              placeholder="1800000"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-400">CoinGecko top markets limit</span>
            <input
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              value={values.COINGECKO_MARKETS_LIMIT ?? ''}
              onChange={(event) => handleChange('COINGECKO_MARKETS_LIMIT', event.target.value)}
              placeholder="100"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-400">CoinGecko vs currency</span>
            <input
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              value={values.COINGECKO_MARKETS_VS ?? ''}
              onChange={(event) => handleChange('COINGECKO_MARKETS_VS', event.target.value)}
              placeholder="usd"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-400">CoinGecko market quote label</span>
            <input
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              value={values.COINGECKO_MARKETS_QUOTE ?? ''}
              onChange={(event) => handleChange('COINGECKO_MARKETS_QUOTE', event.target.value)}
              placeholder="USD"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-400">CryptoCompare symbols (comma separated)</span>
            <input
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              value={values.CRYPTOCOMPARE_SYMBOLS ?? ''}
              onChange={(event) => handleChange('CRYPTOCOMPARE_SYMBOLS', event.target.value)}
              placeholder="BTC,ETH,SOL"
            />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm">
            <span>Enable CoinGecko fallback</span>
            <input
              type="checkbox"
              checked={(values.ENABLE_COINGECKO_FALLBACK ?? 'true') !== 'false'}
              onChange={(event) => handleChange('ENABLE_COINGECKO_FALLBACK', event.target.checked ? 'true' : 'false')}
            />
          </label>
          <label className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm">
            <span>Enable CryptoCompare fallback</span>
            <input
              type="checkbox"
              checked={(values.ENABLE_CRYPTOCOMPARE_FALLBACK ?? 'true') !== 'false'}
              onChange={(event) => handleChange('ENABLE_CRYPTOCOMPARE_FALLBACK', event.target.checked ? 'true' : 'false')}
            />
          </label>
          <label className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm">
            <span>Use CoinGecko markets snapshot</span>
            <input
              type="checkbox"
              checked={(values.COINGECKO_MARKETS_FALLBACK ?? 'true') !== 'false'}
              onChange={(event) => handleChange('COINGECKO_MARKETS_FALLBACK', event.target.checked ? 'true' : 'false')}
            />
          </label>
          <label className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm">
            <span>Enable token catalog</span>
            <input
              type="checkbox"
              checked={(values.ENABLE_TOKEN_CATALOG ?? 'true') !== 'false'}
              onChange={(event) => handleChange('ENABLE_TOKEN_CATALOG', event.target.checked ? 'true' : 'false')}
            />
          </label>
        </div>
        <div className="flex items-center justify-between">
          <button
            className="bg-emerald-500 text-slate-900 font-semibold rounded-lg px-4 py-2 text-sm hover:bg-emerald-400"
            onClick={handleSave}
            disabled={status === 'saving'}
          >
            {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved' : status === 'error' ? 'Failed' : 'Save overrides'}
          </button>
          <div className="text-xs text-slate-500">
            API keys present: {Object.entries(keysPresent)
              .filter(([, present]) => present)
              .map(([key]) => key.replace('_API_KEY', ''))
              .join(', ') || 'none'}
          </div>
        </div>
      </div>
    </div>
  );
}
