import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let pool: Pool | undefined;

export function getPgPool() {
  if (!pool) {
    pool = new Pool({
      host: process.env.PG_HOST ?? 'localhost',
      port: Number(process.env.PG_PORT ?? 5432),
      user: process.env.PG_USER ?? 'airapiserv',
      password: process.env.PG_PASSWORD ?? 'airapiserv',
      database: process.env.PG_DATABASE ?? 'airapiserv',
      max: 10,
    });
  }
  return pool;
}
