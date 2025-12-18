import { DirectoryToken } from '@airapiserv/core';
import { BaseDirectoryProvider } from './baseDirectoryProvider.js';

export class CodexProvider extends BaseDirectoryProvider {
  readonly name = 'codex';

  async fetchTokens(): Promise<DirectoryToken[]> {
    const apiKey = process.env.CODEX_API_KEY ?? '';
    const url = process.env.CODEX_TOKEN_LIST_URL ?? '';
    if (!url) return [];
    const res = await fetch(url, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}`, 'X-API-Key': apiKey } : undefined,
    });
    if (!res.ok) throw new Error(`Codex error ${res.status}`);
    const payload = await res.json();
    const items = Array.isArray(payload) ? payload : Array.isArray((payload as any)?.data) ? (payload as any).data : (payload as any)?.tokens ?? [];
    return items.map((item: any) => ({
      symbol: this.normalizeSymbol(item.symbol ?? item.ticker ?? item.tokenSymbol),
      name: item.name ?? item.tokenName ?? null,
      chain: item.chain ?? item.chainId ?? null,
      contractAddress: this.normalizeAddress(item.contractAddress ?? item.address ?? item.tokenAddress),
      codexId: item.id ?? null,
      source: this.name,
    }));
  }
}
