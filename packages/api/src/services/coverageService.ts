import { MarketsCacheRepository, TokenRepository, TokenVenueRecord } from '@airapiserv/storage';
import { selectPrioritySource } from '@airapiserv/core';
import { venueProvidersWithReal } from '../providers/venues/providersIndex.js';

type CoverageOptions = {
  quotePreference?: string[];
};

const DEFAULT_QUOTES = ['USDT', 'USDC', 'USD', 'EUR', 'BTC', 'ETH'];

const capsMap = new Map(
  venueProvidersWithReal.map((p) => [p.name, p.capabilities])
);

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
    const tokens = await this.tokens.listActiveTokens();
    if (!tokens.length) return;
    const symbols = tokens.map((t) => t.symbol.toUpperCase());
    const markets = await this.markets.listByBaseSymbols(symbols);
    const marketsByBase = new Map<string, typeof markets>();
    for (const m of markets) {
      const key = (m.baseSymbol ?? '').toUpperCase();
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
        priorityUpdates.push({ tokenId: token.tokenId, source: null });
        continue;
      }
      const sorted = ms.sort((a, b) => quoteRank(a.quoteSymbol) - quoteRank(b.quoteSymbol));
      const sources: string[] = [];
      for (const m of sorted) {
        const caps = capsMap.get(m.venue);
        venuesToUpsert.push({
          tokenId: token.tokenId,
          venue: m.venue,
          marketType: m.marketType,
          baseSymbol: m.baseSymbol,
          quoteSymbol: m.quoteSymbol,
          venueSymbol: m.venueSymbol,
          wsSupported: Boolean(caps?.wsTrades || caps?.wsKlines),
          ohlcvSupported: Boolean(caps?.wsKlines || caps?.restOhlcv),
        });
        if (caps?.wsTrades || caps?.wsKlines) {
          sources.push(sourceName(m.venue));
        } else if (caps?.restOhlcv) {
          sources.push('REST_EXCHANGE');
        }
      }
      const best = selectPrioritySource(Array.from(new Set(sources)));
      priorityUpdates.push({ tokenId: token.tokenId, source: best });
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
