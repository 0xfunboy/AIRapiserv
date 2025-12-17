# Storage schema

## Redis (DB1)

Keys:

- `ticker:<marketId>` hash → `{ last, mark, bestBid, bestAsk, updatedAt }`
- `trade:<marketId>` hash → `{ price, size, side, ts }`
- `health:storage` key → heartbeat written by ingestion
- `ws:subscriptions:*` (planned) → pub/sub fan-out

Retention defaults are defined in `defaultRetention` (cache TTL ~10 minutes).

## ClickHouse (DB2)

`candles_1s` (created by `db:migrate`):

| Column | Type | Description |
| --- | --- | --- |
| `start_ts` | DateTime | bucket start |
| `interval_ms` | UInt32 | 1000, 5000, 60000, ... |
| `market_id` | String | e.g. `binance:BTC-USDT:spot` |
| `open/high/low/close` | Float64 | OHLC |
| `volume` | Float64 | aggregated volume |
| `trades_count` | UInt32 | number of trades |
| `is_final` | UInt8 | 1 when the bucket closes |

Planned tables:

- `trades_raw` (MergeTree partitioned by day)
- `orderbooks_snapshots`
- `candles_5s`, `candles_1m` as materialised views

## Postgres (DB3)

Tables created during bootstrap:

- `assets(asset_id PK, name, symbol, chain_id, contract_addresses jsonb, aliases text[], created_at)`
- `markets(market_id PK, base_asset_id, quote_asset_id, market_type, venue, venue_symbol, status, metadata jsonb, created_at)`
- `audit_events(id bigserial PK, actor, event_type, payload jsonb, created_at)`

Planned extensions:

- `provider_coverage` table to track availability/latency
- `watchlists` + `user_permissions`
- Partitioned `candles_1m` for long retention
