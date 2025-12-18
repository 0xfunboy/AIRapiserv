import { VenueCapabilities, VenueMarket } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class BitfinexVenueProvider extends BaseVenueProvider {
  readonly name = 'bitfinex';
  capabilities: VenueCapabilities = {
    hasSpot: true,
    hasPerp: false,
    wsTrades: true,
    wsKlines: false,
    restOhlcv: true,
  };

  async fetchMarkets(): Promise<VenueMarket[]> {
    const url = 'https://api-pub.bitfinex.com/v1/symbols_details';
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      return [];
    }
    if (!res.ok) return [];
    const body = (await res.json()) as Array<{ pair: string }>;
    return (body ?? []).map((m) => {
      const { base, quote } = this.splitPair(m.pair);
      return {
        venue: this.name,
        marketType: 'spot' as const,
        baseSymbol: base,
        quoteSymbol: quote,
        venueSymbol: this.norm(m.pair),
      };
    });
  }
}
