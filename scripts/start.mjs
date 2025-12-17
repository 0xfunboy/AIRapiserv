#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { promisify } from 'node:util';

const rl = createInterface({ input, output });
let inputClosed = false;
rl.on('close', () => {
  inputClosed = true;
});

const isInteractive = Boolean(process.stdin.isTTY);
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
  const pgHost = env.PG_HOST ?? '127.0.0.1';
  const pgPort = env.PG_PORT ?? '5432';

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

(async () => {
  console.log('AIRapiserv start: validating environment...');
  await ensureEnv();
  await ensureDependencies();

  let env = parseEnv(envPath);
  let failures = await checkServices(env);

  if (failures.length) {
    const wantsSetup = await yesNo('\nOne or more databases are down. Run ./setup now to install/start them?', isInteractive);
    if (wantsSetup) {
      await runCommand('pnpm', ['project:setup']);
      env = parseEnv(envPath);
      failures = await checkServices(env);
    }
  }

  if (failures.length) {
    console.log('\nDatabase services are still unavailable. Fix them and rerun ./start.');
    await rl.close();
    process.exit(1);
  }

  console.log('\nRunning migrations...');
  await runCommand('pnpm', ['db:migrate']);

  console.log('\nStarting the dev stack (API + ingestion + WebGUI)...');
  await runCommand('pnpm', ['dev']);

  await rl.close();
})().catch((err) => {
  console.error('Start failed:', err);
  process.exit(1);
});
