import { VenueCapabilities, VenueMarket } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class UpbitVenueProvider extends BaseVenueProvider {
  readonly name = 'upbit';
  capabilities: VenueCapabilities = {
    hasSpot: true,
    hasPerp: false,
    wsTrades: true,
    wsKlines: false,
    restOhlcv: true,
  };

  async fetchMarkets(): Promise<VenueMarket[]> {
    const res = await fetch('https://api.upbit.com/v1/market/all');
    if (!res.ok) return [];
    const body = (await res.json()) as Array<{ market: string }>;
    return (body ?? []).map((m) => {
      const parts = m.market.split('-');
      const quote = this.norm(parts[0]);
      const base = this.norm(parts[1]);
      return {
        venue: this.name,
        marketType: 'spot' as const,
        baseSymbol: base,
        quoteSymbol: quote,
        venueSymbol: this.norm(m.market),
      };
    });
  }
}
