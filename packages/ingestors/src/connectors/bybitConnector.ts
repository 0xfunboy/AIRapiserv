import WebSocket from 'ws';
import { BaseConnector } from './baseConnector.js';
import { TradeEvent, TickerEvent } from '@airapiserv/core';

const DEFAULT_SYMBOLS = ['BTCUSDT'];

export class BybitConnector extends BaseConnector {
  private stream?: WebSocket;
  private readonly symbols: string[];

  constructor(symbols?: string[]) {
    super();
    this.symbols = symbols ?? process.env.BYBIT_SYMBOLS?.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) ?? DEFAULT_SYMBOLS;
  }

  async start() {
    const url = process.env.BYBIT_WS_URL ?? 'wss://stream.bybit.com/v5/public/spot';
    this.stream = new WebSocket(url);
    this.stream.on('open', () => {
      this.logger.info({ symbols: this.symbols }, 'Bybit WS connected');
      this.stream?.send(
        JSON.stringify({
          op: 'subscribe',
          args: [
            ...this.symbols.map((symbol) => `publicTrade.${symbol}`),
            ...this.symbols.map((symbol) => `tickers.${symbol}`),
          ],
        })
      );
    });

    this.stream.on('message', (raw) => this.handleMessage(raw.toString()));
    this.stream.on('error', (err) => this.logger.error({ err }, 'Bybit WS error'));
    this.stream.on('close', () => this.logger.warn('Bybit WS disconnected'));
  }

  async stop() {
    this.stream?.terminate();
    this.stream = undefined;
  }

  private handleMessage(payload: string) {
    try {
      const data = JSON.parse(payload);
      if (data.topic?.startsWith('publicTrade')) {
        const [, symbol] = data.topic.split('.');
        const trade = data.data?.[0];
        if (!trade) return;
        const event: TradeEvent = {
          kind: 'trade',
          timestamp: Number(trade.T),
          marketId: `bybit:${symbol}:spot`,
          price: Number(trade.p),
          size: Number(trade.v),
          side: trade.S?.toLowerCase() === 'buy' ? 'buy' : 'sell',
          tradeId: trade.i?.toString(),
          source: 'bybit',
        };
        this.emitEvent(event);
      } else if (data.topic?.startsWith('tickers')) {
        const [, symbol] = data.topic.split('.');
        const tickerPayload = data.data?.[0] ?? data.data;
        if (!tickerPayload) return;
        const ticker: TickerEvent = {
          kind: 'ticker',
          timestamp: Number(tickerPayload.ts) || Date.now(),
          marketId: `bybit:${symbol}:spot`,
          last: Number(tickerPayload.lastPrice),
          mark: Number(tickerPayload.markPrice ?? tickerPayload.lastPrice),
          bestBid: Number(tickerPayload.bid1Price),
          bestAsk: Number(tickerPayload.ask1Price),
          source: 'bybit',
        };
        this.emitEvent(ticker);
      }
    } catch (err) {
      this.logger.error({ err }, 'Failed to parse Bybit payload');
    }
  }
}
