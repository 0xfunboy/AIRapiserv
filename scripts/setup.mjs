#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';

const cliArgs = new Set(process.argv.slice(2));
const nonInteractive = cliArgs.has('--non-interactive');
const forceInstall = cliArgs.has('--install');
const skipInstall = cliArgs.has('--no-install');
const isInteractive = Boolean(process.stdin.isTTY) && !nonInteractive;

const rl = createInterface({ input, output });
const wait = promisify(setTimeout);
const envPath = path.resolve('.env');
const repoRoot = path.resolve('.');
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
const sudoUser = process.env.SUDO_USER;

const yesNo = async (question, defaultValue = true) => {
  const suffix = defaultValue ? '[Y/n]' : '[y/N]';
  if (!isInteractive) {
    return defaultValue;
  }
  const answer = (await rl.question(`${question} ${suffix} `)).trim().toLowerCase();
  if (!answer) return defaultValue;
  return ['y', 'yes'].includes(answer);
};

const ask = async (question, defaultValue, tip) => {
  if (tip) {
    console.log(`> ${tip}`);
  }
  if (!isInteractive) {
    return defaultValue ?? '';
  }
  const suffix = defaultValue !== undefined && defaultValue !== null ? ` (default: ${defaultValue})` : '';
  const value = (await rl.question(`${question}${suffix}: `)).trim();
  return value || (defaultValue ?? '');
};

const parseEnv = (filePath) => {
  const data = readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of data.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
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

const runCommandCapture = (cmd, args, opts = {}) => {
  const result = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return result;
};

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

const ensureAptAvailability = () => {
  if (process.platform !== 'linux') return false;
  const result = spawnSync('apt-get', ['--version'], { stdio: 'ignore' });
  return result.status === 0;
};

const sanitizeClickhouseUser = (user) => {
  if (!user) return 'default';
  const safe = user.trim();
  if (!safe) return 'default';
  if (!/^[A-Za-z0-9_-]+$/.test(safe)) {
    console.log(`Invalid ClickHouse user "${user}". Falling back to "default".`);
    return 'default';
  }
  return safe;
};

const configureClickHousePassword = async (config) => {
  const clickUser = sanitizeClickhouseUser(config.clickUser);
  const password = config.clickPassword?.trim();
  if (!password) {
    throw new Error('CLICKHOUSE_PASSWORD is required for local ClickHouse installs.');
  }

  const xml = `<clickhouse>
  <users>
    <${clickUser}>
      <password>${password}</password>
    </${clickUser}>
  </users>
</clickhouse>`;

  await runCommand('bash', ['-lc', `cat <<'EOF' | sudo tee /etc/clickhouse-server/users.d/airapiserv-default.xml >/dev/null\n${xml}\nEOF`]);
  await runCommand('sudo', ['rm', '-f', '/etc/clickhouse-server/users.d/default-password.xml']);
  await runCommand('sudo', ['systemctl', 'restart', 'clickhouse-server']);

  let clickUrl;
  try {
    clickUrl = new URL(config.clickHost.includes('://') ? config.clickHost : `http://${config.clickHost}`);
  } catch {
    clickUrl = new URL('http://127.0.0.1:8123');
  }

  const testResult = runCommandCapture('bash', [
    '-lc',
    `curl -s '${clickUrl.origin}/?query=SELECT%201' --user ${clickUser}:${password}`,
  ]);
  if (testResult.status !== 0 || !testResult.stdout.includes('1')) {
    console.error('\nClickHouse authentication test failed. Inspect the server log for details.');
    runCommandCapture('sudo', ['tail', '-n', '50', '/var/log/clickhouse-server/clickhouse-server.log'], { stdio: 'inherit' });
    throw new Error('ClickHouse password configuration failed.');
  }
};

const provisionServices = async (config) => {
  const aptAvailable = ensureAptAvailability();
  if (!aptAvailable) {
    console.log('\nWARNING: Automatic install is only available on Debian/Ubuntu with apt-get. Please install Redis/ClickHouse/Postgres manually.');
    return;
  }

  try {
    console.log('\nInstalling Redis / Postgres (sudo permissions required)...');
    await runCommand('sudo', ['apt-get', 'update']);
    await runCommand('sudo', ['apt-get', 'install', '-y', 'redis-server', 'postgresql']);

    console.log('\nInstalling ClickHouse repository + packages...');
    await runCommand('sudo', ['apt-get', 'install', '-y', 'apt-transport-https', 'ca-certificates', 'curl', 'gnupg']);
    await runCommand('sudo', ['mkdir', '-p', '/usr/share/keyrings']);
    await runCommand('bash', ['-lc', 'sudo gpg --keyserver keyserver.ubuntu.com --recv-keys 3E4AD4719DDE9A38']);
    await runCommand('bash', ['-lc', 'sudo gpg --export 3E4AD4719DDE9A38 | sudo gpg --dearmor -o /usr/share/keyrings/clickhouse.gpg']);
    await runCommand('bash', [
      '-lc',
      'echo \"deb [signed-by=/usr/share/keyrings/clickhouse.gpg] https://packages.clickhouse.com/deb stable main\" | sudo tee /etc/apt/sources.list.d/clickhouse.list',
    ]);
    await runCommand('sudo', ['apt-get', 'update']);
    await runCommand('sudo', ['apt-get', 'install', '-y', 'clickhouse-server', 'clickhouse-client']);

    console.log('\nEnabling and starting the services...');
    await runCommand('sudo', ['systemctl', 'enable', '--now', 'redis-server']);
    await runCommand('sudo', ['systemctl', 'enable', '--now', 'postgresql']);
    await runCommand('sudo', ['systemctl', 'enable', '--now', 'clickhouse-server']);

    console.log('\nConfiguring ClickHouse credentials...');
    await configureClickHousePassword(config);

    console.log('\nConfiguring Postgres with the provided credentials...');
    const sqlUser = `DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${escapeSql(config.pgUser)}') THEN
        CREATE ROLE ${config.pgUser} LOGIN PASSWORD '${escapeSql(config.pgPassword)}';
      ELSE
        ALTER USER ${config.pgUser} WITH PASSWORD '${escapeSql(config.pgPassword)}';
      END IF;
    END $$;`;
    await runCommand('sudo', ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-c', sqlUser]);

    const dbCheck = runCommandCapture('sudo', ['-u', 'postgres', 'psql', '-tAc', `SELECT 1 FROM pg_database WHERE datname='${escapeSql(config.pgDatabase)}'`]);
    if (dbCheck.stdout.trim() !== '1') {
      await runCommand('sudo', ['-u', 'postgres', 'createdb', '-O', config.pgUser, config.pgDatabase]);
    }
    await runCommand('sudo', ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-c', `GRANT ALL PRIVILEGES ON DATABASE ${config.pgDatabase} TO ${config.pgUser};`]);

    console.log('\nRedis, ClickHouse and Postgres are installed and configured. Adjust passwords later in /etc/redis/redis.conf and /etc/clickhouse-server/users.d/airapiserv-default.xml if needed.');
  } catch (err) {
    console.error('\nAutomatic install failed:', err?.message ?? err);
    console.log('Manual fallback:');
    console.log('- sudo apt-get update');
    console.log('- sudo apt-get install -y redis-server postgresql');
    console.log('- sudo apt-get install -y apt-transport-https ca-certificates curl gnupg');
    console.log('- sudo gpg --keyserver keyserver.ubuntu.com --recv-keys 3E4AD4719DDE9A38');
    console.log('- sudo gpg --export 3E4AD4719DDE9A38 | sudo gpg --dearmor -o /usr/share/keyrings/clickhouse.gpg');
    console.log('- echo \"deb [signed-by=/usr/share/keyrings/clickhouse.gpg] https://packages.clickhouse.com/deb stable main\" | sudo tee /etc/apt/sources.list.d/clickhouse.list');
    console.log('- sudo apt-get update');
    console.log('- sudo apt-get install -y clickhouse-server clickhouse-client');
    console.log('- sudo systemctl enable --now redis-server postgresql clickhouse-server');
    console.log('- Configure ClickHouse password in /etc/clickhouse-server/users.d/airapiserv-default.xml (see README).');
  }
};

const verifyServices = async (services) => {
  console.log('\nChecking service reachability...');
  for (const svc of services) {
    const reachable = await testConnection(svc.host, Number(svc.port));
    if (reachable) {
      console.log(`[OK] ${svc.name} reachable at ${svc.host}:${svc.port}`);
    } else {
      console.log(`[FAIL] ${svc.name} is not responding at ${svc.host}:${svc.port}`);
      console.log(`       Tip: ${svc.tip}`);
    }
    await wait(100);
  }
};

const defaults = {
  nodeEnv: 'development',
  apiPort: '3333',
  webPort: '4000',
  redisHost: '127.0.0.1',
  redisPort: '6379',
  redisDb: '0',
  redisPassword: '',
  clickHost: 'http://127.0.0.1:8123',
  clickUser: 'default',
  clickPassword: 'airapiserv',
  pgHost: '127.0.0.1',
  pgPort: '5432',
  pgUser: 'airapiserv',
  pgPassword: 'airapiserv',
  pgDatabase: 'airapiserv',
  ingestionConcurrency: '4',
  rollingCandles: true,
  jwtSecret: randomBytes(24).toString('hex'),
  corsOrigins: 'http://localhost:4000',
  apiRateLimit: '200',
  coingeckoKey: '',
  coinmarketcapKey: '',
  cryptocompareKey: '',
  enableCg: true,
  enableCc: true,
  fallbackPoll: '300000',
  fallbackSymbols: 'BTC,ETH,SOL,BNB,XRP,ADA,DOGE',
  coingeckoMarketsFallback: true,
  coingeckoMarketsLimit: '100',
  coingeckoMarketsVs: 'usd',
  coingeckoMarketsQuote: 'USD',
  coingeckoIds: 'BTC:bitcoin,ETH:ethereum',
  cryptocompareSymbols: 'BTC,ETH,SOL',
};

(async () => {
  console.log('========================================');
  console.log(' AIRapiserv setup wizard (CLI)');
  console.log('========================================\n');
  console.log('Answer a few questions to generate `.env` and optionally install Redis/ClickHouse/Postgres.');

  const envExists = existsSync(envPath);
  const existingEnv = envExists ? parseEnv(envPath) : {};
  let writeEnv = true;

  if (envExists) {
    if (!isInteractive) {
      writeEnv = false;
      console.log('\nA .env file already exists. Keeping it in non-interactive mode.');
    } else {
      const overwrite = await yesNo('\nA .env file already exists. Do you want to overwrite it?', false);
      if (!overwrite) {
        writeEnv = false;
        console.log('Keeping the existing .env. Using it for provisioning and checks.');
      }
    }
  }

  let autoInstall = false;
  if (forceInstall) {
    autoInstall = true;
  } else if (skipInstall || !isInteractive) {
    autoInstall = false;
  } else if (process.platform === 'linux') {
    autoInstall = await yesNo('\nDo you want the wizard to install/start Redis, ClickHouse and Postgres locally? (sudo + apt-get required)', true);
  } else {
    console.log('\nINFO: Automatic install is not available on this OS. Follow the manual instructions printed below.');
  }

  let config;
  if (writeEnv) {
    const nodeEnv = await ask('\nNODE_ENV', defaults.nodeEnv, 'Use "production" for deployed environments');
    const apiPort = await ask('API port', defaults.apiPort, 'Fastify REST/WS listener');
    const webPort = await ask('WebGUI port', defaults.webPort, 'Next.js dev server');

    console.log('\n--- Redis (realtime cache) ---');
    const redisHost = await ask('Redis host', defaults.redisHost);
    const redisPort = await ask('Redis port', defaults.redisPort);
    const redisDb = await ask('Redis DB index', defaults.redisDb);
    const redisPassword = await ask('Redis password (leave empty if none)', defaults.redisPassword);
    const redisUrl = buildRedisUrl(redisHost, redisPort, redisDb, redisPassword);

    console.log('\n--- ClickHouse (time series) ---');
    const clickHost = await ask('ClickHouse URL', defaults.clickHost, 'Format http(s)://host:port');
    const clickUser = await ask('ClickHouse username', defaults.clickUser);
    const clickPassword = await ask('ClickHouse password', defaults.clickPassword);

    console.log('\n--- Postgres (catalogue) ---');
    const pgHost = await ask('Postgres host', defaults.pgHost);
    const pgPort = await ask('Postgres port', defaults.pgPort);
    const pgUser = await ask('Postgres user', defaults.pgUser);
    const pgPassword = await ask('Postgres password', defaults.pgPassword);
    const pgDatabase = await ask('Postgres database', defaults.pgDatabase);

    const ingestionConcurrency = await ask('\nIngestion worker concurrency', defaults.ingestionConcurrency);
    const rollingCandles = await yesNo('Enable rolling candles?', true);

    console.log('\n--- Security & API ---');
    const jwtSecret = await ask('JWT secret', defaults.jwtSecret, 'Used for API + WebGUI sessions');
    const corsOrigins = await ask('CORS origins (comma separated)', defaults.corsOrigins);
    const apiRateLimit = await ask('API rate limit (req/min)', defaults.apiRateLimit);

    console.log('\n--- Provider keys (optional) ---');
    const coingeckoKey = await ask('CoinGecko API key', defaults.coingeckoKey);
    const coinmarketcapKey = await ask('CoinMarketCap API key', defaults.coinmarketcapKey);
    const cryptocompareKey = await ask('CryptoCompare API key', defaults.cryptocompareKey);

    const enableCg = await yesNo('Enable CoinGecko fallback?', true);
    const enableCc = await yesNo('Enable CryptoCompare fallback?', true);
    const fallbackPoll = await ask('Fallback poll interval (ms)', defaults.fallbackPoll, '>= 300000 (5 minutes) recommended');
    const fallbackSymbols = defaults.fallbackSymbols;
    const coingeckoMarketsFallback = defaults.coingeckoMarketsFallback;
    const coingeckoMarketsLimit = defaults.coingeckoMarketsLimit;
    const coingeckoMarketsVs = defaults.coingeckoMarketsVs;
    const coingeckoMarketsQuote = defaults.coingeckoMarketsQuote;
    const coingeckoIds = defaults.coingeckoIds;
    const cryptocompareSymbols = defaults.cryptocompareSymbols;

    config = {
      nodeEnv,
      apiPort,
      webPort,
      redisHost,
      redisPort,
      redisDb,
      redisPassword,
      redisUrl,
      clickHost,
      clickUser,
      clickPassword,
      pgHost,
      pgPort,
      pgUser,
      pgPassword,
      pgDatabase,
      ingestionConcurrency,
      rollingCandles,
      jwtSecret,
      corsOrigins,
      apiRateLimit,
      coingeckoKey,
      coinmarketcapKey,
      cryptocompareKey,
      enableCg,
      enableCc,
      fallbackPoll,
      fallbackSymbols,
      coingeckoMarketsFallback,
      coingeckoMarketsLimit,
      coingeckoMarketsVs,
      coingeckoMarketsQuote,
      coingeckoIds,
      cryptocompareSymbols,
    };

    const content = `NODE_ENV=${config.nodeEnv}
LOG_LEVEL=info
PORT=${config.webPort}
WEB_PORT=${config.webPort}
API_PORT=${config.apiPort}
INGESTION_WORKER_CONCURRENCY=${config.ingestionConcurrency}
ENABLE_ROLLING_CANDLES=${config.rollingCandles}

REDIS_URL=${config.redisUrl}

CLICKHOUSE_URL=${config.clickHost}
CLICKHOUSE_USER=${config.clickUser}
CLICKHOUSE_PASSWORD=${config.clickPassword}

PG_HOST=${config.pgHost}
PG_PORT=${config.pgPort}
PG_USER=${config.pgUser}
PG_PASSWORD=${config.pgPassword}
PG_DATABASE=${config.pgDatabase}

JWT_SECRET=${config.jwtSecret}
API_RATE_LIMIT=${config.apiRateLimit}
CORS_ORIGINS=${config.corsOrigins}

COINGECKO_API_KEY=${config.coingeckoKey}
COINMARKETCAP_API_KEY=${config.coinmarketcapKey}
CRYPTOCOMPARE_API_KEY=${config.cryptocompareKey}
DEXSCREENER_BASE_URL=https://api.dexscreener.io
DEFILLAMA_BASE_URL=https://coins.llama.fi
BINANCE_WS_URL=wss://stream.binance.com:9443/ws
BYBIT_WS_URL=wss://stream.bybit.com/v5/public/spot

ENABLE_COINGECKO_FALLBACK=${config.enableCg}
ENABLE_CRYPTOCOMPARE_FALLBACK=${config.enableCc}
MAX_FALLBACK_CALLS_PER_MINUTE=2
FALLBACK_POLL_INTERVAL_MS=${config.fallbackPoll}
FALLBACK_SYMBOLS=${config.fallbackSymbols}
COINGECKO_MARKETS_FALLBACK=${config.coingeckoMarketsFallback}
COINGECKO_MARKETS_LIMIT=${config.coingeckoMarketsLimit}
COINGECKO_MARKETS_VS=${config.coingeckoMarketsVs}
COINGECKO_MARKETS_QUOTE=${config.coingeckoMarketsQuote}
COINGECKO_IDS=${config.coingeckoIds}
CRYPTOCOMPARE_SYMBOLS=${config.cryptocompareSymbols}

NEXT_PUBLIC_API_BASE=http://localhost:${config.apiPort}
NEXT_PUBLIC_WS_URL=ws://localhost:${config.apiPort}/v1/ws
`;

    writeFileSync(envPath, content.trim() + '\n');
  } else {
    const redisUrl = existingEnv.REDIS_URL ?? buildRedisUrl(defaults.redisHost, defaults.redisPort, defaults.redisDb, defaults.redisPassword);
    config = {
      nodeEnv: existingEnv.NODE_ENV ?? defaults.nodeEnv,
      apiPort: existingEnv.API_PORT ?? defaults.apiPort,
      webPort: existingEnv.WEB_PORT ?? defaults.webPort,
      redisUrl,
      clickHost: existingEnv.CLICKHOUSE_URL ?? defaults.clickHost,
      clickUser: existingEnv.CLICKHOUSE_USER ?? existingEnv.CLICKHOUSE_USERNAME ?? defaults.clickUser,
      clickPassword: existingEnv.CLICKHOUSE_PASSWORD ?? defaults.clickPassword,
      pgHost: existingEnv.PG_HOST ?? defaults.pgHost,
      pgPort: existingEnv.PG_PORT ?? defaults.pgPort,
      pgUser: existingEnv.PG_USER ?? defaults.pgUser,
      pgPassword: existingEnv.PG_PASSWORD ?? defaults.pgPassword,
      pgDatabase: existingEnv.PG_DATABASE ?? defaults.pgDatabase,
      fallbackSymbols: existingEnv.FALLBACK_SYMBOLS ?? defaults.fallbackSymbols,
      coingeckoMarketsFallback: existingEnv.COINGECKO_MARKETS_FALLBACK ?? defaults.coingeckoMarketsFallback,
      coingeckoMarketsLimit: existingEnv.COINGECKO_MARKETS_LIMIT ?? defaults.coingeckoMarketsLimit,
      coingeckoMarketsVs: existingEnv.COINGECKO_MARKETS_VS ?? defaults.coingeckoMarketsVs,
      coingeckoMarketsQuote: existingEnv.COINGECKO_MARKETS_QUOTE ?? defaults.coingeckoMarketsQuote,
      coingeckoIds: existingEnv.COINGECKO_IDS ?? defaults.coingeckoIds,
      cryptocompareSymbols: existingEnv.CRYPTOCOMPARE_SYMBOLS ?? defaults.cryptocompareSymbols,
    };
  }

  if (autoInstall) {
    await provisionServices({
      pgUser: config.pgUser,
      pgPassword: config.pgPassword,
      pgDatabase: config.pgDatabase,
      clickUser: config.clickUser,
      clickPassword: config.clickPassword,
      clickHost: config.clickHost,
    });
  } else {
    console.log('\nINFO: Automatic install skipped. Make sure Redis/ClickHouse/Postgres are running with the values in .env.');
  }

  let clickHouseUrlForCheck;
  try {
    clickHouseUrlForCheck = new URL(config.clickHost.includes('://') ? config.clickHost : `http://${config.clickHost}`);
  } catch {
    clickHouseUrlForCheck = new URL('http://127.0.0.1:8123');
  }

  let redisHost = defaults.redisHost;
  let redisPort = defaults.redisPort;
  try {
    const url = new URL(config.redisUrl.includes('://') ? config.redisUrl : `redis://${config.redisUrl}`);
    redisHost = url.hostname;
    redisPort = url.port || defaults.redisPort;
  } catch {}

  await verifyServices([
    { name: 'Redis', host: redisHost, port: redisPort, tip: 'Install redis-server or update REDIS_URL.' },
    {
      name: 'ClickHouse',
      host: clickHouseUrlForCheck.hostname,
      port: clickHouseUrlForCheck.port || (clickHouseUrlForCheck.protocol === 'https:' ? '8443' : '8123'),
      tip: 'Install clickhouse-server or update CLICKHOUSE_URL.',
    },
    { name: 'Postgres', host: config.pgHost, port: config.pgPort, tip: 'Install postgresql or update PG_HOST/PG_PORT.' },
  ]);

  await rl.close();

  console.log('\nSetup completed.');
  console.log('\nNext steps:');
  console.log('- Run `./start` to validate databases, run migrations, and launch the dev stack.');
  console.log(`- API health: http://localhost:${config.apiPort}/v1/health`);
  console.log(`- WebGUI: http://localhost:${config.webPort}`);
  if (isRoot && sudoUser) {
    const ownership = runCommandCapture('chown', ['-R', `${sudoUser}:${sudoUser}`, repoRoot]);
    if (ownership.status !== 0) {
      console.log('\nWARNING: Failed to reset repo ownership. You may need to run:');
      console.log(`sudo chown -R ${sudoUser}:${sudoUser} ${repoRoot}`);
    }
  }

  console.log('\nTip: back up these credentials in your secret manager before deploying to production.');
})().catch((err) => {
  console.error('Setup aborted:', err);
  process.exit(1);
});
