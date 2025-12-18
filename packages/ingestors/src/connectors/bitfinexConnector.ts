import WebSocket from 'ws';
import { BaseConnector } from './baseConnector.js';
import { TradeEvent } from '@airapiserv/core';

const DEFAULT_SYMBOLS = ['tBTCUSD', 'tETHUSD'];

export class BitfinexConnector extends BaseConnector {
  private stream?: WebSocket;
  private readonly symbols: string[];
  private channelToSymbol = new Map<number, string>();

  constructor(symbols?: string[]) {
    super();
    this.symbols = symbols ?? process.env.BITFINEX_SYMBOLS?.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) ?? DEFAULT_SYMBOLS;
  }

  async start() {
    const url = process.env.BITFINEX_WS_URL ?? 'wss://api-pub.bitfinex.com/ws/2';
    this.stream = new WebSocket(url);
    this.stream.on('open', () => {
      this.logger.info({ symbols: this.symbols }, 'Bitfinex WS connected');
      this.symbols.forEach((symbol) => {
        this.stream?.send(JSON.stringify({ event: 'subscribe', channel: 'trades', symbol }));
      });
    });
    this.stream.on('message', (raw) => this.handleMessage(raw.toString()));
    this.stream.on('error', (err) => this.logger.error({ err }, 'Bitfinex WS error'));
    this.stream.on('close', () => this.logger.warn('Bitfinex WS disconnected'));
  }

  async stop() {
    this.stream?.terminate();
    this.stream = undefined;
    this.channelToSymbol.clear();
  }

  private handleMessage(payload: string) {
    try {
      const data = JSON.parse(payload);
      if (data.event === 'subscribed' && data.chanId && data.symbol) {
        this.channelToSymbol.set(Number(data.chanId), data.symbol);
        return;
      }
      if (!Array.isArray(data) || data.length < 2) return;
      const [chanId, body] = data;
      const symbol = this.channelToSymbol.get(Number(chanId));
      if (!symbol) return;
      if (!Array.isArray(body)) return;
      const trades = body[0] === 'tu' || body[0] === 'te' ? [body.slice(1)] : body; // snapshot vs update
      for (const trade of trades as any[]) {
        if (!Array.isArray(trade) || trade.length < 4) continue;
        const [id, mts, amount, price] = trade;
        const event: TradeEvent = {
          kind: 'trade',
          timestamp: Number(mts),
          marketId: `bitfinex:${symbol.replace('t', '')}:spot`,
          price: Number(price),
          size: Math.abs(Number(amount)),
          side: Number(amount) >= 0 ? 'buy' : 'sell',
          tradeId: id?.toString(),
          source: 'bitfinex',
        };
        this.emitEvent(event);
      }
    } catch (err) {
      this.logger.error({ err }, 'Failed to parse Bitfinex payload');
    }
  }
}
