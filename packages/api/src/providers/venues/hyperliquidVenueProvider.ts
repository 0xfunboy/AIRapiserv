import { VenueCapabilities, VenueMarket } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class HyperliquidVenueProvider extends BaseVenueProvider {
  readonly name = 'hyperliquid';
  capabilities: VenueCapabilities = {
    hasSpot: false,
    hasPerp: true,
    wsTrades: true,
    wsKlines: true,
    restOhlcv: false,
  };

  async fetchMarkets(): Promise<VenueMarket[]> {
    // Hyperliquid public API for markets is limited; return empty for now.
    return [];
  }
}
