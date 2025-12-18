import { MarketsCacheRepository, TokenRepository, TokenVenueRecord } from '@airapiserv/storage';
import { selectPrioritySource } from '@airapiserv/core';
import { venueProvidersWithReal } from '../providers/venues/providersIndex.js';

type CoverageOptions = {
  quotePreference?: string[];
  marketType?: 'spot' | 'perp' | 'all';
};

const DEFAULT_QUOTES = ['USDT', 'USDC', 'USD', 'EUR', 'BTC', 'ETH'];

const capsMap = new Map(venueProvidersWithReal.map((p) => [p.name, p.capabilities]));
const sourceName = (venue: string) => `${venue.toUpperCase()}_WS`;

export class CoverageService {
  private readonly tokens = new TokenRepository();
  private readonly markets = new MarketsCacheRepository();
  private readonly logger: any;

  constructor(logger?: any) {
    this.logger = logger?.child ? logger.child({ name: 'coverage' }) : console;
  }

  async run(opts: CoverageOptions = {}) {
    const quotePref = opts.quotePreference ?? DEFAULT_QUOTES;
    const filterType = opts.marketType ?? 'spot';
    const tokens = await this.tokens.listActiveTokens();
    if (!tokens.length) return;
    const markets = await this.markets.listAll();
    const marketsByBase = new Map<string, typeof markets>();
    for (const m of markets) {
      const key = (m.baseSymbol ?? '').toUpperCase();
      if (!key) continue;
      if (filterType !== 'all' && m.marketType !== filterType) continue;
      if (!marketsByBase.has(key)) marketsByBase.set(key, []);
      marketsByBase.get(key)!.push(m);
    }

    const venuesToUpsert: TokenVenueRecord[] = [];
    const priorityUpdates: Array<{ tokenId: string; source: string | null }> = [];

    const quoteRank = (q?: string | null) => {
      const idx = quotePref.indexOf((q ?? '').toUpperCase());
      return idx === -1 ? quotePref.length + 10 : idx;
    };

    for (const token of tokens) {
      const ms = marketsByBase.get(token.symbol.toUpperCase()) ?? [];
      if (!ms.length) {
        priorityUpdates.push({ tokenId: token.tokenId, source: 'API_FALLBACK' });
        continue;
      }
      const sorted = ms
        .filter((m) => m.baseSymbol && token.symbol && m.baseSymbol.toUpperCase() === token.symbol.toUpperCase())
        .sort((a, b) => quoteRank(a.quoteSymbol) - quoteRank(b.quoteSymbol));

      const sources: string[] = [];
      for (const m of sorted) {
        const caps = capsMap.get(m.venue);
        const wsSupported = Boolean(caps?.wsTrades || caps?.wsKlines);
        const ohlcvSupported = Boolean(caps?.wsKlines || caps?.restOhlcv);
        venuesToUpsert.push({
          tokenId: token.tokenId,
          venue: m.venue,
          marketType: m.marketType,
          baseSymbol: m.baseSymbol,
          quoteSymbol: m.quoteSymbol,
          venueSymbol: m.venueSymbol,
          wsSupported,
          ohlcvSupported,
        });
        if (wsSupported) {
          sources.push(sourceName(m.venue));
        } else if (ohlcvSupported) {
          sources.push('REST_EXCHANGE');
        }
      }
      const best = selectPrioritySource(Array.from(new Set(sources)));
      priorityUpdates.push({ tokenId: token.tokenId, source: best ?? 'API_FALLBACK' });
    }

    if (venuesToUpsert.length) {
      await this.tokens.upsertVenues(venuesToUpsert);
    }
    for (const upd of priorityUpdates) {
      await this.tokens.setPrioritySource(upd.tokenId, upd.source);
    }
    this.logger.info?.({ tokens: tokens.length, venues: venuesToUpsert.length }, 'coverage resolved');
  }
}
