const RANKING = [
  'BINANCE_WS',
  'BYBIT_WS',
  'OKX_WS',
  'KUCOIN_WS',
  'KRAKEN_WS',
  'COINBASE_WS',
  'BITFINEX_WS',
  'BITSTAMP_WS',
  'GATE_WS',
  'MEXC_WS',
  'HTX_WS',
  'CRYPTOCOM_WS',
  'GEMINI_WS',
  'UPBIT_WS',
  'BITGET_WS',
  'PHEMEX_WS',
  'HYPERLIQUID_WS',
  'DYDX_WS',
  'BITMEX_WS',
  'DERIBIT_WS',
  'REST_EXCHANGE',
  'API_FALLBACK',
];

export const sourceRanking = RANKING;

export function selectPrioritySource(available: string[]) {
  for (const candidate of RANKING) {
    if (available.includes(candidate)) {
      return candidate;
    }
  }
  return null;
}
