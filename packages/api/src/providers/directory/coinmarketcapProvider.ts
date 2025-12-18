import { DirectoryToken } from '@airapiserv/core';
import { BaseDirectoryProvider } from './baseDirectoryProvider.js';

export class CoinMarketCapProvider extends BaseDirectoryProvider {
  readonly name = 'coinmarketcap';

  async fetchTokens(): Promise<DirectoryToken[]> {
    const apiKey = process.env.COINMARKETCAP_API_KEY ?? '';
    if (!apiKey) return [];
    const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?limit=5000';
    const res = await fetch(url, { headers: { 'X-CMC_PRO_API_KEY': apiKey } });
    if (!res.ok) throw new Error(`CMC error ${res.status}`);
    const body = (await res.json()) as { data: Array<{ id: number; symbol: string; name: string; platform?: { name: string; token_address: string } }> };
    return body.data.map((row) => ({
      symbol: this.normalizeSymbol(row.symbol),
      name: row.name,
      chain: row.platform?.name ?? null,
      contractAddress: this.normalizeAddress(row.platform?.token_address),
      coinmarketcapId: row.id.toString(),
      source: this.name,
    }));
  }
}
