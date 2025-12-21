'use client';

import { useState } from 'react';

type TokenInfo = {
  tokenId: string;
  symbol: string;
  name?: string;
  chain?: string;
  contractAddress?: string;
  logo?: string;
};

export function TokenHeader({ token }: { token: TokenInfo }) {
  const [copied, setCopied] = useState(false);
  const contract = token.contractAddress;

  const handleCopy = async () => {
    if (!contract) return;
    try {
      await navigator.clipboard.writeText(contract);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
      {token.logo ? (
        <img src={token.logo} alt={token.symbol} className="h-12 w-12 rounded-full" />
      ) : (
        <div className="h-12 w-12 rounded-full bg-slate-700 flex items-center justify-center text-lg font-bold text-slate-100">{token.symbol?.slice(0, 2)}</div>
      )}
      <div className="flex flex-col gap-1">
        <div className="text-xl font-semibold text-slate-100">
          {token.name ?? token.symbol}{' '}
          <span className="text-sm text-slate-400 font-normal">{token.symbol !== token.name ? token.symbol : null}</span>
        </div>
        <div className="text-sm text-slate-400 flex items-center gap-2">
          {token.chain && <span className="px-2 py-1 rounded-md bg-slate-800 text-xs">Chain: {token.chain}</span>}
          {contract && (
            <button onClick={handleCopy} className="px-2 py-1 rounded-md bg-slate-800 text-xs hover:bg-slate-700">
              CA: {shorten(contract)} {copied ? '✓' : '📋'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function shorten(addr: string) {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
