import { VenueCapabilities, VenueMarket } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class PhemexVenueProvider extends BaseVenueProvider {
  readonly name = 'phemex';
  capabilities: VenueCapabilities = {
    hasSpot: true,
    hasPerp: true,
    wsTrades: true,
    wsKlines: true,
    restOhlcv: true,
  };

  async fetchMarkets(): Promise<VenueMarket[]> {
    const res = await fetch('https://api.phemex.com/exchange/public/products');
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: { products?: Array<{ symbol: string; type: string; baseCurrency: string; quoteCurrency: string }> } };
    return (body.data?.products ?? []).map((p) => ({
      venue: this.name,
      marketType: p.type?.toLowerCase().includes('perpetual') ? ('perp' as const) : ('spot' as const),
      baseSymbol: this.norm(p.baseCurrency),
      quoteSymbol: this.norm(p.quoteCurrency),
      venueSymbol: this.norm(p.symbol),
    }));
  }
}
