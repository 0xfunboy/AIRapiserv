import WebSocket from 'ws';
import { BaseConnector } from './baseConnector.js';
import { TradeEvent } from '@airapiserv/core';

const DEFAULT_SYMBOLS = ['BTC-USDT', 'ETH-USDT'];

export class OkxConnector extends BaseConnector {
  private stream?: WebSocket;
  private readonly symbols: string[];

  constructor(symbols?: string[]) {
    super();
    this.symbols = symbols ?? process.env.OKX_SYMBOLS?.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) ?? DEFAULT_SYMBOLS;
  }

  async start() {
    const url = process.env.OKX_WS_URL ?? 'wss://ws.okx.com:8443/ws/v5/public';
    this.stream = new WebSocket(url);
    this.stream.on('open', () => {
      this.logger.info({ symbols: this.symbols }, 'OKX WS connected');
      this.stream?.send(
        JSON.stringify({
          op: 'subscribe',
          args: this.symbols.map((s) => ({ channel: 'trades', instId: s })),
        })
      );
    });
    this.stream.on('message', (raw) => this.handleMessage(raw.toString()));
    this.stream.on('close', () => this.logger.warn('OKX WS disconnected'));
    this.stream.on('error', (err) => this.logger.error({ err }, 'OKX WS error'));
  }

  async stop() {
    this.stream?.terminate();
    this.stream = undefined;
  }

  private handleMessage(payload: string) {
    try {
      const data = JSON.parse(payload);
      if (data.arg?.channel === 'trades') {
        const instId = data.arg.instId as string;
        const trades = data.data ?? [];
        for (const trade of trades) {
          const event: TradeEvent = {
            kind: 'trade',
            timestamp: Number(trade.ts),
            marketId: `okx:${instId}:spot`,
            price: Number(trade.px),
            size: Number(trade.sz),
            side: (trade.side ?? 'buy') === 'buy' ? 'buy' : 'sell',
            tradeId: trade.tradeId?.toString(),
            source: 'okx',
          };
          this.emitEvent(event);
        }
      }
    } catch (err) {
      this.logger.error({ err }, 'Failed to parse OKX payload');
    }
  }
}
