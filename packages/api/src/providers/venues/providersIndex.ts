import { VenueProvider, VenueCapabilities, VenueMarket } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';

const VENUE_DEFS: Array<{ name: string; caps: VenueCapabilities }> = [
  { name: 'binance', caps: { hasSpot: true, hasPerp: true, wsTrades: true, wsKlines: true, restOhlcv: true } },
  { name: 'bybit', caps: { hasSpot: true, hasPerp: true, wsTrades: true, wsKlines: true, restOhlcv: true } },
  { name: 'okx', caps: { hasSpot: true, hasPerp: true, wsTrades: true, wsKlines: true, restOhlcv: true } },
  { name: 'kucoin', caps: { hasSpot: true, hasPerp: false, wsTrades: true, wsKlines: true, restOhlcv: true } },
  { name: 'kraken', caps: { hasSpot: true, hasPerp: false, wsTrades: true, wsKlines: false, restOhlcv: true } },
  { name: 'coinbase', caps: { hasSpot: true, hasPerp: false, wsTrades: true, wsKlines: false, restOhlcv: true } },
  { name: 'bitfinex', caps: { hasSpot: true, hasPerp: false, wsTrades: true, wsKlines: false, restOhlcv: true } },
  { name: 'bitstamp', caps: { hasSpot: true, hasPerp: false, wsTrades: true, wsKlines: false, restOhlcv: true } },
  { name: 'gate', caps: { hasSpot: true, hasPerp: true, wsTrades: true, wsKlines: true, restOhlcv: true } },
  { name: 'mexc', caps: { hasSpot: true, hasPerp: true, wsTrades: true, wsKlines: true, restOhlcv: true } },
  { name: 'htx', caps: { hasSpot: true, hasPerp: true, wsTrades: true, wsKlines: true, restOhlcv: true } },
  { name: 'cryptocom', caps: { hasSpot: true, hasPerp: false, wsTrades: true, wsKlines: false, restOhlcv: true } },
  { name: 'gemini', caps: { hasSpot: true, hasPerp: false, wsTrades: true, wsKlines: false, restOhlcv: true } },
  { name: 'upbit', caps: { hasSpot: true, hasPerp: false, wsTrades: true, wsKlines: false, restOhlcv: true } },
  { name: 'bitget', caps: { hasSpot: true, hasPerp: true, wsTrades: true, wsKlines: true, restOhlcv: true } },
  { name: 'phemex', caps: { hasSpot: true, hasPerp: true, wsTrades: true, wsKlines: true, restOhlcv: true } },
  { name: 'hyperliquid', caps: { hasSpot: false, hasPerp: true, wsTrades: true, wsKlines: true, restOhlcv: false } },
  { name: 'dydx', caps: { hasSpot: false, hasPerp: true, wsTrades: true, wsKlines: true, restOhlcv: false } },
  { name: 'bitmex', caps: { hasSpot: false, hasPerp: true, wsTrades: true, wsKlines: true, restOhlcv: true } },
  { name: 'deribit', caps: { hasSpot: false, hasPerp: true, wsTrades: true, wsKlines: true, restOhlcv: true } },
];

class StubVenueProvider extends BaseVenueProvider implements VenueProvider {
  readonly name: string;
  capabilities: VenueCapabilities;
  constructor(name: string, caps: VenueCapabilities) {
    super();
    this.name = name;
    this.capabilities = caps;
  }
  async fetchMarkets(): Promise<VenueMarket[]> {
    // TODO: replace with real venue-specific fetchMarkets implementations
    return [];
  }
}

export const venueProviders: VenueProvider[] = VENUE_DEFS.map((def) => new StubVenueProvider(def.name, def.caps));
