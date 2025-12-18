import { VenueCapabilities, VenueMarket } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class GeminiVenueProvider extends BaseVenueProvider {
  readonly name = 'gemini';
  capabilities: VenueCapabilities = {
    hasSpot: true,
    hasPerp: false,
    wsTrades: true,
    wsKlines: false,
    restOhlcv: true,
  };

  async fetchMarkets(): Promise<VenueMarket[]> {
    const res = await fetch('https://api.gemini.com/v1/symbols/details');
    if (!res.ok) return [];
    const body = (await res.json()) as Array<{ symbol: string; base_currency: string; quote_currency: string }>;
    return (body ?? []).map((m) => ({
      venue: this.name,
      marketType: 'spot' as const,
      baseSymbol: this.norm(m.base_currency),
      quoteSymbol: this.norm(m.quote_currency),
      venueSymbol: this.norm(m.symbol),
    }));
  }
}
