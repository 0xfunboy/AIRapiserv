import { VenueMarket, VenueCapabilities } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class KrakenVenueProvider extends BaseVenueProvider {
  readonly name = 'kraken';
  capabilities: VenueCapabilities = {
    hasSpot: true,
    hasPerp: false,
    wsTrades: true,
    wsKlines: false,
    restOhlcv: true,
  };

  async fetchMarkets(): Promise<VenueMarket[]> {
    const res = await fetch('https://api.kraken.com/0/public/AssetPairs');
    if (!res.ok) throw new Error(`kraken ${res.status}`);
    const body = (await res.json()) as { result?: Record<string, { wsname?: string; base?: string; quote?: string }> };
    return Object.entries(body.result ?? {}).map(([venueSymbol, pair]) => {
      const wsname = pair.wsname ?? venueSymbol;
      const [baseRaw, quoteRaw] = wsname.split('/');
      return {
        venue: this.name,
        marketType: 'spot' as const,
        baseSymbol: this.norm(baseRaw),
        quoteSymbol: this.norm(quoteRaw),
        venueSymbol: this.norm(venueSymbol),
      };
    });
  }
}
