# AIRapiserv

AIRapiserv is the market-data gateway consumed by AIRTrack. It exposes a stable REST/WebSocket interface while orchestrating multiple providers, normalising events and persisting them in three specialised databases.

## Quick start

1. Provision Redis (6379), ClickHouse (8123) and Postgres (5432) locally or on managed services. If they are not installed on the host, the wizard can install and start them for you (apt-get + systemd).
2. Run the interactive setup wizard to create `.env`, collect credentials and optionally install/start the services:

   ```bash
   pnpm project:setup
   ```

3. Install dependencies and launch the dev stack:

   ```bash
   pnpm install
   pnpm dev
   ```

`pnpm db:up` simply reminds you to start the external databases (the wizard can do it automatically). `pnpm run` still chains `db:up` + `dev` so that a single command can bootstrap the environment. It starts:

- ingestion workers (`packages/ingestors`)
- REST + WebSocket API (`packages/api`)
- WebGUI (`packages/web`)

## Monorepo structure

```
packages/
  api/        → Fastify REST/WS layer and routing
  core/       → shared types, routing policies, symbol resolver
  ingestors/  → provider connectors and ingestion orchestrator
  storage/    → Redis/ClickHouse/Postgres clients and migrations
  web/        → Next.js WebGUI (dashboard, search, admin)
```

Additional documentation lives in `docs/`:

- `ARCHITECTURE.md`
- `PROVIDERS.md`
- `API.md`
- `SCHEMA.md`
- `SECURITY.md`
- `RUNBOOK.md`

## Scripts

| Script | Description |
| --- | --- |
| `pnpm project:setup` | Text wizard that generates `.env`, captures credentials, optionally installs the databases and verifies connectivity |
| `pnpm dev` | Starts API, ingestors and WebGUI in development mode | 
| `pnpm build` | Builds every package | 
| `pnpm start` | Launches only the API (after `pnpm build`) |
| `pnpm db:up` | Reminder to start Redis/ClickHouse/Postgres (wizard can provision them) |
| `pnpm db:migrate` | Runs the DDL in `packages/storage` |
| `pnpm ingest:run` | Starts ingestion workers only |
| `pnpm web:dev` | Starts the WebGUI only |

## Stack

- Node.js 23, TypeScript, pnpm workspaces
- Fastify, @fastify/websocket, zod
- Redis, ClickHouse, Postgres
- Next.js + React Query + Tailwind CSS
- WebSocket stream adapters for Binance, Bybit, plus CoinGecko / CryptoCompare fallback pollers

## Current capabilities

- Unified data model and shared types
- Symbol resolver with contract-address overrides and manual mappings
- First WebSocket connectors (Binance, Bybit) and throttled REST fallback (CoinGecko, CryptoCompare)
- REST/WS API exposing the AIRTrack contract
- WebGUI with dashboard, assets, markets, charts, compare and admin placeholders
- Operational docs for AIRTrack compatibility

### Setup wizard

`pnpm project:setup` walks the user through the entire configuration:

- asks for host/user/password for Redis/ClickHouse/Postgres;
- proposes defaults and generates the `JWT_SECRET` automatically;
- lets you enable/disable fallback providers and enforces poll intervals;
- writes the `.env` file and prints the next steps (e.g. `pnpm db:migrate`, `pnpm dev`);
- if requested, installs and starts Redis/ClickHouse/Postgres through `sudo apt-get install`, enables systemd units and creates Postgres role/database with the provided credentials;
- runs reachability checks and highlights actionable tips when a service is down.

With these safeguards AIRapiserv can be handed to customers that have zero operational experience.

## Production checklist

1. Store secrets in a vault (AWS SSM, Doppler, etc.).
2. Configure CI/CD and automated tests.
3. Harden security (TLS termination, WAF, RBAC).
4. Extend ingestion connectors (OKX, Coinbase, Kraken, etc.).
