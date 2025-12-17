import { getPgPool } from '../clients/postgresClient.js';
import { getClickHouseClient } from '../clients/clickhouseClient.js';
import { getRedisClient } from '../clients/redisClient.js';

async function migratePostgres() {
  const pool = getPgPool();
  await pool.query(`create table if not exists assets (
    asset_id text primary key,
    name text not null,
    symbol text not null,
    chain_id text,
    contract_addresses jsonb default '{}'::jsonb,
    aliases text[] default array[]::text[],
    created_at timestamptz default now()
  );`);

  await pool.query(`create table if not exists markets (
    market_id text primary key,
    base_asset_id text not null,
    quote_asset_id text not null,
    market_type text not null,
    venue text not null,
    venue_symbol text not null,
    status text not null,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now()
  );`);

  await pool.query(`create table if not exists audit_events (
    id bigserial primary key,
    actor text not null,
    event_type text not null,
    payload jsonb not null,
    created_at timestamptz default now()
  );`);
}

async function migrateClickHouse() {
  const ch = getClickHouseClient();
  await ch.command({
    query: `create table if not exists candles_1s (
      start_ts DateTime,
      interval_ms UInt32,
      market_id String,
      open Float64,
      high Float64,
      low Float64,
      close Float64,
      volume Float64,
      trades_count UInt32,
      is_final UInt8
    ) engine = MergeTree()
    order by (market_id, start_ts);`,
  });
}

async function warmupRedis() {
  const redis = getRedisClient();
  await redis.set('health:storage', Date.now().toString(), 'EX', 60);
}

async function main() {
  await Promise.all([migratePostgres(), migrateClickHouse(), warmupRedis()]);
  console.log('Migrations completed');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
