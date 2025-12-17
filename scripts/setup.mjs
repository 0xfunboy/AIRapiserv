#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';

const rl = createInterface({ input, output });
const wait = promisify(setTimeout);

const yesNo = async (question, defaultValue = true) => {
  const suffix = defaultValue ? '[Y/n]' : '[y/N]';
  const answer = (await rl.question(`${question} ${suffix} `)).trim().toLowerCase();
  if (!answer) return defaultValue;
  return ['y', 'yes'].includes(answer);
};

const ask = async (question, defaultValue, tip) => {
  if (tip) {
    console.log(`› ${tip}`);
  }
  const suffix = defaultValue !== undefined && defaultValue !== null ? ` (default: ${defaultValue})` : '';
  const value = (await rl.question(`${question}${suffix}: `)).trim();
  return value || (defaultValue ?? '');
};

const buildRedisUrl = (host, port, db, password) => {
  const auth = password ? `:${encodeURIComponent(password)}@` : '';
  return `redis://${auth}${host}:${port}/${db}`;
};

const runCommand = (cmd, args, opts = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
    child.on('error', reject);
  });

const testConnection = (host, port, timeoutMs = 3000) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve(false);
    });
  });

const escapeSql = (value) => value.replace(/'/g, "''");

const envPath = path.resolve('.env');

const ensureAptAvailability = () => {
  if (process.platform !== 'linux') return false;
  const result = spawnSync('apt-get', ['--version'], { stdio: 'ignore' });
  return result.status === 0;
};

const provisionServices = async (config) => {
  const aptAvailable = ensureAptAvailability();
  if (!aptAvailable) {
    console.log('\n⚠️  Automatic install is only available on Debian/Ubuntu with apt-get. Please install Redis/ClickHouse/Postgres manually.');
    return;
  }

  console.log('\n🔧 Installing Redis / ClickHouse / Postgres (sudo permissions required)...');
  await runCommand('sudo', ['apt-get', 'update']);
  await runCommand('sudo', ['apt-get', 'install', '-y', 'redis-server', 'clickhouse-server', 'postgresql']);

  console.log('\n▶️  Enabling and starting the services...');
  await runCommand('sudo', ['systemctl', 'enable', '--now', 'redis-server']);
  await runCommand('sudo', ['systemctl', 'enable', '--now', 'clickhouse-server']);
  await runCommand('sudo', ['systemctl', 'enable', '--now', 'postgresql']);

  console.log('\n🗄  Configuring Postgres with the provided credentials...');
  const sqlUser = `DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${escapeSql(config.pgUser)}') THEN
      CREATE ROLE ${config.pgUser} LOGIN PASSWORD '${escapeSql(config.pgPassword)}';
    ELSE
      ALTER USER ${config.pgUser} WITH PASSWORD '${escapeSql(config.pgPassword)}';
    END IF;
  END $$;`;
  await runCommand('sudo', ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-c', sqlUser]);

  const sqlDb = `DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = '${escapeSql(config.pgDatabase)}') THEN
      CREATE DATABASE ${config.pgDatabase} OWNER ${config.pgUser};
    END IF;
  END $$;`;
  await runCommand('sudo', ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-c', sqlDb]);
  await runCommand('sudo', ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-c', `GRANT ALL PRIVILEGES ON DATABASE ${config.pgDatabase} TO ${config.pgUser};`]);

  console.log('\nℹ️  Redis and ClickHouse use their default configs. Set passwords later in /etc/redis/redis.conf and /etc/clickhouse-server/users.d/default.xml if needed.');
};

const verifyServices = async (services) => {
  console.log('\n🔍 Checking service reachability...');
  for (const svc of services) {
    const reachable = await testConnection(svc.host, Number(svc.port));
    if (reachable) {
      console.log(`✅ ${svc.name} reachable at ${svc.host}:${svc.port}`);
    } else {
      console.log(`❌ ${svc.name} is not responding at ${svc.host}:${svc.port}`);
      console.log(`   Tip: ${svc.tip}`);
    }
    await wait(100);
  }
};

(async () => {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  AIRapiserv setup wizard (CLI)       ║');
  console.log('╚══════════════════════════════════════╝\n');
  console.log('Answer a few questions to generate `.env` and optionally install Redis/ClickHouse/Postgres.');

  const envExists = existsSync(envPath);
  if (envExists) {
    const overwrite = await yesNo('\nA .env file already exists. Do you want to overwrite it?', false);
    if (!overwrite) {
      console.log('Setup aborted, existing .env preserved.');
      process.exit(0);
    }
  }

  let autoInstall = false;
  if (process.platform === 'linux') {
    autoInstall = await yesNo('\nDo you want the wizard to install/start Redis, ClickHouse and Postgres locally? (sudo + apt-get required)', true);
  } else {
    console.log('\nℹ️  Automatic install is not available on this OS. Follow the manual instructions printed below.');
  }

  const nodeEnv = await ask('\nNODE_ENV', 'development', 'Use "production" for deployed environments');
  const apiPort = await ask('API port', '3333', 'Fastify REST/WS listener');
  const webPort = await ask('WebGUI port', '4000', 'Next.js dev server');

  console.log('\n--- Redis (realtime cache) ---');
  const redisHost = await ask('Redis host', '127.0.0.1');
  const redisPort = await ask('Redis port', '6379');
  const redisDb = await ask('Redis DB index', '0');
  const redisPassword = await ask('Redis password (leave empty if none)', '');
  const redisUrl = buildRedisUrl(redisHost, redisPort, redisDb, redisPassword);

  console.log('\n--- ClickHouse (time series) ---');
  const clickHost = await ask('ClickHouse URL', 'http://127.0.0.1:8123', 'Format http(s)://host:port');
  const clickUser = await ask('ClickHouse username', 'default');
  const clickPassword = await ask('ClickHouse password (leave empty if none)', '');
  let clickHouseUrlForCheck;
  try {
    clickHouseUrlForCheck = new URL(clickHost.includes('://') ? clickHost : `http://${clickHost}`);
  } catch {
    clickHouseUrlForCheck = new URL('http://127.0.0.1:8123');
  }

  console.log('\n--- Postgres (catalogue) ---');
  const pgHost = await ask('Postgres host', '127.0.0.1');
  const pgPort = await ask('Postgres port', '5432');
  const pgUser = await ask('Postgres user', 'airapiserv');
  const pgPassword = await ask('Postgres password', 'airapiserv');
  const pgDatabase = await ask('Postgres database', 'airapiserv');

  const ingestionConcurrency = await ask('\nIngestion worker concurrency', '4');
  const rollingCandles = await yesNo('Enable rolling candles?', true);

  console.log('\n--- Security & API ---');
  const jwtSecret = await ask('JWT secret', randomBytes(24).toString('hex'), 'Used for API + WebGUI sessions');
  const corsOrigins = await ask('CORS origins (comma separated)', 'http://localhost:4000');
  const apiRateLimit = await ask('API rate limit (req/min)', '200');

  console.log('\n--- Provider keys (optional) ---');
  const coingeckoKey = await ask('CoinGecko API key', '');
  const coinmarketcapKey = await ask('CoinMarketCap API key', '');
  const cryptocompareKey = await ask('CryptoCompare API key', '');

  const enableCg = await yesNo('Enable CoinGecko fallback?', true);
  const enableCc = await yesNo('Enable CryptoCompare fallback?', true);
  const fallbackPoll = await ask('Fallback poll interval (ms)', '300000', '≥ 300000 (5 minutes) recommended');

  const content = `NODE_ENV=${nodeEnv}
LOG_LEVEL=info
PORT=3000
WEB_PORT=${webPort}
API_PORT=${apiPort}
INGESTION_WORKER_CONCURRENCY=${ingestionConcurrency}
ENABLE_ROLLING_CANDLES=${rollingCandles}

REDIS_URL=${redisUrl}

CLICKHOUSE_URL=${clickHost}
CLICKHOUSE_USERNAME=${clickUser}
CLICKHOUSE_PASSWORD=${clickPassword}

PG_HOST=${pgHost}
PG_PORT=${pgPort}
PG_USER=${pgUser}
PG_PASSWORD=${pgPassword}
PG_DATABASE=${pgDatabase}

JWT_SECRET=${jwtSecret}
API_RATE_LIMIT=${apiRateLimit}
CORS_ORIGINS=${corsOrigins}

COINGECKO_API_KEY=${coingeckoKey}
COINMARKETCAP_API_KEY=${coinmarketcapKey}
CRYPTOCOMPARE_API_KEY=${cryptocompareKey}
DEXSCREENER_BASE_URL=https://api.dexscreener.io
DEFILLAMA_BASE_URL=https://coins.llama.fi
BINANCE_WS_URL=wss://stream.binance.com:9443/ws
BYBIT_WS_URL=wss://stream.bybit.com/v5/public/spot

ENABLE_COINGECKO_FALLBACK=${enableCg}
ENABLE_CRYPTOCOMPARE_FALLBACK=${enableCc}
MAX_FALLBACK_CALLS_PER_MINUTE=2
FALLBACK_POLL_INTERVAL_MS=${fallbackPoll}

NEXT_PUBLIC_API_BASE=http://localhost:${apiPort}
NEXT_PUBLIC_WS_URL=ws://localhost:${apiPort}/v1/ws
`;

  writeFileSync(envPath, content.trim() + '\n');

  if (autoInstall) {
    await provisionServices({ pgUser, pgPassword, pgDatabase });
  } else {
    console.log('\nℹ️  Automatic install skipped. Make sure Redis/ClickHouse/Postgres are running with the values entered above.');
  }

  await verifyServices([
    { name: 'Redis', host: redisHost, port: redisPort, tip: 'Install redis-server or check firewall/host configuration.' },
    {
      name: 'ClickHouse',
      host: clickHouseUrlForCheck.hostname,
      port: clickHouseUrlForCheck.port || (clickHouseUrlForCheck.protocol === 'https:' ? '8443' : '8123'),
      tip: 'Install clickhouse-server or update CLICKHOUSE_URL.',
    },
    { name: 'Postgres', host: pgHost, port: pgPort, tip: 'Install postgresql or double-check credentials/host.' },
  ]);

  await rl.close();

  console.log('\n✅ .env generated successfully.');
  console.log('\nNext steps:');
  console.log('- Run `pnpm db:migrate` to create the storage tables.');
  console.log('- Start the stack via `pnpm dev` (or `pnpm run` if you like the reminder).');
  console.log(`- API health: http://localhost:${apiPort}/v1/health`);
  console.log(`- WebGUI: http://localhost:${webPort}`);
  console.log('\nTip: back up these credentials in your secret manager before deploying to production.');
})().catch((err) => {
  console.error('Setup aborted:', err);
  process.exit(1);
});
