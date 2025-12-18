import { VenueCapabilities, VenueMarket } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class BitmexVenueProvider extends BaseVenueProvider {
  readonly name = 'bitmex';
  capabilities: VenueCapabilities = {
    hasSpot: false,
    hasPerp: true,
    wsTrades: true,
    wsKlines: true,
    restOhlcv: true,
  };

  async fetchMarkets(): Promise<VenueMarket[]> {
    const res = await fetch('https://www.bitmex.com/api/v1/instrument/active?columns=symbol,rootSymbol,quoteCurrency');
    if (!res.ok) return [];
    const body = (await res.json()) as Array<{ symbol: string; rootSymbol?: string; quoteCurrency?: string }>;
    return (body ?? []).map((m) => ({
      venue: this.name,
      marketType: 'perp' as const,
      baseSymbol: this.norm(m.rootSymbol),
      quoteSymbol: this.norm(m.quoteCurrency),
      venueSymbol: this.norm(m.symbol),
    }));
  }
}
