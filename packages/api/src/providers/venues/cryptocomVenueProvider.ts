import { VenueCapabilities, VenueMarket } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class CryptoComVenueProvider extends BaseVenueProvider {
  readonly name = 'cryptocom';
  capabilities: VenueCapabilities = {
    hasSpot: true,
    hasPerp: false,
    wsTrades: true,
    wsKlines: false,
    restOhlcv: true,
  };

  async fetchMarkets(): Promise<VenueMarket[]> {
    const res = await fetch('https://api.crypto.com/v2/public/get-instruments');
    if (!res.ok) return [];
    const body = (await res.json()) as { result?: { instruments?: Array<{ instrument_name: string; base_currency: string; quote_currency: string }> } };
    return (body.result?.instruments ?? []).map((m) => ({
      venue: this.name,
      marketType: 'spot' as const,
      baseSymbol: this.norm(m.base_currency),
      quoteSymbol: this.norm(m.quote_currency),
      venueSymbol: this.norm(m.instrument_name),
    }));
  }
}
