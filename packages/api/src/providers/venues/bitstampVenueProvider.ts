import { VenueCapabilities, VenueMarket } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class BitstampVenueProvider extends BaseVenueProvider {
  readonly name = 'bitstamp';
  capabilities: VenueCapabilities = {
    hasSpot: true,
    hasPerp: false,
    wsTrades: true,
    wsKlines: false,
    restOhlcv: true,
  };

  async fetchMarkets(): Promise<VenueMarket[]> {
    const url = 'https://www.bitstamp.net/api/v2/trading-pairs-info/';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`bitstamp ${res.status}`);
    const body = (await res.json()) as Array<{ name: string; url_symbol: string }>;
    return (body ?? []).map((m) => {
      const [base, quote] = (m.name ?? '').split('/') as [string, string];
      return {
        venue: this.name,
        marketType: 'spot' as const,
        baseSymbol: this.norm(base),
        quoteSymbol: this.norm(quote),
        venueSymbol: this.norm(m.url_symbol),
      };
    });
  }
}
