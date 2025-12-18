import { VenueProvider, VenueCapabilities, VenueMarket } from '@airapiserv/core';

export abstract class BaseVenueProvider implements VenueProvider {
  abstract readonly name: string;
  abstract capabilities: VenueCapabilities;
  abstract fetchMarkets(): Promise<VenueMarket[]>;

  protected norm(symbol?: string) {
    return symbol ? symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '';
  }
}
