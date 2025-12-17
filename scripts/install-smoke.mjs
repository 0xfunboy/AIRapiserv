#!/usr/bin/env node
import { existsSync, copyFileSync, rmSync, readFileSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve('.');
const envPath = path.join(repoRoot, '.env');
const backupPath = path.join(repoRoot, `.env.smoke.bak.${Date.now()}`);

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });

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

const testConnection = (host, port, timeoutMs = 2000) =>
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

const parseRedisTarget = (env) => {
  const redisUrl = env.REDIS_URL ?? 'redis://127.0.0.1:6379/0';
  try {
    const url = new URL(redisUrl.includes('://') ? redisUrl : `redis://${redisUrl}`);
    return { host: url.hostname, port: Number(url.port || 6379) };
  } catch {
    return { host: '127.0.0.1', port: 6379 };
  }
};

const parseClickhouseTarget = (env) => {
  const clickhouseUrl = env.CLICKHOUSE_URL ?? 'http://127.0.0.1:8123';
  try {
    const url = new URL(clickhouseUrl.includes('://') ? clickhouseUrl : `http://${clickhouseUrl}`);
    return { host: url.hostname, port: Number(url.port || (url.protocol === 'https:' ? 8443 : 8123)) };
  } catch {
    return { host: '127.0.0.1', port: 8123 };
  }
};

const parsePostgresTarget = (env) => ({
  host: env.PG_HOST ?? '127.0.0.1',
  port: Number(env.PG_PORT ?? 5432),
});

const checkDbReachability = async (env) => {
  const redisTarget = parseRedisTarget(env);
  const clickTarget = parseClickhouseTarget(env);
  const pgTarget = parsePostgresTarget(env);

  const redisOk = await testConnection(redisTarget.host, redisTarget.port);
  const clickOk = await testConnection(clickTarget.host, clickTarget.port);
  const pgOk = await testConnection(pgTarget.host, pgTarget.port);

  return { redisOk, clickOk, pgOk };
};

const main = async () => {
  let hadEnv = false;
  try {
    if (existsSync(envPath)) {
      copyFileSync(envPath, backupPath);
      hadEnv = true;
    }
    rmSync(envPath, { force: true });

    console.log('Running setup wizard in non-interactive mode...');
    const setupResult = run('node', ['scripts/setup.mjs', '--non-interactive', '--no-install'], { stdio: 'inherit' });
    if (setupResult.status !== 0) {
      throw new Error('Setup wizard failed in non-interactive mode.');
    }

    const env = parseEnv(envPath);
    const reachability = await checkDbReachability(env);
    console.log(`DB reachability: Redis=${reachability.redisOk} ClickHouse=${reachability.clickOk} Postgres=${reachability.pgOk}`);

    console.log('Running migrations...');
    const migrateResult = run('pnpm', ['db:migrate'], { stdio: 'pipe' });
    const migrateOutput = `${migrateResult.stdout || ''}${migrateResult.stderr || ''}`;

    if (migrateResult.status !== 0) {
      if (!migrateOutput.includes('DB down')) {
        console.error(migrateOutput);
        throw new Error('pnpm db:migrate failed without a clear DB-down message.');
      }
      console.log('DB-down failure path verified.');
      return;
    }

    console.log('Running start smoke test...');
    const startResult = run('node', ['scripts/start.mjs', '--smoke', '--non-interactive'], { stdio: 'inherit' });
    if (startResult.status !== 0) {
      throw new Error('Smoke start failed.');
    }
  } finally {
    if (hadEnv) {
      copyFileSync(backupPath, envPath);
      rmSync(backupPath, { force: true });
    } else {
      rmSync(envPath, { force: true });
    }
  }
};

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
