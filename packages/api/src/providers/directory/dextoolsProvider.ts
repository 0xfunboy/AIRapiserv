import { DirectoryToken } from '@airapiserv/core';
import { BaseDirectoryProvider } from './baseDirectoryProvider.js';

export class DextoolsProvider extends BaseDirectoryProvider {
  readonly name = 'dextools';

  async fetchTokens(): Promise<DirectoryToken[]> {
    const apiKey = process.env.DEXTOOLS_API_KEY ?? '';
    const url = process.env.DEXTOOLS_TOKEN_LIST_URL ?? '';
    if (!url) return [];
    const res = await fetch(url, { headers: apiKey ? { 'X-API-Key': apiKey } : undefined });
    if (!res.ok) throw new Error(`Dextools error ${res.status}`);
    const payload = await res.json();
    const items = Array.isArray(payload) ? payload : Array.isArray((payload as any)?.data) ? (payload as any).data : (payload as any)?.tokens ?? [];
    return items.map((item: any) => ({
      symbol: this.normalizeSymbol(item.symbol ?? item.tokenSymbol ?? item.ticker),
      name: item.name ?? item.tokenName ?? null,
      chain: item.chain ?? item.chainId ?? null,
      contractAddress: this.normalizeAddress(item.contractAddress ?? item.address ?? item.tokenAddress),
      dextoolsId: item.id ?? null,
      source: this.name,
    }));
  }
}
