# AIRapiserv

AIRapiserv is the market-data gateway consumed by AIRTrack. It exposes a stable REST/WebSocket interface while orchestrating multiple providers, normalising events and persisting them in three specialised databases.

## Quick start

The fastest path is a single command:

```bash
./start
```

`./start` will:
- prompt you to run the installer if `.env` is missing,
- install dependencies if needed,
- verify Redis/ClickHouse/Postgres connectivity,
- run migrations,
- launch the dev stack (API + ingestors + WebGUI).

If you prefer to run the installer directly:

```bash
./setup
```

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
| `./setup` | Interactive wizard that generates `.env`, captures credentials, optionally installs the databases and verifies connectivity |
| `./start` | One-command bootstrap: verifies DBs, runs migrations, starts the dev stack |
| `pnpm project:setup` | Same wizard as `./setup` (kept for pnpm users) |
| `pnpm dev` | Starts API, ingestors and WebGUI in development mode | 
| `pnpm build` | Builds every package | 
| `pnpm start` | Launches only the API (after `pnpm build`) |
| `pnpm db:up` | Reminder to start Redis/ClickHouse/Postgres (wizard can provision them) |
| `pnpm db:migrate` | Runs the DDL in `packages/storage` |
| `pnpm ingest:run` | Starts ingestion workers only |
| `pnpm web:dev` | Starts the WebGUI only |
| `pnpm test:install-smoke` | Non-interactive installer + migration + start smoke test |

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

`./setup` (or `pnpm project:setup`) walks the user through the entire configuration:

- asks for host/user/password for Redis/ClickHouse/Postgres;
- proposes defaults and generates the `JWT_SECRET` automatically;
- lets you enable/disable fallback providers and enforces poll intervals;
- writes the `.env` file and prints the next steps (e.g. `pnpm db:migrate`, `pnpm dev`);
- if requested, installs and starts Redis/ClickHouse/Postgres through `sudo apt-get install`, enables systemd units and creates Postgres role/database with the provided credentials;
- runs reachability checks and highlights actionable tips when a service is down.

With these safeguards AIRapiserv can be handed to customers that have zero operational experience.

### Manual database installation (Ubuntu/Debian)

If you prefer to install the databases manually, use the keyserver-based ClickHouse repo setup below (the direct GPG URL may return 403). If you already added a broken ClickHouse key, remove it first:

```bash
sudo rm -f /etc/apt/sources.list.d/clickhouse.list /usr/share/keyrings/clickhouse.gpg
```

```bash
sudo apt-get update
sudo apt-get install -y redis-server postgresql
sudo apt-get install -y apt-transport-https ca-certificates curl gnupg
sudo mkdir -p /usr/share/keyrings
sudo gpg --keyserver keyserver.ubuntu.com --recv-keys 3E4AD4719DDE9A38
sudo gpg --export 3E4AD4719DDE9A38 | sudo gpg --dearmor -o /usr/share/keyrings/clickhouse.gpg
echo "deb [signed-by=/usr/share/keyrings/clickhouse.gpg] https://packages.clickhouse.com/deb stable main" | \\
  sudo tee /etc/apt/sources.list.d/clickhouse.list
sudo apt-get update
sudo apt-get install -y clickhouse-server clickhouse-client
sudo systemctl enable --now redis-server postgresql clickhouse-server
```

Set the ClickHouse password to match your `.env`:

```bash
sudo tee /etc/clickhouse-server/users.d/airapiserv-default.xml >/dev/null <<'EOF'
<clickhouse>
  <users>
    <default>
      <password>airapiserv</password>
    </default>
  </users>
</clickhouse>
EOF
sudo rm -f /etc/clickhouse-server/users.d/default-password.xml
sudo systemctl restart clickhouse-server
curl -s 'http://127.0.0.1:8123/?query=SELECT%201' --user default:airapiserv
```

Verify the services:

```bash
redis-cli ping
curl -s http://127.0.0.1:8123/ping
sudo -u postgres psql -c "select 1;"
```

### Postgres credential reset

If migrations fail with `password authentication failed`, reset the database user to match `.env`:

```bash
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER airapiserv WITH PASSWORD 'airapiserv';"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE airapiserv OWNER airapiserv;"
```

`./start` will also prompt you to reset the Postgres credentials automatically if it detects a mismatch.

## Production checklist

1. Store secrets in a vault (AWS SSM, Doppler, etc.).
2. Configure CI/CD and automated tests.
3. Harden security (TLS termination, WAF, RBAC).
4. Extend ingestion connectors (OKX, Coinbase, Kraken, etc.).
