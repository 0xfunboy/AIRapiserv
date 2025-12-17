import { Pool } from 'pg';
import { loadEnv } from '../config/loadEnv.js';

let pool: Pool | undefined;

export function getPgPool() {
  if (!pool) {
    loadEnv();
    if (process.env.DATABASE_URL) {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
      });
    } else {
      pool = new Pool({
        host: process.env.PG_HOST ?? '127.0.0.1',
        port: Number(process.env.PG_PORT ?? 5432),
        user: process.env.PG_USER ?? 'airapiserv',
        password: process.env.PG_PASSWORD ?? 'airapiserv',
        database: process.env.PG_DATABASE ?? 'airapiserv',
        max: 10,
      });
    }
  }
  return pool;
}
