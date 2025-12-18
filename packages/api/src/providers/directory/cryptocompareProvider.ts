import { DirectoryToken } from '@airapiserv/core';
import { BaseDirectoryProvider } from './baseDirectoryProvider.js';

export class CryptoCompareProvider extends BaseDirectoryProvider {
  readonly name = 'cryptocompare';

  async fetchTokens(): Promise<DirectoryToken[]> {
    const apiKey = process.env.CRYPTOCOMPARE_API_KEY ?? '';
    const url = 'https://min-api.cryptocompare.com/data/all/coinlist';
    const res = await fetch(url, {
      headers: apiKey ? { Authorization: `Apikey ${apiKey}` } : undefined,
    });
    if (!res.ok) throw new Error(`CryptoCompare error ${res.status}`);
    const body = (await res.json()) as { Data: Record<string, { Symbol: string; CoinName: string; FullName?: string; Id?: string }> };
    return Object.values(body.Data ?? {}).map((row) => ({
      symbol: this.normalizeSymbol(row.Symbol),
      name: row.CoinName ?? row.FullName ?? null,
      cryptocompareId: row.Id ?? null,
      source: this.name,
    }));
  }
}
