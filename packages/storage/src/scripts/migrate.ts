import { getPgPool } from '../clients/postgresClient.js';
import { getClickHouseClient } from '../clients/clickhouseClient.js';
import { getRedisClient } from '../clients/redisClient.js';
import { loadEnv } from '../config/loadEnv.js';

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

const parsePostgresTarget = () => {
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      return { host: url.hostname || '127.0.0.1', port: url.port || '5432' };
    } catch {}
  }
  return {
    host: process.env.PG_HOST ?? '127.0.0.1',
    port: process.env.PG_PORT ?? '5432',
  };
};

async function checkConnections() {
  loadEnv();
  const failures: string[] = [];
  const redisTarget = parseRedisTarget();
  const clickTarget = parseClickhouseTarget();
  const pgTarget = parsePostgresTarget();
  const toMessage = (err: unknown) => (err instanceof Error ? err.message : '');
  const toCode = (err: unknown) => (err && typeof err === 'object' && 'code' in err ? err.code : undefined);

  try {
    const redis = getRedisClient();
    await redis.ping();
  } catch (err) {
    const message = toMessage(err).toLowerCase();
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
    const message = toMessage(err).toLowerCase();
    if (message.includes('authentication') || message.includes('password')) {
      if (process.env.LOG_LEVEL === 'debug' || process.env.DEBUG === 'true') {
        const url = process.env.CLICKHOUSE_URL ?? 'http://127.0.0.1:8123';
        const user = process.env.CLICKHOUSE_USER ?? process.env.CLICKHOUSE_USERNAME ?? 'default';
        console.error(`ClickHouse auth failed with URL=${url} USER=${user}`);
      }
      failures.push('ClickHouse authentication failed (check CLICKHOUSE_USER/CLICKHOUSE_PASSWORD).');
    } else {
      failures.push(`ClickHouse not reachable at ${clickTarget.host}:${clickTarget.port}`);
    }
  }

  try {
    const pool = getPgPool();
    await pool.query('select 1;');
  } catch (err) {
    if (toCode(err) === '28P01') {
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
  await pool.query(`create extension if not exists pgcrypto;`);

  await pool.query(`create table if not exists tokens (
    token_id uuid primary key default gen_random_uuid(),
    symbol text,
    name text,
    chain text,
    contract_address text,
    coingecko_id text,
    coinmarketcap_id text,
    cryptocompare_id text,
    codex_id text,
    dextools_id text,
    status text default 'active',
    priority_source text,
    discovery_confidence real default 0.0,
    first_seen_at timestamptz default now(),
    last_seen_at timestamptz default now(),
    unique (chain, contract_address)
  );`);
  await pool.query(`create index if not exists idx_tokens_symbol on tokens(symbol);`);

  await pool.query(`create table if not exists token_venues (
    token_id uuid references tokens(token_id) on delete cascade,
    venue text not null,
    market_type text not null,
    base_symbol text,
    quote_symbol text,
    venue_symbol text not null,
    ws_supported boolean default false,
    ohlcv_supported boolean default false,
    last_verified_at timestamptz default now(),
    primary key (token_id, venue, market_type, venue_symbol)
  );`);

  await pool.query(`create table if not exists markets_cache (
    venue text not null,
    market_type text not null,
    base_symbol text,
    quote_symbol text,
    venue_symbol text not null,
    updated_at timestamptz default now(),
    primary key (venue, venue_symbol)
  );`);

  await pool.query(`create table if not exists candles (
    token_id uuid not null references tokens(token_id) on delete cascade,
    venue text not null,
    timeframe text not null,
    open_time bigint not null,
    open double precision not null,
    high double precision not null,
    low double precision not null,
    close double precision not null,
    volume double precision not null,
    source text not null,
    primary key (token_id, venue, timeframe, open_time)
  );`);

  await pool.query(`create table if not exists tasks (
    task_id uuid primary key default gen_random_uuid(),
    type text not null,
    priority int not null default 10,
    payload jsonb default '{}'::jsonb,
    run_after timestamptz,
    status text not null default 'pending',
    attempts int not null default 0,
    last_error text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );`);
  await pool.query(`create index if not exists idx_tasks_status_priority on tasks(status, priority desc, coalesce(run_after, now()));`);

  await pool.query(`create table if not exists request_metrics (
    bucket_start timestamptz primary key,
    request_count int not null default 0
  );`);

  await pool.query(`create table if not exists assets (
    asset_id text primary key,
    symbol text,
    name text,
    primary_chain text,
    primary_contract text,
    coingecko_id text,
    coinmarketcap_id text,
    defillama_id text,
    first_seen_source text,
    first_seen_at timestamptz default now(),
    updated_at timestamptz default now()
  );`);
  await pool.query(`alter table assets add column if not exists primary_chain text;`);
  await pool.query(`alter table assets add column if not exists primary_contract text;`);
  await pool.query(`alter table assets add column if not exists coingecko_id text;`);
  await pool.query(`alter table assets add column if not exists coinmarketcap_id text;`);
  await pool.query(`alter table assets add column if not exists defillama_id text;`);
  await pool.query(`alter table assets add column if not exists first_seen_source text;`);
  await pool.query(`alter table assets add column if not exists first_seen_at timestamptz default now();`);
  await pool.query(`alter table assets add column if not exists updated_at timestamptz default now();`);

  await pool.query(`create table if not exists asset_contracts (
    asset_id text not null,
    chain text not null,
    contract_address text not null,
    source text,
    is_primary boolean default false,
    first_seen_at timestamptz default now(),
    last_seen_at timestamptz default now(),
    primary key (asset_id, chain, contract_address)
  );`);
  await pool.query(`alter table asset_contracts drop column if exists "primary";`);
  await pool.query(`alter table asset_contracts add column if not exists is_primary boolean default false;`);

  await pool.query(`create table if not exists asset_aliases (
    asset_id text not null,
    alias text not null,
    kind text not null,
    source text,
    created_at timestamptz default now(),
    primary key (asset_id, alias, kind)
  );`);

  await pool.query(`create table if not exists asset_sources (
    asset_id text not null,
    source text not null,
    confidence int default 50,
    metadata jsonb default '{}'::jsonb,
    first_seen_at timestamptz default now(),
    last_seen_at timestamptz default now(),
    primary key (asset_id, source)
  );`);

  await pool.query(`create table if not exists markets (
    market_id text primary key,
    base_asset_id text,
    quote_asset_id text,
    market_type text not null,
    venue text not null,
    venue_symbol text not null,
    status text not null,
    ws_capable boolean default false,
    rest_capable boolean default true,
    discovered_at timestamptz default now(),
    updated_at timestamptz default now(),
    metadata jsonb default '{}'::jsonb
  );`);

  await pool.query(`alter table markets alter column base_asset_id drop not null;`);
  await pool.query(`alter table markets alter column quote_asset_id drop not null;`);
  await pool.query(`alter table markets add column if not exists ws_capable boolean default false;`);
  await pool.query(`alter table markets add column if not exists rest_capable boolean default true;`);
  await pool.query(`alter table markets add column if not exists discovered_at timestamptz default now();`);
  await pool.query(`alter table markets add column if not exists updated_at timestamptz default now();`);
  await pool.query(`alter table markets add column if not exists metadata jsonb default '{}'::jsonb;`);

  await pool.query(`create table if not exists audit_events (
    id bigserial primary key,
    actor text not null,
    event_type text not null,
    payload jsonb not null,
    created_at timestamptz default now()
  );`);

  await pool.query(`create table if not exists token_catalog (
    token_key text primary key,
    symbol text,
    name text,
    chain text,
    contract_address text,
    sources text[] default array[]::text[],
    metadata jsonb default '{}'::jsonb,
    updated_at timestamptz default now()
  );`);
}

async function migrateClickHouse() {
  const ch = getClickHouseClient();
  await ch.command({ query: 'drop table if exists candles_1s' }).catch(() => {});
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
