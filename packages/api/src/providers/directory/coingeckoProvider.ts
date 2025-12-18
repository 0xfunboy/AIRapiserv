import { DirectoryToken } from '@airapiserv/core';
import { BaseDirectoryProvider } from './baseDirectoryProvider.js';

export class CoinGeckoProvider extends BaseDirectoryProvider {
  readonly name = 'coingecko';

  async fetchTokens(): Promise<DirectoryToken[]> {
    const apiKey = process.env.COINGECKO_API_KEY ?? '';
    const headers = apiKey ? { 'x-cg-pro-api-key': apiKey } : undefined;
    const url = 'https://api.coingecko.com/api/v3/coins/list?include_platform=true';
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`CoinGecko error ${res.status}`);
    const body = (await res.json()) as Array<{ id: string; symbol: string; name: string; platforms?: Record<string, string> }>;

    const tokens: DirectoryToken[] = [];
    for (const row of body) {
      const symbol = this.normalizeSymbol(row.symbol);
      const name = row.name;
      const platforms = row.platforms ?? {};
      const entries = Object.entries(platforms);
      if (!entries.length) {
        tokens.push({
          symbol,
          name,
          coingeckoId: row.id,
          source: this.name,
        });
      } else {
        for (const [chain, address] of entries) {
          tokens.push({
            symbol,
            name,
            chain: chain || null,
            contractAddress: this.normalizeAddress(address),
            coingeckoId: row.id,
            source: this.name,
          });
        }
      }
    }
    return tokens;
  }
}
