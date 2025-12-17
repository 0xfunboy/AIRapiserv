import 'dotenv/config';
import { getPgPool } from '../clients/postgresClient.js';
import { getClickHouseClient } from '../clients/clickhouseClient.js';
import { getRedisClient } from '../clients/redisClient.js';

const parseRedisTarget = () => {
  const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/0';
  try {
    const url = new URL(redisUrl.includes('://') ? redisUrl : `redis://${redisUrl}`);
    return { host: url.hostname, port: url.port || '6379' };
  } catch {
    return { host: '127.0.0.1', port: '6379' };
  }
};

const parseClickhouseTarget = () => {
  const clickhouseUrl = process.env.CLICKHOUSE_URL ?? 'http://127.0.0.1:8123';
  try {
    const url = new URL(clickhouseUrl.includes('://') ? clickhouseUrl : `http://${clickhouseUrl}`);
    return { host: url.hostname, port: url.port || (url.protocol === 'https:' ? '8443' : '8123') };
  } catch {
    return { host: '127.0.0.1', port: '8123' };
  }
};

const parsePostgresTarget = () => ({
  host: process.env.PG_HOST ?? '127.0.0.1',
  port: process.env.PG_PORT ?? '5432',
});

async function checkConnections() {
  const failures: string[] = [];
  const redisTarget = parseRedisTarget();
  const clickTarget = parseClickhouseTarget();
  const pgTarget = parsePostgresTarget();

  try {
    const redis = getRedisClient();
    await redis.ping();
  } catch (err) {
    const message = err?.message?.toLowerCase?.() ?? '';
    if (message.includes('wrongpass') || message.includes('noauth')) {
      failures.push('Redis authentication failed (check REDIS_URL/password).');
    } else {
      failures.push(`Redis not reachable at ${redisTarget.host}:${redisTarget.port}`);
    }
  }

  try {
    const ch = getClickHouseClient();
    const result = await ch.query({ query: 'SELECT 1', format: 'JSONEachRow' });
    await result.json();
  } catch (err) {
    const message = err?.message?.toLowerCase?.() ?? '';
    if (message.includes('authentication') || message.includes('password')) {
      failures.push('ClickHouse authentication failed (check CLICKHOUSE_USER/CLICKHOUSE_PASSWORD).');
    } else {
      failures.push(`ClickHouse not reachable at ${clickTarget.host}:${clickTarget.port}`);
    }
  }

  try {
    const pool = getPgPool();
    await pool.query('select 1;');
  } catch (err) {
    if (err?.code === '28P01') {
      failures.push('Postgres authentication failed (check PG_USER/PG_PASSWORD).');
    } else {
      failures.push(`Postgres not reachable at ${pgTarget.host}:${pgTarget.port}`);
    }
  }

  if (failures.length) {
    console.error('Database connectivity check failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    console.error('DB down. Fix the services or credentials and rerun pnpm db:migrate.');
    process.exit(1);
  }
}

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
  await checkConnections();
  await Promise.all([migratePostgres(), migrateClickHouse(), warmupRedis()]);
  console.log('Migrations completed');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
