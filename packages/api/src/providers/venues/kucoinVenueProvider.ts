import { VenueMarket, VenueCapabilities } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class KucoinVenueProvider extends BaseVenueProvider {
  readonly name = 'kucoin';
  capabilities: VenueCapabilities = {
    hasSpot: true,
    hasPerp: false,
    wsTrades: true,
    wsKlines: true,
    restOhlcv: true,
  };

  async fetchMarkets(): Promise<VenueMarket[]> {
    const res = await fetch('https://api.kucoin.com/api/v2/symbols');
    if (!res.ok) throw new Error(`kucoin ${res.status}`);
    const body = (await res.json()) as { data?: Array<{ symbol: string; baseCurrency: string; quoteCurrency: string }> };
    return (body.data ?? []).map((m) => ({
      venue: this.name,
      marketType: 'spot' as const,
      baseSymbol: this.norm(m.baseCurrency),
      quoteSymbol: this.norm(m.quoteCurrency),
      venueSymbol: this.norm(m.symbol),
    }));
  }
}
