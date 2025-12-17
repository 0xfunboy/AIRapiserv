# Runbook

## Local bootstrap

The simplest path is a single command:

```bash
./start
```

`./start` will guide you through missing prerequisites, verify database connectivity, run migrations, and launch the dev stack.

If you want to run the installer directly:

```bash
./setup
```

## Manual database installation (Ubuntu/Debian)

If the wizard is not used, install Redis/Postgres and ClickHouse manually with the keyserver method (the direct GPG URL may return 403):

```bash
sudo apt-get update
sudo apt-get install -y redis-server postgresql
sudo apt-get install -y apt-transport-https ca-certificates curl gnupg
sudo mkdir -p /usr/share/keyrings
sudo gpg --keyserver keyserver.ubuntu.com --recv-keys 3E4AD4719DDE9A38
sudo gpg --export 3E4AD4719DDE9A38 | sudo gpg --dearmor -o /usr/share/keyrings/clickhouse.gpg
echo "deb [signed-by=/usr/share/keyrings/clickhouse.gpg] https://packages.clickhouse.com/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/clickhouse.list
sudo apt-get update
sudo apt-get install -y clickhouse-server clickhouse-client
sudo systemctl enable --now redis-server postgresql clickhouse-server
```

Verify:

```bash
redis-cli ping
curl -s http://127.0.0.1:8123/ping
sudo -u postgres psql -c "select 1;"
```

## Postgres credential reset

If `pnpm db:migrate` fails with `password authentication failed`, align the Postgres user with the `.env` values:

```bash
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER airapiserv WITH PASSWORD 'airapiserv';"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE airapiserv OWNER airapiserv;"
```

`./start` will prompt to reset the credentials automatically if it detects a mismatch.

## Services

| Service | Port | Script |
| --- | --- | --- |
| Ingestors | - | `pnpm ingest:run` |
| API REST/WS | 3333 | `pnpm --filter api dev` |
| WebGUI | 3000/4000 | `pnpm --filter web dev` |
| Redis | 6379 | External (bare metal / managed) |
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
