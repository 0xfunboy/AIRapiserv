import WebSocket from 'ws';
import { BaseConnector } from './baseConnector.js';
import { TradeEvent } from '@airapiserv/core';

const DEFAULT_SYMBOLS = ['BTC-USD', 'ETH-USD'];

export class CoinbaseConnector extends BaseConnector {
  private stream?: WebSocket;
  private readonly symbols: string[];

  constructor(symbols?: string[]) {
    super();
    this.symbols = symbols ?? process.env.COINBASE_SYMBOLS?.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) ?? DEFAULT_SYMBOLS;
  }

  async start() {
    const url = process.env.COINBASE_WS_URL ?? 'wss://ws-feed.exchange.coinbase.com';
    this.stream = new WebSocket(url);
    this.stream.on('open', () => {
      this.logger.info({ symbols: this.symbols }, 'Coinbase WS connected');
      this.stream?.send(
        JSON.stringify({
          type: 'subscribe',
          product_ids: this.symbols,
          channels: ['matches'],
        })
      );
    });
    this.stream.on('message', (raw) => this.handleMessage(raw.toString()));
    this.stream.on('error', (err) => this.logger.error({ err }, 'Coinbase WS error'));
    this.stream.on('close', () => this.logger.warn('Coinbase WS disconnected'));
  }

  async stop() {
    this.stream?.terminate();
    this.stream = undefined;
  }

  private handleMessage(payload: string) {
    try {
      const data = JSON.parse(payload);
      if (data.type !== 'match') return;
      const symbol = data.product_id as string;
      const event: TradeEvent = {
        kind: 'trade',
        timestamp: new Date(data.time).getTime(),
        marketId: `coinbase:${symbol}:spot`,
        price: Number(data.price),
        size: Number(data.size),
        side: data.side === 'buy' ? 'buy' : 'sell',
        tradeId: data.trade_id?.toString(),
        source: 'coinbase',
      };
      this.emitEvent(event);
    } catch (err) {
      this.logger.error({ err }, 'Failed to parse Coinbase payload');
    }
  }
}
