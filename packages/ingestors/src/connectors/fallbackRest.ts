import { fetch } from 'undici';
import { BaseConnector } from './baseConnector.js';
import { TickerEvent } from '@airapiserv/core';

const interval = Number(process.env.FALLBACK_POLL_INTERVAL_MS ?? 300_000);

export class CoinGeckoFallbackConnector extends BaseConnector {
  private timer?: NodeJS.Timeout;
  private readonly ids: Record<string, string> = {
    BTCUSDT: 'bitcoin',
    ETHUSDT: 'ethereum',
  };

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
    try {
      const ids = Object.values(this.ids).join(',');
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
      if (!res.ok) {
        throw new Error(`CoinGecko error ${res.status}`);
      }
      const body = (await res.json()) as Record<string, { usd: number }>;
      Object.entries(this.ids).forEach(([marketSymbol, coingeckoId]) => {
        const value = body[coingeckoId];
        if (!value) return;
        const event: TickerEvent = {
          kind: 'ticker',
          timestamp: Date.now(),
          marketId: `coingecko:${marketSymbol}:spot`,
          last: value.usd,
          source: 'coingecko',
        };
        this.emitEvent(event);
      });
    } catch (err) {
      this.logger.error({ err }, 'CoinGecko fallback failed');
    }
  }
}

export class CryptoCompareFallbackConnector extends BaseConnector {
  private timer?: NodeJS.Timeout;
  private readonly pairs = ['BTC', 'ETH'];

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
        this.emitEvent(event);
      });
    } catch (err) {
      this.logger.error({ err }, 'CryptoCompare fallback failed');
    }
  }
}
