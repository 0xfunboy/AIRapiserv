import { VenueCapabilities, VenueMarket } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class DydxVenueProvider extends BaseVenueProvider {
  readonly name = 'dydx';
  capabilities: VenueCapabilities = {
    hasSpot: false,
    hasPerp: true,
    wsTrades: true,
    wsKlines: true,
    restOhlcv: true,
  };

  async fetchMarkets(): Promise<VenueMarket[]> {
    const res = await fetch('https://api.dydx.exchange/v3/markets');
    if (!res.ok) return [];
    const body = (await res.json()) as { markets?: Record<string, { baseAsset?: string; quoteAsset?: string }> };
    return Object.entries(body.markets ?? {}).map(([venueSymbol, market]) => ({
      venue: this.name,
      marketType: 'perp' as const,
      baseSymbol: this.norm(market.baseAsset),
      quoteSymbol: this.norm(market.quoteAsset),
      venueSymbol: this.norm(venueSymbol),
    }));
  }
}
