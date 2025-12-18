import { MarketsCacheRepository } from '@airapiserv/storage';
import { venueProvidersWithReal as venueProviders } from '../providers/venues/providersIndex.js';

export class VenueSyncService {
  private readonly repo = new MarketsCacheRepository();
  private readonly logger: any;
  constructor(logger?: any) {
    this.logger = logger?.child ? logger.child({ name: 'venue-sync' }) : console;
  }

  async run() {
    for (const provider of venueProviders) {
      try {
        const markets = await provider.fetchMarkets();
        await this.repo.upsertMarkets(provider.name, markets);
        this.logger.info?.({ venue: provider.name, markets: markets.length }, 'venue sync ok');
      } catch (err) {
        this.logger.error?.({ err, venue: provider.name }, 'venue sync failed');
      }
    }
  }
}
