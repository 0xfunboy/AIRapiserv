import { TokenRepository, TokenVenueRecord } from '@airapiserv/storage';
import { selectPrioritySource } from '@airapiserv/core';

const SOURCE_MAPPING: Record<string, string> = {
  binance: 'BINANCE_WS',
  bybit: 'BYBIT_WS',
  okx: 'OKX_WS',
  kucoin: 'KUCOIN_WS',
  kraken: 'KRAKEN_WS',
  coinbase: 'COINBASE_WS',
  bitfinex: 'BITFINEX_WS',
  bitstamp: 'BITSTAMP_WS',
  gate: 'GATE_WS',
  mexc: 'MEXC_WS',
  htx: 'HTX_WS',
  cryptocom: 'CRYPTOCOM_WS',
  gemini: 'GEMINI_WS',
  upbit: 'UPBIT_WS',
  bitget: 'BITGET_WS',
  phemex: 'PHEMEX_WS',
  hyperliquid: 'HYPERLIQUID_WS',
  dydx: 'DYDX_WS',
  bitmex: 'BITMEX_WS',
  deribit: 'DERIBIT_WS',
};

export class TokenDirectoryService {
  private readonly repo = new TokenRepository();
  private readonly logger: any;
  constructor(logger?: any) {
    this.logger = logger?.child ? logger.child({ name: 'token-directory' }) : console;
  }

  async search(q: string, limit = 50) {
    return this.repo.searchTokens(q, limit);
  }

  async getVenues(tokenId: string) {
    return this.repo.getVenues(tokenId);
  }

  async getOhlcv(params: { tokenId: string; timeframe: string; from?: number; to?: number; limit?: number }) {
    return this.repo.getCandles(params.tokenId, params.timeframe, params.from, params.to, params.limit ?? 200);
  }

  async updatePrioritySource(tokenId: string, venues: TokenVenueRecord[]) {
    const sources = venues
      .map((v) => SOURCE_MAPPING[v.venue.toLowerCase()] || null)
      .filter((s): s is string => Boolean(s));
    const best = selectPrioritySource(sources);
    if (best) {
      await this.repo.upsertTokens([{ tokenId, prioritySource: best }]);
      this.logger.info?.({ tokenId, prioritySource: best }, 'priority source updated');
    }
  }
}
