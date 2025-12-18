import { VenueMarket, VenueCapabilities } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class OkxVenueProvider extends BaseVenueProvider {
  readonly name = 'okx';
  capabilities: VenueCapabilities = {
    hasSpot: true,
    hasPerp: true,
    wsTrades: true,
    wsKlines: true,
    restOhlcv: true,
  };

  async fetchMarkets(): Promise<VenueMarket[]> {
    const spot = await this.fetchInstruments('SPOT', 'spot');
    const swap = await this.fetchInstruments('SWAP', 'perp');
    return [...spot, ...swap];
  }

  private async fetchInstruments(instType: string, marketType: 'spot' | 'perp'): Promise<VenueMarket[]> {
    const url = `https://www.okx.com/api/v5/public/instruments?instType=${instType}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`okx ${instType} ${res.status}`);
    const body = (await res.json()) as { data?: Array<{ instId: string; baseCcy?: string; quoteCcy?: string }> };
    return (body.data ?? []).map((m) => ({
      venue: this.name,
      marketType,
      baseSymbol: this.norm(m.baseCcy),
      quoteSymbol: this.norm(m.quoteCcy),
      venueSymbol: this.norm(m.instId),
    }));
  }
}
