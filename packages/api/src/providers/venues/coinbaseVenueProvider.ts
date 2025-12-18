import { VenueMarket, VenueCapabilities } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class CoinbaseVenueProvider extends BaseVenueProvider {
  readonly name = 'coinbase';
  capabilities: VenueCapabilities = {
    hasSpot: true,
    hasPerp: false,
    wsTrades: true,
    wsKlines: false,
    restOhlcv: true,
  };

  async fetchMarkets(): Promise<VenueMarket[]> {
    const res = await fetch('https://api.exchange.coinbase.com/products');
    if (!res.ok) throw new Error(`coinbase ${res.status}`);
    const body = (await res.json()) as Array<{ id: string; base_currency: string; quote_currency: string }>;
    return body.map((m) => ({
      venue: this.name,
      marketType: 'spot' as const,
      baseSymbol: this.norm(m.base_currency),
      quoteSymbol: this.norm(m.quote_currency),
      venueSymbol: this.norm(m.id),
    }));
  }
}
