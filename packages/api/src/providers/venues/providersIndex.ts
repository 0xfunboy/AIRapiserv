import { VenueProvider, VenueCapabilities, VenueMarket } from '@airapiserv/core';
import { BaseVenueProvider } from './baseVenueProvider.js';
import { BinanceVenueProvider } from './binanceVenueProvider.js';
import { BybitVenueProvider } from './bybitVenueProvider.js';
import { OkxVenueProvider } from './okxVenueProvider.js';
import { KrakenVenueProvider } from './krakenVenueProvider.js';
import { CoinbaseVenueProvider } from './coinbaseVenueProvider.js';
import { KucoinVenueProvider } from './kucoinVenueProvider.js';
import { GateVenueProvider } from './gateVenueProvider.js';
import { BitfinexVenueProvider } from './bitfinexVenueProvider.js';
import { BitstampVenueProvider } from './bitstampVenueProvider.js';
import { MexcVenueProvider } from './mexcVenueProvider.js';
import { HtxVenueProvider } from './htxVenueProvider.js';
import { CryptoComVenueProvider } from './cryptocomVenueProvider.js';
import { GeminiVenueProvider } from './geminiVenueProvider.js';
import { UpbitVenueProvider } from './upbitVenueProvider.js';
import { BitgetVenueProvider } from './bitgetVenueProvider.js';
import { PhemexVenueProvider } from './phemexVenueProvider.js';
import { HyperliquidVenueProvider } from './hyperliquidVenueProvider.js';
import { DydxVenueProvider } from './dydxVenueProvider.js';
import { BitmexVenueProvider } from './bitmexVenueProvider.js';
import { DeribitVenueProvider } from './deribitVenueProvider.js';

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
export const venueProvidersWithReal: VenueProvider[] = [
  new BinanceVenueProvider(),
  new BybitVenueProvider(),
  new OkxVenueProvider(),
  new KrakenVenueProvider(),
  new CoinbaseVenueProvider(),
  new KucoinVenueProvider(),
  new GateVenueProvider(),
  new BitfinexVenueProvider(),
  new BitstampVenueProvider(),
  new MexcVenueProvider(),
  new HtxVenueProvider(),
  new CryptoComVenueProvider(),
  new GeminiVenueProvider(),
  new UpbitVenueProvider(),
  new BitgetVenueProvider(),
  new PhemexVenueProvider(),
  new HyperliquidVenueProvider(),
  new DydxVenueProvider(),
  new BitmexVenueProvider(),
  new DeribitVenueProvider(),
  ...VENUE_DEFS.filter((d) =>
    [
      'binance',
      'bybit',
      'okx',
      'kraken',
      'coinbase',
      'kucoin',
      'gate',
      'bitfinex',
      'bitstamp',
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
    ].includes(d.name)
      ? false
      : true
  ).map(
    (def) => new StubVenueProvider(def.name, def.caps)
  ),
];
