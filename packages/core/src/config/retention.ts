export interface RetentionPolicy {
  cacheSeconds: number;
  tradesDays: number;
  candles1sDays: number;
  candles5sDays: number;
  candles1mDays: number;
}

export const defaultRetention: RetentionPolicy = {
  cacheSeconds: 600,
  tradesDays: 14,
  candles1sDays: 30,
  candles5sDays: 90,
  candles1mDays: 365,
};
