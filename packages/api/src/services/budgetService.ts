import { getRedisClient } from '@airapiserv/storage';

const DEFAULT_BUDGETS: Record<string, number> = {
  coingecko: 20000,
  coinmarketcap: 5000,
  cryptocompare: 5000,
  dextools: 5000,
  codex: 5000,
};

const PROVIDERS = Object.keys(DEFAULT_BUDGETS);

export class BudgetService {
  private readonly redis = getRedisClient();

  private limitFor(provider: string) {
    const envKey = `${provider.toUpperCase()}_BUDGET_DAILY`;
    const fromEnv = process.env[envKey];
    if (fromEnv && !Number.isNaN(Number(fromEnv))) return Number(fromEnv);
    return DEFAULT_BUDGETS[provider] ?? 5000;
  }

  private key(provider: string) {
    const today = new Date().toISOString().slice(0, 10);
    return `budget:${provider}:${today}`;
  }

  async canSpend(provider: string, cost = 1) {
    const limit = this.limitFor(provider);
    if (limit <= 0) return false;
    const key = this.key(provider);
    const current = Number(await this.redis.get(key)) || 0;
    return current + cost <= limit;
  }

  async consume(provider: string, cost = 1) {
    const key = this.key(provider);
    const ttl = 60 * 60 * 24; // 1 day
    await this.redis.incrby(key, cost);
    await this.redis.expire(key, ttl);
  }

  async getUsage() {
    const today = new Date().toISOString().slice(0, 10);
    const usage: Record<string, { used: number; limit: number }> = {};
    for (const provider of PROVIDERS) {
      const limit = this.limitFor(provider);
      const current = Number((await this.redis.get(this.key(provider))) ?? 0);
      usage[provider] = { used: current, limit };
    }
    return { date: today, usage };
  }
}
