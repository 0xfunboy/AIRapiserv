import { createClient, ClickHouseClient } from '@clickhouse/client';
import dotenv from 'dotenv';

dotenv.config();

let client: ClickHouseClient | undefined;

export function getClickHouseClient() {
  if (!client) {
    client = createClient({
      url: process.env.CLICKHOUSE_URL ?? 'http://localhost:8123',
      username: process.env.CLICKHOUSE_USERNAME ?? 'default',
      password: process.env.CLICKHOUSE_PASSWORD ?? '',
    });
  }
  return client;
}
