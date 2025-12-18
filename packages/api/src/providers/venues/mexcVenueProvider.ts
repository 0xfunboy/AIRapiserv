import { VenueCapabilities, VenueMarket } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class MexcVenueProvider extends BaseVenueProvider {
  readonly name = 'mexc';
  capabilities: VenueCapabilities = {
    hasSpot: true,
    hasPerp: true,
    wsTrades: true,
    wsKlines: true,
    restOhlcv: true,
  };

  async fetchMarkets(): Promise<VenueMarket[]> {
    const spot = await this.fetchSpot();
    const perp = await this.fetchPerp();
    return [...spot, ...perp];
  }

  private async fetchSpot(): Promise<VenueMarket[]> {
    const res = await fetch('https://api.mexc.com/api/v3/exchangeInfo');
    if (!res.ok) return [];
    const body = (await res.json()) as { symbols?: Array<{ symbol: string; baseAsset: string; quoteAsset: string }> };
    return (body.symbols ?? []).map((m) => ({
      venue: this.name,
      marketType: 'spot' as const,
      baseSymbol: this.norm(m.baseAsset),
      quoteSymbol: this.norm(m.quoteAsset),
      venueSymbol: this.norm(m.symbol),
    }));
  }

  private async fetchPerp(): Promise<VenueMarket[]> {
    const res = await fetch('https://contract.mexc.com/api/v1/contract/detail');
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: Array<{ symbol: string; baseCoin: string; quoteCoin: string }> };
    return (body.data ?? []).map((m) => ({
      venue: this.name,
      marketType: 'perp' as const,
      baseSymbol: this.norm(m.baseCoin),
      quoteSymbol: this.norm(m.quoteCoin),
      venueSymbol: this.norm(m.symbol),
    }));
  }
}
