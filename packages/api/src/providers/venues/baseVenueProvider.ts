import { VenueProvider, VenueCapabilities, VenueMarket } from '@airapiserv/core';

export abstract class BaseVenueProvider implements VenueProvider {
  abstract readonly name: string;
  abstract capabilities: VenueCapabilities;
  abstract fetchMarkets(): Promise<VenueMarket[]>;

  protected norm(symbol?: string) {
    return symbol ? symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '';
  }

  // Best-effort parser for symbols like BTCUSDT, BTC-USD, BTC_USD, BTC/USD.
  protected splitPair(pair?: string): { base: string; quote: string } {
    const cleaned = this.norm(pair);
    const knownQuotes = ['USDT', 'USD', 'USDC', 'BUSD', 'EUR', 'BTC', 'ETH', 'KRW', 'GBP', 'JPY'];
    for (const quote of knownQuotes) {
      if (cleaned.endsWith(quote) && cleaned.length > quote.length) {
        return { base: cleaned.slice(0, cleaned.length - quote.length), quote };
      }
    }
    const mid = Math.floor(cleaned.length / 2);
    return { base: cleaned.slice(0, mid), quote: cleaned.slice(mid) };
  }
}
