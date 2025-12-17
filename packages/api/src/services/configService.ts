import { getRedisClient } from '@airapiserv/storage';

const OVERRIDE_KEY = 'config:overrides';

const ALLOWED_KEYS = [
  'ENABLE_COINGECKO_FALLBACK',
  'ENABLE_CRYPTOCOMPARE_FALLBACK',
  'FALLBACK_POLL_INTERVAL_MS',
  'FALLBACK_SYMBOLS',
  'BINANCE_SYMBOLS',
  'BYBIT_SYMBOLS',
  'COINGECKO_MARKETS_FALLBACK',
  'COINGECKO_MARKETS_LIMIT',
  'COINGECKO_MARKETS_VS',
  'COINGECKO_MARKETS_QUOTE',
  'CRYPTOCOMPARE_SYMBOLS',
  'ENABLE_TOKEN_CATALOG',
  'TOKEN_CATALOG_REFRESH_MS',
  'API_PORT',
  'WEB_PORT',
] as const;

type AllowedKey = (typeof ALLOWED_KEYS)[number];

export class ConfigService {
  private readonly redis = getRedisClient();

  async getOverrides() {
    const data = await this.redis.hgetall(OVERRIDE_KEY);
    return data ?? {};
  }

  async getEffectiveConfig() {
    const overrides = await this.getOverrides();
    const env = process.env;
    const config: Record<AllowedKey, string> = {} as Record<AllowedKey, string>;

    for (const key of ALLOWED_KEYS) {
      config[key] = (overrides[key] ?? env[key] ?? '').toString();
    }

    return {
      values: config,
      keysPresent: {
        COINGECKO_API_KEY: Boolean(env.COINGECKO_API_KEY),
        COINMARKETCAP_API_KEY: Boolean(env.COINMARKETCAP_API_KEY),
        CRYPTOCOMPARE_API_KEY: Boolean(env.CRYPTOCOMPARE_API_KEY),
        DEXTOOLS_API_KEY: Boolean(env.DEXTOOLS_API_KEY),
        CODEX_API_KEY: Boolean(env.CODEX_API_KEY),
      },
    };
  }

  async updateConfig(payload: Record<string, unknown>) {
    const updates: Record<string, string> = {};
    for (const key of ALLOWED_KEYS) {
      if (payload[key] === undefined) continue;
      updates[key] = String(payload[key]);
    }
    if (Object.keys(updates).length) {
      await this.redis.hset(OVERRIDE_KEY, updates);
    }
    return this.getEffectiveConfig();
  }
}
