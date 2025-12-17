import 'dotenv/config';
import { Redis } from 'ioredis';

let redis: Redis | undefined;

export function getRedisClient() {
  if (!redis) {
    const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/0';
    redis = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: true,
      maxRetriesPerRequest: 5,
    });
  }
  return redis;
}
