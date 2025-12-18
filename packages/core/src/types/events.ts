export type ProviderSource =
  | 'binance'
  | 'bybit'
  | 'okx'
  | 'kraken'
  | 'coinbase'
  | 'bitfinex'
  | 'bitstamp'
  | 'gate'
  | 'mexc'
  | 'htx'
  | 'cryptocom'
  | 'gemini'
  | 'upbit'
  | 'bitget'
  | 'phemex'
  | 'kucoin'
  | 'hyperliquid'
  | 'dydx'
  | 'bitmex'
  | 'deribit'
  | 'paradex'
  | 'coingecko'
  | 'coinmarketcap'
  | 'cryptocompare'
  | 'dexscreener'
  | 'defillama';

export interface TradeEvent {
  kind: 'trade';
  timestamp: number;
  marketId: string;
  price: number;
  size: number;
  side: 'buy' | 'sell' | 'unknown';
  tradeId?: string;
  source: ProviderSource;
}

export interface TickerEvent {
  kind: 'ticker';
  timestamp: number;
  marketId: string;
  last: number;
  mark?: number;
  index?: number;
  bestBid?: number;
  bestAsk?: number;
  source: ProviderSource;
}

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBookEvent {
  kind: 'orderbook';
  timestamp: number;
  marketId: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  depthLevel: number;
  snapshot: boolean;
  source: ProviderSource;
}

export interface FundingEvent {
  kind: 'funding';
  timestamp: number;
  marketId: string;
  fundingRate: number;
  nextFundingTime?: number;
  openInterest?: number;
  source: ProviderSource;
}

export interface CandleEvent {
  kind: 'candle';
  startTs: number;
  intervalMs: number;
  marketId: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradesCount?: number;
  isFinal: boolean;
  source: ProviderSource;
  rolling?: boolean;
}

export type MarketEvent =
  | TradeEvent
  | TickerEvent
  | OrderBookEvent
  | FundingEvent
  | CandleEvent;
