import { VenueMarket, VenueCapabilities } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class GateVenueProvider extends BaseVenueProvider {
  readonly name = 'gate';
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
    const url = 'https://api.gateio.ws/api/v4/spot/currency_pairs';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`gate spot ${res.status}`);
    const body = (await res.json()) as Array<{ id: string; base: string; quote: string; trade_status?: string }>;
    return (body ?? [])
      .filter((m) => (m.trade_status ?? '').toLowerCase() !== 'delist')
      .map((m) => ({
        venue: this.name,
        marketType: 'spot' as const,
        baseSymbol: this.norm(m.base),
        quoteSymbol: this.norm(m.quote),
        venueSymbol: this.norm(m.id),
      }));
  }

  private async fetchPerp(): Promise<VenueMarket[]> {
    const usdtUrl = 'https://api.gateio.ws/api/v4/futures/usdt/contracts';
    const btcUrl = 'https://api.gateio.ws/api/v4/futures/btc/contracts';
    const [usdt, btc] = await Promise.all([this.safeFetchPerp(usdtUrl), this.safeFetchPerp(btcUrl)]);
    return [...usdt, ...btc];
  }

  private async safeFetchPerp(url: string): Promise<VenueMarket[]> {
    const res = await fetch(url);
    if (!res.ok) {
      return [];
    }
    const body = (await res.json()) as Array<{ name: string; in_delisting?: boolean; base?: string; quote?: string }>;
    return (body ?? [])
      .filter((m) => !m.in_delisting)
      .map((m) => ({
        venue: this.name,
        marketType: 'perp' as const,
        baseSymbol: this.norm(m.base ?? m.name.split('_')[0]),
        quoteSymbol: this.norm(m.quote ?? m.name.split('_')[1]),
        venueSymbol: this.norm(m.name),
      }));
  }
}
