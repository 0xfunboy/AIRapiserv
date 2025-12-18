import { VenueMarket, VenueCapabilities } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

export class BinanceVenueProvider extends BaseVenueProvider {
  readonly name = 'binance';
  capabilities: VenueCapabilities = {
    hasSpot: true,
    hasPerp: true,
    wsTrades: true,
    wsKlines: true,
    restOhlcv: true,
  };

  async fetchMarkets(): Promise<VenueMarket[]> {
    const url = 'https://api.binance.com/api/v3/exchangeInfo';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`binance exchangeInfo ${res.status}`);
    const data = (await res.json()) as { symbols: Array<{ symbol: string; status: string; quoteAsset: string; baseAsset: string }> };
    const spot = (data.symbols ?? []).map((m) => ({
      venue: this.name,
      marketType: 'spot' as const,
      baseSymbol: this.norm(m.baseAsset),
      quoteSymbol: this.norm(m.quoteAsset),
      venueSymbol: this.norm(m.symbol),
    }));

    const futuresUrl = 'https://fapi.binance.com/fapi/v1/exchangeInfo';
    const futuresRes = await fetch(futuresUrl);
    const futuresBody = futuresRes.ok ? await futuresRes.json() : { symbols: [] };
    const perp = (futuresBody.symbols ?? []).map((m: any) => ({
      venue: this.name,
      marketType: 'perp' as const,
      baseSymbol: this.norm(m.baseAsset),
      quoteSymbol: this.norm(m.quoteAsset),
      venueSymbol: this.norm(m.symbol),
    }));

    return [...spot, ...perp];
  }
}
