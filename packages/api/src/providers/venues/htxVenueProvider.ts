import { VenueCapabilities, VenueMarket } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class HtxVenueProvider extends BaseVenueProvider {
  readonly name = 'htx';
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
    const res = await fetch('https://api.huobi.pro/v1/common/symbols');
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: Array<{ 'base-currency': string; 'quote-currency': string; symbol: string }> };
    return (body.data ?? []).map((m) => ({
      venue: this.name,
      marketType: 'spot' as const,
      baseSymbol: this.norm((m as any)['base-currency']),
      quoteSymbol: this.norm((m as any)['quote-currency']),
      venueSymbol: this.norm(m.symbol),
    }));
  }

  private async fetchPerp(): Promise<VenueMarket[]> {
    // Linear swap contracts (USDT margined)
    const res = await fetch('https://api.hbdm.com/linear-swap-api/v1/swap_contract_info');
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: Array<{ contract_code: string; symbol: string; contract_status?: number }> };
    return (body.data ?? [])
      .filter((m) => (m.contract_status ?? 0) !== 5) // 5 = delisted
      .map((m) => ({
        venue: this.name,
        marketType: 'perp' as const,
        baseSymbol: this.norm(m.symbol),
        quoteSymbol: this.norm('USDT'),
        venueSymbol: this.norm(m.contract_code),
      }));
  }
}
