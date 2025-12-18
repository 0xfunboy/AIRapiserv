import { VenueCapabilities, VenueMarket } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class DeribitVenueProvider extends BaseVenueProvider {
  readonly name = 'deribit';
  capabilities: VenueCapabilities = {
    hasSpot: false,
    hasPerp: true,
    wsTrades: true,
    wsKlines: true,
    restOhlcv: true,
  };

  async fetchMarkets(): Promise<VenueMarket[]> {
    const venues: VenueMarket[] = [];
    for (const currency of ['BTC', 'ETH']) {
      const url = `https://www.deribit.com/api/v2/public/get_instruments?currency=${currency}&kind=perpetual&expired=false`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const body = (await res.json()) as { result?: Array<{ instrument_name: string; quote_currency: string; base_currency: string }> };
      const items = body.result ?? [];
      items.forEach((m) =>
        venues.push({
          venue: this.name,
          marketType: 'perp' as const,
          baseSymbol: this.norm(m.base_currency),
          quoteSymbol: this.norm(m.quote_currency),
          venueSymbol: this.norm(m.instrument_name),
        })
      );
    }
    return venues;
  }
}
