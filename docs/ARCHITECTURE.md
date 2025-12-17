# AIRapiserv Architecture

## Overview

AIRapiserv is a Node 23 / TypeScript monorepo that delivers a unified market-data gateway for AIRTrack. It is composed of five main layers:

1. **Ingestion layer (`packages/ingestors`)**
   - WebSocket connectors for the top venues (Binance, Bybit) plus throttled REST fallback (CoinGecko, CryptoCompare).
   - Normalises every message into shared `MarketEvent` objects and forwards them to the storage layer.
   - Generates 1s/5s rolling candles directly from the trade streams.
2. **Core (`packages/core`)**
   - Shared domain types, provider selection policy, retention defaults and the symbol/contract resolver.
   - Supports manual overrides to disambiguate duplicate tickers or contract addresses.
3. **Storage layer (`packages/storage`)**
   - Reusable clients for Redis (DB1 cache), ClickHouse (DB2 time-series) and Postgres (DB3 catalogue + audit).
   - `pnpm db:migrate` is idempotent and creates the foundational tables (assets, markets, audit, candles_1s).
4. **API layer (`packages/api`)**
   - Fastify REST + WebSocket server exposing `/v1` endpoints and the `/v1/ws` subscription endpoint.
   - Implements CORS, JWT, rate limiting, health checks and bridges requests to storage/resolver services.
5. **WebGUI (`packages/web`)**
   - Next.js app router with Dashboard, Assets, Markets, Charts, Compare and Admin views.
   - Uses the same API endpoints to surface live metrics and manual override tooling.

## Data flow

```
Provider WS  ─▶  Connector  ─▶  Event Normaliser  ─▶  Redis / ClickHouse / Postgres
                                         │
                                         └▶ Rolling Candle Engine ─▶ ClickHouse

API /v1 ─▶ MarketService (resolver + storage) ─▶ unified responses
WebGUI   ─▶ Next.js fetch/WS ─▶ API gateway
```

## Multi-DB storage

| DB | Technology | Role | Content |
| --- | --- | --- | --- |
| DB1 | Redis | Realtime cache & fan-out | last price, ticker stats, recent trades, lag metrics |
| DB2 | ClickHouse | High-volume time-series | trades, generated candles (1s/5s/1m), order-book snapshots |
| DB3 | Postgres | Catalogue + metadata | asset master, ticker mappings, provider coverage, audit events |

## Extensibility

- Add a provider by creating a connector inside `packages/ingestors/src/connectors` that emits `MarketEvent`s.
- Add new API requests by extending `MarketService` and registering routes in `routes/v1.ts`.
- Expand the WebGUI by adding pages/components under `packages/web/app`.

## Run command

Run `pnpm project:setup` first to generate `.env` and, optionally, install/start Redis/ClickHouse/Postgres on Debian/Ubuntu via apt-get/systemd. Afterwards `pnpm run` = `pnpm db:up && pnpm dev`. `db:up` simply reminds you to keep the databases running (compose file is optional). Once the DBs are ready, `pnpm dev` launches ingest workers, API and WebGUI in watch mode.
