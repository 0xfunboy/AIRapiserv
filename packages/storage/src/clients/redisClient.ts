import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let redis: Redis | undefined;

export function getRedisClient() {
  if (!redis) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379/0';
    redis = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: true,
      maxRetriesPerRequest: 5,
    });
  }
  return redis;
}
