import { fetch } from 'undici';
import { BaseConnector } from './baseConnector.js';
import { TickerEvent } from '@airapiserv/core';

const interval = Number(process.env.FALLBACK_POLL_INTERVAL_MS ?? 300_000);
const DEFAULT_FALLBACK_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE'];

const parseSymbolList = (raw?: string) => {
  if (!raw) return DEFAULT_FALLBACK_SYMBOLS;
  const parsed = raw
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
  return parsed.length ? parsed : DEFAULT_FALLBACK_SYMBOLS;
};

const parseCoinGeckoIds = () => {
  const raw = process.env.COINGECKO_IDS ?? '';
  const ids: Record<string, string> = {};
  raw
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const [symbol, id] = pair.split(':').map((value) => value.trim());
      if (symbol && id) {
        ids[symbol.toUpperCase()] = id;
      }
    });

  if (Object.keys(ids).length) return ids;

  return {
    BTC: 'bitcoin',
    ETH: 'ethereum',
  };
};

export class CoinGeckoFallbackConnector extends BaseConnector {
  private timer?: NodeJS.Timeout;

  async start() {
    this.logger.info('Starting CoinGecko fallback polling');
    await this.poll();
    this.timer = setInterval(() => this.poll(), interval);
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async poll() {
    const apiKey = process.env.COINGECKO_API_KEY ?? '';
    const useMarkets = process.env.COINGECKO_MARKETS_FALLBACK !== 'false';

    if (useMarkets) {
      try {
        await this.pollMarkets(apiKey);
        return;
      } catch (err) {
        this.logger.error({ err }, 'CoinGecko markets polling failed, falling back to simple price');
      }
    }

    try {
      await this.pollSimple(apiKey);
    } catch (err) {
      this.logger.error({ err }, 'CoinGecko fallback failed');
    }
  }

  private async pollMarkets(apiKey: string) {
    const limit = Number(process.env.COINGECKO_MARKETS_LIMIT ?? 100);
    const vsCurrency = (process.env.COINGECKO_MARKETS_VS ?? 'usd').toLowerCase();
    const quote = (process.env.COINGECKO_MARKETS_QUOTE ?? vsCurrency).toUpperCase();
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${vsCurrency}&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false`;
    const res = await fetch(url, {
      headers: apiKey ? { 'x-cg-pro-api-key': apiKey } : undefined,
    });
    if (!res.ok) {
      throw new Error(`CoinGecko error ${res.status}`);
    }

    const rows = (await res.json()) as Array<{ symbol: string; current_price: number | null }>;
    let emitted = 0;
    rows.forEach((entry) => {
      const symbol = entry.symbol?.toUpperCase();
      if (!symbol || entry.current_price === null || entry.current_price === undefined) return;
      const event: TickerEvent = {
        kind: 'ticker',
        timestamp: Date.now(),
        marketId: `coingecko:${symbol}${quote}:spot`,
        last: Number(entry.current_price),
        source: 'coingecko',
      };
      emitted += 1;
      this.emitEvent(event);
    });
    this.logger.info({ count: emitted, limit, vsCurrency }, 'CoinGecko markets snapshot updated');
  }

  private async pollSimple(apiKey: string) {
    const idsMap = parseCoinGeckoIds();
    const ids = Object.values(idsMap).join(',');
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`, {
      headers: apiKey ? { 'x-cg-pro-api-key': apiKey } : undefined,
    });
    if (!res.ok) {
      throw new Error(`CoinGecko error ${res.status}`);
    }
    const body = (await res.json()) as Record<string, { usd: number }>;
    const quote = (process.env.COINGECKO_SIMPLE_QUOTE ?? 'USD').toUpperCase();
    Object.entries(idsMap).forEach(([symbol, coingeckoId]) => {
      const value = body[coingeckoId];
      if (!value) return;
      const event: TickerEvent = {
        kind: 'ticker',
        timestamp: Date.now(),
        marketId: `coingecko:${symbol}${quote}:spot`,
        last: value.usd,
        source: 'coingecko',
      };
      this.emitEvent(event);
    });
  }
}

export class CryptoCompareFallbackConnector extends BaseConnector {
  private timer?: NodeJS.Timeout;
  private readonly pairs = parseSymbolList(process.env.CRYPTOCOMPARE_SYMBOLS ?? process.env.FALLBACK_SYMBOLS);

  async start() {
    this.logger.info('Starting CryptoCompare fallback polling');
    await this.poll();
    this.timer = setInterval(() => this.poll(), interval);
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async poll() {
    try {
      const apiKey = process.env.CRYPTOCOMPARE_API_KEY ?? '';
      const res = await fetch(`https://min-api.cryptocompare.com/data/pricemulti?fsyms=${this.pairs.join(',')}&tsyms=USD`, {
        headers: apiKey ? { Authorization: `Apikey ${apiKey}` } : undefined,
      });
      if (!res.ok) {
        throw new Error(`CryptoCompare error ${res.status}`);
      }
      const body = (await res.json()) as Record<string, { USD: number }>;
      let emitted = 0;
      this.pairs.forEach((symbol) => {
        const price = body[symbol]?.USD;
        if (!price) return;
        const event: TickerEvent = {
          kind: 'ticker',
          timestamp: Date.now(),
          marketId: `cryptocompare:${symbol}USD:spot`,
          last: price,
          source: 'cryptocompare',
        };
        emitted += 1;
        this.emitEvent(event);
      });
      this.logger.info({ count: emitted, symbols: this.pairs.length }, 'CryptoCompare snapshot updated');
    } catch (err) {
      this.logger.error({ err }, 'CryptoCompare fallback failed');
    }
  }
}
