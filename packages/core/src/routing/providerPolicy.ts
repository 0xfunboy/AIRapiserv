import { MarketType } from '../types/assets.js';
import { ProviderSource } from '../types/events.js';

type RequestType =
  | 'getLastPrice'
  | 'getTicker'
  | 'getOHLCV'
  | 'getTrades'
  | 'getOrderBook'
  | 'searchAssets'
  | 'resolveSymbol'
  | 'compareProviders'
  | 'health';

interface RoutingContext {
  marketType: MarketType;
  requestType: RequestType;
  supportsWs: boolean;
}

const wsPriority: ProviderSource[] = [
  'binance',
  'bybit',
  'okx',
  'coinbase',
  'kraken',
  'bitget',
  'kucoin',
  'hyperliquid',
  'paradex',
];

const fallbackPriority: ProviderSource[] = [
  'dexscreener',
  'coingecko',
  'coinmarketcap',
  'cryptocompare',
];

export function selectProvider(ctx: RoutingContext): ProviderSource[] {
  if (ctx.requestType === 'getLastPrice' || ctx.requestType === 'getTicker') {
    return ctx.supportsWs ? wsPriority : [...wsPriority, ...fallbackPriority];
  }

  if (ctx.requestType === 'getOHLCV') {
    if (ctx.marketType === 'perp') {
      return ['bybit', 'binance', 'hyperliquid', 'paradex', ...fallbackPriority];
    }
    return ['binance', 'okx', 'coinbase', ...fallbackPriority];
  }

  if (ctx.requestType === 'getTrades' || ctx.requestType === 'getOrderBook') {
    return ['binance', 'bybit', 'okx', 'kraken', 'coinbase'];
  }

  if (ctx.requestType === 'searchAssets' || ctx.requestType === 'resolveSymbol') {
    return ['dexscreener', 'coingecko', 'defillama', 'coinmarketcap'];
  }

  return [...wsPriority, ...fallbackPriority];
}
