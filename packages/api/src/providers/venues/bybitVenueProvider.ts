import { VenueMarket, VenueCapabilities } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class BybitVenueProvider extends BaseVenueProvider {
  readonly name = 'bybit';
  capabilities: VenueCapabilities = {
    hasSpot: true,
    hasPerp: true,
    wsTrades: true,
    wsKlines: true,
    restOhlcv: true,
  };

  async fetchMarkets(): Promise<VenueMarket[]> {
    const spot = await this.fetchCategory('spot', 'spot');
    const linear = await this.fetchCategory('linear', 'perp');
    const inverse = await this.fetchCategory('inverse', 'perp');
    return [...spot, ...linear, ...inverse];
  }

  private async fetchCategory(category: string, marketType: 'spot' | 'perp'): Promise<VenueMarket[]> {
    const url = `https://api.bybit.com/v5/market/instruments?category=${category}`;
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      return [];
    }
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`bybit ${category} ${res.status}`);
    }
    const body = (await res.json()) as { result?: { list?: Array<{ symbol: string; baseCoin?: string; quoteCoin?: string }> } };
    return (body.result?.list ?? []).map((m) => ({
      venue: this.name,
      marketType,
      baseSymbol: this.norm(m.baseCoin),
      quoteSymbol: this.norm(m.quoteCoin),
      venueSymbol: this.norm(m.symbol),
    }));
  }
}
