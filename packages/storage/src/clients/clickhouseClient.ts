import 'dotenv/config';
import { createClient, ClickHouseClient } from '@clickhouse/client';

let client: ClickHouseClient | undefined;

export function getClickHouseClient() {
  if (!client) {
    const password = process.env.CLICKHOUSE_PASSWORD;
    if (!password) {
      throw new Error('CLICKHOUSE_PASSWORD is required (dotenv not loaded or missing env)');
    }
    client = createClient({
      url: process.env.CLICKHOUSE_URL ?? 'http://127.0.0.1:8123',
      username: process.env.CLICKHOUSE_USER ?? process.env.CLICKHOUSE_USERNAME ?? 'default',
      password,
    });
  }
  return client;
}
