# AIRapiserv

AIRapiserv is the market-data gateway consumed by AIRTrack. It exposes a stable REST/WebSocket interface while orchestrating multiple providers, normalising events and persisting them in three specialised databases.

## Quick start (beginner friendly)

These steps are written for people with zero devops experience. Copy/paste in order.

### 1) Prerequisites

- Linux/macOS (Ubuntu/Debian recommended for automatic DB install)
- Node.js 23.3
- pnpm
- sudo access (only required if you want the wizard to install Redis/ClickHouse/Postgres)

Install Node 23.3 with nvm (recommended):

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 23.3.0
nvm use 23.3.0
```

Install pnpm:

```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
```

### 2) Clone the repo

```bash
git clone https://github.com/0xfunboy/AIRapiserv.git
cd AIRapiserv
```

### 3) Install dependencies

```bash
pnpm install
```

### 4) Run the one-command bootstrap

```bash
./start
```

What `./start` does:
- creates `.env` if missing (via the wizard),
- optionally installs Redis/ClickHouse/Postgres (if you answer yes),
- checks DB connectivity,
- runs migrations,
- starts the API + ingestors + WebGUI.

If you want to run the installer directly:

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
- WebSocket connectors (Binance, Bybit, OKX, Coinbase, Bitfinex) + throttled REST fallback (CoinGecko, CryptoCompare)
- Rolling candles 1s/5s/1m with dual storage (ClickHouse + Postgres)
- REST/WS API exposing the AIRTrack contract
- WebGUI (dashboard/status/tokens/markets/charts/compare/admin) con backfill e quick-actions
- Operational docs for AIRTrack compatibility
- Token catalog aggregation (CoinGecko/CoinMarketCap/CryptoCompare/DexScreener/DEXTools/Codex) con budget giornalieri e refresh 30m + refresh manuale

### Setup wizard (local or external DBs)

`./setup` (or `pnpm project:setup`) walks the user through the entire configuration:

- asks for host/user/password for Redis/ClickHouse/Postgres;
- proposes defaults and generates the `JWT_SECRET` automatically;
- lets you enable/disable fallback providers and enforces poll intervals;
- writes the `.env` file and prints the next steps (e.g. `pnpm db:migrate`, `pnpm dev`);
- if requested, installs and starts Redis/ClickHouse/Postgres through `sudo apt-get install`, enables systemd units, configures ClickHouse auth and creates the Postgres role/database with the provided credentials;
- runs reachability checks and highlights actionable tips when a service is down.

With these safeguards AIRapiserv can be handed to customers that have zero operational experience.

### Token catalog refresh

The API process downloads a unified token list on boot and refreshes it every 30 minutes. You can force a refresh from the Status page or via:

```bash
curl -X POST http://localhost:3333/v1/tokens/refresh
```

Optional sources:
- CoinGecko, CoinMarketCap, CryptoCompare, DexScreener (enabled automatically if keys are present).
- DEXTools/Codex can be added by setting `DEXTOOLS_TOKEN_LIST_URL` / `CODEX_TOKEN_LIST_URL` in `.env`.
- Budget limits are enforced per day (Redis): override with `COINGECKO_BUDGET_DAILY`, `COINMARKETCAP_BUDGET_DAILY`, etc. The Admin page shows current usage.

All discoveries are persisted in Postgres (`assets`, `asset_contracts`, `asset_aliases`, `asset_sources`, `token_catalog`) and never deleted automatically. Each refresh upserts records, preserving history and first-seen metadata. The WebGUI exposes the catalog and per-token drilldown pages under `/tokens`.

### Fallback market snapshots (fast DB warmup)

To populate the UI quickly, the ingestors also run a low-frequency snapshot fetch:

- CoinGecko "top markets" snapshot (single call, default 100 symbols).
- CryptoCompare multi-price snapshot for a configurable symbol list.

Tune the behavior in `.env` (or via the Admin panel overrides):

- `FALLBACK_POLL_INTERVAL_MS` (default 300000 / 5 minutes)
- `FALLBACK_SYMBOLS` (comma separated)
- `COINGECKO_MARKETS_FALLBACK`, `COINGECKO_MARKETS_LIMIT`, `COINGECKO_MARKETS_VS`, `COINGECKO_MARKETS_QUOTE`
- `CRYPTOCOMPARE_SYMBOLS`

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

### ClickHouse maintenance

- Optimize parts:

```bash
curl -X POST http://localhost:3333/v1/maintenance/clickhouse/optimize
```

- Reset candles table (drops/recreates `candles_1s`):

```bash
curl -X POST http://localhost:3333/v1/maintenance/clickhouse/reset
```

You can also trigger these from the WebGUI Admin page.

### WebGUI tips

- **Status**: DB health, ingestion lag, active markets, quick actions (discover/resolve/sync/reverify).
- **Tokens**: search by ticker/name/contract; click to drill down; “Force backfill” triggers OHLCV ingestion.
- **Compare**: filter token, view venue spreads and deltas.
- **Admin**: view/update runtime overrides, directory budgets, ClickHouse maintenance.

### What to do if ingestion looks stale

1. Check Status: “Latest Tick” lag and active markets.
2. Run quick actions: “Sync venues” then “Resolve coverage”.
3. Force backfill for the token from its detail page.
4. If ClickHouse errors persist, run the maintenance optimize/reset commands above.

### Postgres credential reset

If migrations fail with `password authentication failed`, reset the database user to match `.env`:

```bash
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER airapiserv WITH PASSWORD 'airapiserv';"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE airapiserv OWNER airapiserv;"
```

`./start` will also prompt you to reset the Postgres credentials automatically if it detects a mismatch.

### Common troubleshooting

1) ClickHouse auth errors in `pnpm db:migrate`

- Ensure `.env` has:
  - `CLICKHOUSE_URL=http://127.0.0.1:8123`
  - `CLICKHOUSE_USER=default`
  - `CLICKHOUSE_PASSWORD=airapiserv`
- If ClickHouse was installed manually, set the password file and restart:

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
```

2) Postgres auth errors in `./start`

```bash
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER airapiserv WITH PASSWORD 'airapiserv';"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE airapiserv OWNER airapiserv;"
```

## Production checklist

1. Store secrets in a vault (AWS SSM, Doppler, etc.).
2. Configure CI/CD and automated tests.
3. Harden security (TLS termination, WAF, RBAC).
4. Extend ingestion connectors (OKX, Coinbase, Kraken, etc.).
