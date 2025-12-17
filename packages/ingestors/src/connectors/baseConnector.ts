import EventEmitter from 'eventemitter3';
import pino from 'pino';
import { MarketEvent } from '@airapiserv/core';

export interface MarketConnector extends EventEmitter {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export abstract class BaseConnector extends EventEmitter implements MarketConnector {
  protected readonly logger = pino({ name: this.constructor.name });

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;

  protected emitEvent(event: MarketEvent) {
    this.emit('event', event);
  }
}
