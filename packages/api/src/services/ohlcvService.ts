import { TokenRepository, TokenVenueRecord, CandleRecord } from '@airapiserv/storage';

type Fetcher = (venueSymbol: string, venueInfo: TokenVenueRecord, timeframe: string, limit: number) => Promise<CandleRecord[]>;

const tfMs: Record<string, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
};

const binanceIntervals: Record<string, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' };
const okxIntervals: Record<string, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D' };
const gateIntervals: Record<string, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' };
const bybitIntervals: Record<string, string> = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': '1440' };

export class OhlcvService {
  private readonly tokens = new TokenRepository();
  private readonly logger: any;

  constructor(logger?: any) {
    this.logger = logger?.child ? logger.child({ name: 'ohlcv' }) : console;
  }

  async fetchAndStore(tokenId: string, timeframe: string, limit = 200) {
    const tf = tfMs[timeframe] ? timeframe : '1m';
    const token = await this.tokens.getToken(tokenId);
    if (!token?.symbol) return { candles: [], fetched: false };
    const venues = await this.tokens.getVenues(tokenId);
    if (!venues.length) return { candles: [], fetched: false };

    // prefer venues with wsSupported/rest support, keep first found
    const preferred = venues.sort((a, b) => Number(b.wsSupported) - Number(a.wsSupported));
    const venue = preferred[0];
    const fetcher = this.pickFetcher(venue.venue);
    if (!fetcher) return { candles: [], fetched: false };

    try {
      const candles = await fetcher(this.toVenueSymbol(venue), venue, tf, limit);
      if (candles.length) {
        await this.tokens.insertCandles(candles);
        return { candles, fetched: true };
      }
    } catch (err) {
      this.logger.error?.({ err, venue: venue.venue, tokenId }, 'ohlcv fetch failed');
    }
    return { candles: [], fetched: false };
  }

  private toVenueSymbol(v: TokenVenueRecord) {
    if (!v.baseSymbol || !v.quoteSymbol) return v.venueSymbol;
    switch (v.venue) {
      case 'okx':
        return `${v.baseSymbol}-${v.quoteSymbol}`;
      case 'coinbase':
      case 'bitfinex':
      case 'bitstamp':
        return `${v.baseSymbol}-${v.quoteSymbol}`;
      case 'gate':
        return `${v.baseSymbol}_${v.quoteSymbol}`;
      default:
        return `${v.baseSymbol}${v.quoteSymbol}`;
    }
  }

  private pickFetcher(venue: string): Fetcher | null {
    switch (venue) {
      case 'binance':
        return this.fetchBinance;
      case 'bybit':
        return this.fetchBybit;
      case 'okx':
        return this.fetchOkx;
      case 'gate':
        return this.fetchGate;
      default:
        return null;
    }
  }

  private fetchBinance: Fetcher = async (venueSymbol, _v, timeframe, limit) => {
    const interval = binanceIntervals[timeframe] ?? '1m';
    const url = `https://api.binance.com/api/v3/klines?symbol=${venueSymbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`binance klines ${res.status}`);
    const data = (await res.json()) as Array<[number, string, string, string, string, string]>;
    return data.map((c) => ({
      tokenId: _v.tokenId,
      venue: 'binance',
      timeframe,
      openTime: Number(c[0]),
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5]),
      source: 'REST_EXCHANGE',
    }));
  };

  private fetchBybit: Fetcher = async (venueSymbol, v, timeframe, limit) => {
    const interval = bybitIntervals[timeframe] ?? '1';
    const category = v.marketType === 'perp' ? 'linear' : 'spot';
    const url = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${venueSymbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`bybit klines ${res.status}`);
    const body = (await res.json()) as { result?: { list?: Array<[string, string, string, string, string, string]> } };
    return (body.result?.list ?? []).map((c) => ({
      tokenId: v.tokenId,
      venue: 'bybit',
      timeframe,
      openTime: Number(c[0]),
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5]),
      source: 'REST_EXCHANGE',
    }));
  };

  private fetchOkx: Fetcher = async (venueSymbol, v, timeframe, limit) => {
    const interval = okxIntervals[timeframe] ?? '1m';
    const url = `https://www.okx.com/api/v5/market/candles?instId=${venueSymbol}&bar=${interval}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`okx klines ${res.status}`);
    const body = (await res.json()) as { data?: Array<[string, string, string, string, string, string]> };
    return (body.data ?? []).map((c) => ({
      tokenId: v.tokenId,
      venue: 'okx',
      timeframe,
      openTime: Number(c[0]),
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5]),
      source: 'REST_EXCHANGE',
    }));
  };

  private fetchGate: Fetcher = async (venueSymbol, v, timeframe, limit) => {
    const interval = gateIntervals[timeframe] ?? '1m';
    const url = `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${venueSymbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`gate klines ${res.status}`);
    const body = (await res.json()) as Array<[string, string, string, string, string, string]>;
    return (body ?? []).map((c) => ({
      tokenId: v.tokenId,
      venue: 'gate',
      timeframe,
      openTime: Number(c[0]) * 1000,
      open: Number(c[3]),
      high: Number(c[2]),
      low: Number(c[4]),
      close: Number(c[1]),
      volume: Number(c[5]),
      source: 'REST_EXCHANGE',
    }));
  };
}
