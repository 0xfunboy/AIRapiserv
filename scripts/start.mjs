#!/usr/bin/env node
import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { promisify } from 'node:util';

const cliArgs = new Set(process.argv.slice(2));
const forceNonInteractive = cliArgs.has('--non-interactive');
const smokeMode = cliArgs.has('--smoke');

const rl = createInterface({ input, output });
let inputClosed = false;
rl.on('close', () => {
  inputClosed = true;
});

const isInteractive = Boolean(process.stdin.isTTY) && !forceNonInteractive;
const wait = promisify(setTimeout);
const envPath = path.resolve('.env');

const yesNo = async (question, defaultValue = true) => {
  const suffix = defaultValue ? '[Y/n]' : '[y/N]';
  if (inputClosed || !isInteractive) {
    return defaultValue;
  }
  const answer = (await rl.question(`${question} ${suffix} `)).trim().toLowerCase();
  if (!answer) return defaultValue;
  return ['y', 'yes'].includes(answer);
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

const runCommandCapture = (cmd, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('exit', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim() || `${cmd} exited with code ${code}`));
    });
    child.on('error', reject);
  });

const waitForHealth = async (url, timeoutMs = 30000, intervalMs = 1000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {}
    await wait(intervalMs);
  }
  return false;
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

const applyEnv = (env) => {
  for (const [key, value] of Object.entries(env)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
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

const getPidsForPort = async (port) => {
  try {
    const { stdout } = await runCommandCapture('lsof', ['-ti', `tcp:${port}`]);
    const pids = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (pids.length) return pids;
  } catch {}
  try {
    const { stdout } = await runCommandCapture('fuser', ['-n', 'tcp', `${port}`]);
    const pids = stdout
      .split(' ')
      .map((line) => line.trim())
      .filter(Boolean);
    if (pids.length) return pids;
  } catch {}
  return [];
};

const findAvailablePort = async (startPort, attempts = 20) => {
  for (let i = 0; i < attempts; i += 1) {
    const candidate = startPort + i;
    const inUse = await testConnection('127.0.0.1', candidate, 300);
    if (!inUse) return candidate;
  }
  return null;
};

const ensurePortFree = async (name, port) => {
  const inUse = await testConnection('127.0.0.1', port, 500);
  if (!inUse) return;

  console.log(`\n${name} port ${port} is already in use.`);
  if (!isInteractive) {
    const fallback = await findAvailablePort(port + 1);
    if (fallback) {
      console.log(`Using ${name} port ${fallback} for this run.`);
      return fallback;
    }
    console.log(`Stop the existing process or change ${name.toUpperCase()}_PORT, then rerun ./start.`);
    await rl.close();
    process.exit(1);
  }

  const wantsKill = await yesNo('Terminate the existing process on that port now?', true);
  if (!wantsKill) {
    const fallback = await findAvailablePort(port + 1);
    if (fallback) {
      console.log(`Using ${name} port ${fallback} for this run.`);
      return fallback;
    }
    console.log(`Stop the existing process or change ${name.toUpperCase()}_PORT, then rerun ./start.`);
    await rl.close();
    process.exit(1);
  }

  const pids = await getPidsForPort(port);
  if (!pids.length) {
    const fallback = await findAvailablePort(port + 1);
    if (fallback) {
      console.log(`Could not identify the process. Using ${name} port ${fallback} for this run.`);
      return fallback;
    }
    console.log('Could not identify the process. Stop it manually and rerun ./start.');
    await rl.close();
    process.exit(1);
  }

  await runCommand('kill', ['-TERM', ...pids]);
  await wait(500);
  const stillInUse = await testConnection('127.0.0.1', port, 500);
  if (stillInUse) {
    await runCommand('kill', ['-KILL', ...pids]);
    await wait(300);
  }

  const freed = !(await testConnection('127.0.0.1', port, 500));
  if (!freed) {
    const fallback = await findAvailablePort(port + 1);
    if (fallback) {
      console.log(`Port ${port} is still in use. Using ${name} port ${fallback} for this run.`);
      return fallback;
    }
    console.log(`Port ${port} is still in use. Stop it manually and rerun ./start.`);
    await rl.close();
    process.exit(1);
  }
};

const ensureEnv = async () => {
  if (!existsSync(envPath)) {
    const wantsSetup = await yesNo('No .env found. Run ./setup now?', isInteractive);
    if (!wantsSetup) {
      console.log('Cannot continue without .env. Aborting.');
      await rl.close();
      process.exit(1);
    }
    await runCommand('pnpm', ['project:setup']);
  }
};

const ensureDependencies = async () => {
  const hasModules = existsSync(path.resolve('node_modules'));
  if (!hasModules) {
    const wantsInstall = await yesNo('Dependencies are missing. Run pnpm install now?', isInteractive);
    if (!wantsInstall) {
      console.log('Cannot continue without dependencies. Aborting.');
      await rl.close();
      process.exit(1);
    }
    await runCommand('pnpm', ['install']);
  }
};

const checkServices = async (env) => {
  const redisUrl = env.REDIS_URL ?? 'redis://127.0.0.1:6379/0';
  const clickhouseUrl = env.CLICKHOUSE_URL ?? 'http://127.0.0.1:8123';
  let pgHost = env.PG_HOST ?? '127.0.0.1';
  let pgPort = env.PG_PORT ?? '5432';
  if (env.DATABASE_URL) {
    try {
      const url = new URL(env.DATABASE_URL);
      pgHost = url.hostname || pgHost;
      pgPort = url.port || pgPort;
    } catch {}
  }

  let redisHost = '127.0.0.1';
  let redisPort = '6379';
  try {
    const url = new URL(redisUrl.includes('://') ? redisUrl : `redis://${redisUrl}`);
    redisHost = url.hostname;
    redisPort = url.port || '6379';
  } catch {}

  let clickHost = '127.0.0.1';
  let clickPort = '8123';
  try {
    const url = new URL(clickhouseUrl.includes('://') ? clickhouseUrl : `http://${clickhouseUrl}`);
    clickHost = url.hostname;
    clickPort = url.port || (url.protocol === 'https:' ? '8443' : '8123');
  } catch {}

  const checks = [
    { name: 'Redis', host: redisHost, port: redisPort, tip: 'Install redis-server or update REDIS_URL.' },
    { name: 'ClickHouse', host: clickHost, port: clickPort, tip: 'Install clickhouse-server or update CLICKHOUSE_URL.' },
    { name: 'Postgres', host: pgHost, port: pgPort, tip: 'Install postgresql or update PG_HOST/PG_PORT.' },
  ];

  console.log('\nChecking database connectivity...');
  const failures = [];
  for (const svc of checks) {
    const ok = await testConnection(svc.host, Number(svc.port));
    if (ok) {
      console.log(`[OK] ${svc.name} reachable at ${svc.host}:${svc.port}`);
    } else {
      console.log(`[FAIL] ${svc.name} not reachable at ${svc.host}:${svc.port}`);
      console.log(`       Tip: ${svc.tip}`);
      failures.push(svc);
    }
    await wait(100);
  }

  return failures;
};

const checkPostgresAuth = async (env) => {
  const host = env.PG_HOST ?? '127.0.0.1';
  const port = Number(env.PG_PORT ?? '5432');
  const user = env.PG_USER ?? 'airapiserv';
  const password = env.PG_PASSWORD ?? 'airapiserv';
  const database = env.PG_DATABASE ?? 'airapiserv';

  try {
    const pgModule = await import('pg');
    const Client = pgModule.Client ?? pgModule.default?.Client;
    if (!Client) {
      return { ok: false, reason: 'pg-missing' };
    }
    const client = env.DATABASE_URL
      ? new Client({ connectionString: env.DATABASE_URL })
      : new Client({ host, port, user, password, database });
    await client.connect();
    await client.query('select 1;');
    await client.end();
    return { ok: true };
  } catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND') {
      return { ok: false, reason: 'pg-missing', error: err };
    }
    return { ok: false, reason: err?.code || 'auth-failed', error: err };
  }
};

const resetPostgresCredentials = async (env) => {
  let user = env.PG_USER ?? 'airapiserv';
  let password = env.PG_PASSWORD ?? 'airapiserv';
  let database = env.PG_DATABASE ?? 'airapiserv';
  if (env.DATABASE_URL) {
    try {
      const url = new URL(env.DATABASE_URL);
      user = url.username || user;
      password = url.password ? decodeURIComponent(url.password) : password;
      const dbName = url.pathname?.replace(/^\//, '');
      if (dbName) database = dbName;
    } catch {}
  }
  const safeUser = user.replace(/'/g, "''");
  const safePassword = password.replace(/'/g, "''");
  const safeDb = database.replace(/'/g, "''");

  const roleCheck = await runCommandCapture('sudo', ['-u', 'postgres', 'psql', '-tAc', `SELECT 1 FROM pg_roles WHERE rolname='${safeUser}'`]);
  if (roleCheck.stdout.trim() !== '1') {
    await runCommand('sudo', ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE ROLE ${user} LOGIN PASSWORD '${safePassword}';`]);
  } else {
    await runCommand('sudo', ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-c', `ALTER USER ${user} WITH PASSWORD '${safePassword}';`]);
  }

  const dbCheck = await runCommandCapture('sudo', ['-u', 'postgres', 'psql', '-tAc', `SELECT 1 FROM pg_database WHERE datname='${safeDb}'`]);
  if (dbCheck.stdout.trim() !== '1') {
    await runCommand('sudo', ['-u', 'postgres', 'createdb', '-O', user, database]);
  }

  await runCommand('sudo', ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-c', `GRANT ALL PRIVILEGES ON DATABASE ${database} TO ${user};`]);
};

(async () => {
  console.log('AIRapiserv start: validating environment...');
  await ensureEnv();
  await ensureDependencies();

  let env = parseEnv(envPath);
  applyEnv(env);
  let failures = await checkServices(env);

  if (failures.length) {
    const wantsSetup = await yesNo('\nOne or more databases are down. Run ./setup now to install/start them?', isInteractive);
    if (wantsSetup) {
      await runCommand('pnpm', ['project:setup']);
      env = parseEnv(envPath);
      applyEnv(env);
      failures = await checkServices(env);
    }
  }

  if (failures.length) {
    console.log('\nDatabase services are still unavailable. Fix them and rerun ./start.');
    await rl.close();
    process.exit(1);
  }

  let apiPort = Number(env.API_PORT ?? '3333');
  let webPort = Number(env.WEB_PORT ?? env.PORT ?? '3000');
  const resolvedApiPort = await ensurePortFree('API', apiPort);
  if (resolvedApiPort) {
    apiPort = resolvedApiPort;
  }
  const resolvedWebPort = await ensurePortFree('WEB', webPort);
  if (resolvedWebPort) {
    webPort = resolvedWebPort;
  }

  if (apiPort !== Number(env.API_PORT ?? '3333')) {
    console.log(`API will run on port ${apiPort} for this session.`);
  }
  process.env.API_PORT = String(apiPort);
  process.env.NEXT_PUBLIC_API_BASE = `http://localhost:${apiPort}`;
  process.env.NEXT_PUBLIC_WS_URL = `ws://localhost:${apiPort}/v1/ws`;

  if (webPort !== Number(env.WEB_PORT ?? env.PORT ?? '3000')) {
    console.log(`WebGUI will run on port ${webPort} for this session.`);
  }
  process.env.WEB_PORT = String(webPort);
  process.env.PORT = String(webPort);

  const pgAuth = await checkPostgresAuth(env);
  if (!pgAuth.ok) {
    if (pgAuth.reason === 'pg-missing') {
      console.log('\nPostgres driver missing. Run pnpm install, then rerun ./start.');
      await rl.close();
      process.exit(1);
    }
    console.log('\nPostgres authentication failed with the credentials in .env.');
    if (!isInteractive) {
      console.log('Run ./setup or reset the Postgres password, then rerun ./start.');
      await rl.close();
      process.exit(1);
    }
    const wantsReset = await yesNo('Reset Postgres user/password now (sudo required)?', true);
    if (wantsReset) {
      await resetPostgresCredentials(env);
    }
    const retry = await checkPostgresAuth(env);
    if (!retry.ok) {
      console.log('Postgres authentication still failing. Fix credentials and rerun ./start.');
      await rl.close();
      process.exit(1);
    }
  }

  console.log('\nRunning migrations...');
  await runCommand('pnpm', ['db:migrate']);

  if (smokeMode) {
    console.log('\nStarting API for smoke test...');
    await runCommand('pnpm', ['--filter', '@airapiserv/core', '--filter', '@airapiserv/storage', 'build']);
    const apiProc = spawn('pnpm', ['--filter', 'api', 'start'], { stdio: 'inherit' });
    const apiPort = env.API_PORT ?? '3333';
    const healthUrl = `http://127.0.0.1:${apiPort}/v1/health`;
    let apiExited = false;
    const apiExit = new Promise((resolve) => {
      apiProc.on('exit', (code) => {
        apiExited = true;
        resolve(code);
      });
    });

    const healthy = await waitForHealth(healthUrl);
    const stopApi = async () => {
      if (apiExited) return;
      apiProc.kill('SIGTERM');
      await Promise.race([apiExit, wait(5000)]);
      if (!apiExited) {
        apiProc.kill('SIGKILL');
        await apiExit;
      }
    };

    if (!healthy) {
      await stopApi();
      throw new Error(`API did not become healthy at ${healthUrl}`);
    }

    await stopApi();
    console.log('Smoke test passed.');
    await rl.close();
    process.exit(0);
  }

  console.log('\nStarting the dev stack (API + ingestion + WebGUI)...');
  await runCommand('pnpm', ['dev'], {
    env: {
      ...process.env,
      PORT: String(webPort),
      API_PORT: String(apiPort),
      NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE ?? `http://localhost:${apiPort}`,
      NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL ?? `ws://localhost:${apiPort}/v1/ws`,
    },
  });

  await rl.close();
})().catch((err) => {
  console.error('Start failed:', err);
  process.exit(1);
});
