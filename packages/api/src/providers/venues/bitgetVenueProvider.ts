import { VenueCapabilities, VenueMarket } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class BitgetVenueProvider extends BaseVenueProvider {
  readonly name = 'bitget';
  capabilities: VenueCapabilities = {
    hasSpot: true,
    hasPerp: true,
    wsTrades: true,
    wsKlines: true,
    restOhlcv: true,
  };

  async fetchMarkets(): Promise<VenueMarket[]> {
    const [spot, perp] = await Promise.all([this.fetchSpot(), this.fetchPerp()]);
    return [...spot, ...perp];
  }

  private async fetchSpot(): Promise<VenueMarket[]> {
    const res = await fetch('https://api.bitget.com/api/spot/v1/public/products');
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: Array<{ symbol: string; baseCoin: string; quoteCoin: string }> };
    return (body.data ?? []).map((m) => ({
      venue: this.name,
      marketType: 'spot' as const,
      baseSymbol: this.norm(m.baseCoin),
      quoteSymbol: this.norm(m.quoteCoin),
      venueSymbol: this.norm(m.symbol),
    }));
  }

  private async fetchPerp(): Promise<VenueMarket[]> {
    const res = await fetch('https://api.bitget.com/api/mix/v1/market/contracts?productType=USDT-FUTURES');
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
