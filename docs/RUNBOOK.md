# Runbook

## Local bootstrap

1. Provision Redis (6379), ClickHouse (8123) and Postgres (5432). The wizard (`pnpm project:setup`) can install and start them automatically on Debian/Ubuntu hosts via apt-get/systemd.
2. `pnpm project:setup` → interactive wizard that generates `.env`, configures ports/credentials, verifies connectivity and (optionally) installs the databases.
3. `pnpm install`
4. `pnpm run` (executes `db:up` + `dev`. `db:up` just reminds you to keep the databases running).
5. Check http://localhost:3333/v1/health and http://localhost:4000.

## Services

| Service | Port | Script |
| --- | --- | --- |
| Ingestors | - | `pnpm ingest:run` |
| API REST/WS | 3333 | `pnpm --filter api dev` |
| WebGUI | 3000/4000 | `pnpm --filter web dev` |
| Redis | 6379 | External (bare metal / managed)
| ClickHouse | 8123/9000 | External |
| Postgres | 5432 | External |

## Suggested deploy

1. Build: `pnpm build` (all packages + Next).
2. Runtime: use PM2/systemd for `packages/api` and `packages/ingestors`. The Web build can run via Next standalone or a container.
3. Databases: prefer managed services (Elasticache, ClickHouse Cloud, RDS) or manually managed instances. Docker Compose remains optional for local dev.

## Monitoring

- Redis: `health:storage` TTL key set by ingestion.
- API: `/v1/health` and Pino logs.
- WS: expose lag metrics (TODO: `/metrics` Prometheus exporter).

## Incident response

1. **Provider down** → update routing policy (override) or disable the connector with env vars.
2. **High lag** → reduce active markets via `BINANCE_SYMBOLS`/`BYBIT_SYMBOLS`, inspect CPU/network.
3. **Fallback exhaustion** → review CryptoCompare counters; the enforced 5m poll interval should protect the quota but disable with `ENABLE_CRYPTOCOMPARE_FALLBACK=false` if needed.

## Migrations

- `pnpm db:migrate` creates/updates tables. The script is idempotent thanks to `create table if not exists`.
- Add new DDL statements in the script or break them into SQL files (future Drizzle/sqitch integration).
