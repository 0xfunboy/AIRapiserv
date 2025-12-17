import WebSocket from 'ws';
import { BaseConnector } from './baseConnector.js';
import { TradeEvent, TickerEvent } from '@airapiserv/core';

const DEFAULT_SYMBOLS = ['btcusdt', 'ethusdt'];

export class BinanceSpotConnector extends BaseConnector {
  private stream?: WebSocket;
  private readonly symbols: string[];

  constructor(symbols?: string[]) {
    super();
    this.symbols = symbols ?? process.env.BINANCE_SYMBOLS?.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) ?? DEFAULT_SYMBOLS;
  }

  async start() {
    const url = process.env.BINANCE_WS_URL ?? 'wss://stream.binance.com:9443/ws';
    const streams = this.symbols.flatMap((symbol) => [`${symbol}@trade`, `${symbol}@ticker`]);
    const streamName = streams.join('/');
    this.stream = new WebSocket(`${url}/${streamName}`);

    this.stream.on('open', () => this.logger.info({ symbols: this.symbols }, 'Binance WS connected'));
    this.stream.on('close', () => this.logger.warn('Binance WS disconnected'));
    this.stream.on('error', (err) => this.logger.error({ err }, 'Binance WS error'));
    this.stream.on('message', (raw) => this.handleMessage(raw.toString()));
  }

  async stop() {
    this.stream?.terminate();
    this.stream = undefined;
  }

  private handleMessage(payload: string) {
    try {
      const data = JSON.parse(payload);
      if (data.e === 'trade') {
        const event: TradeEvent = {
          kind: 'trade',
          timestamp: data.T,
          marketId: `binance:${data.s}:spot`,
          price: Number(data.p),
          size: Number(data.q),
          side: data.m ? 'sell' : 'buy',
          tradeId: data.t?.toString(),
          source: 'binance',
        };
        this.emitEvent(event);
      } else if (data.e === '24hrTicker') {
        const ticker: TickerEvent = {
          kind: 'ticker',
          timestamp: Date.now(),
          marketId: `binance:${data.s}:spot`,
          last: Number(data.c),
          mark: Number(data.w),
          bestBid: Number(data.b),
          bestAsk: Number(data.a),
          source: 'binance',
        };
        this.emitEvent(ticker);
      }
    } catch (err) {
      this.logger.error({ err }, 'Failed to parse Binance payload');
    }
  }
}
