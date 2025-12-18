import { VenueMarket, VenueCapabilities } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

const stubCapabilities: VenueCapabilities = {
  hasSpot: true,
  hasPerp: false,
  wsTrades: true,
  wsKlines: false,
  restOhlcv: false,
};

const VENUE_NAMES = [
  'binance',
  'bybit',
  'okx',
  'kucoin',
  'kraken',
  'coinbase',
  'bitfinex',
  'bitstamp',
  'gate',
  'mexc',
  'htx',
  'cryptocom',
  'gemini',
  'upbit',
  'bitget',
  'phemex',
  'hyperliquid',
  'dydx',
  'bitmex',
  'deribit',
];

class StubVenue extends BaseVenueProvider {
  readonly name: string;
  capabilities: VenueCapabilities;
  constructor(name: string, caps: VenueCapabilities) {
    super();
    this.name = name;
    this.capabilities = caps;
  }
  async fetchMarkets(): Promise<VenueMarket[]> {
    return [];
  }
}

export const venueProviders = VENUE_NAMES.map((name) => {
  const caps: VenueCapabilities = { ...stubCapabilities };
  if (['hyperliquid', 'dydx', 'bitmex', 'deribit', 'phemex', 'bitget', 'okx', 'bybit', 'binance'].includes(name)) {
    caps.hasPerp = true;
    caps.wsKlines = true;
  }
  return new StubVenue(name, caps);
});
