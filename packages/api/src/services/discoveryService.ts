import { DirectoryAPIProvider, DirectoryToken } from '@airapiserv/core';
import {
  TokenRepository,
  TokenRecord,
} from '@airapiserv/storage';
import { CoinGeckoProvider } from '../providers/directory/coingeckoProvider.js';
import { CoinMarketCapProvider } from '../providers/directory/coinmarketcapProvider.js';
import { CryptoCompareProvider } from '../providers/directory/cryptocompareProvider.js';
import { DextoolsProvider } from '../providers/directory/dextoolsProvider.js';
import { CodexProvider } from '../providers/directory/codexProvider.js';

const providers: DirectoryAPIProvider[] = [
  new CoinGeckoProvider(),
  new CoinMarketCapProvider(),
  new CryptoCompareProvider(),
  new DextoolsProvider(),
  new CodexProvider(),
];

export class DiscoveryService {
  private readonly repo = new TokenRepository();
  private readonly logger: any;

  constructor(logger?: any) {
    this.logger = logger?.child ? logger.child({ name: 'discovery' }) : console;
  }

  async run() {
    const all: DirectoryToken[] = [];
    for (const provider of providers) {
      try {
        const tokens = await provider.fetchTokens();
        this.logger.info?.({ source: provider.name, tokens: tokens.length }, 'directory fetch ok');
        all.push(...tokens);
      } catch (err) {
        this.logger.error?.({ err, source: provider.name }, 'directory fetch failed');
      }
    }
    if (!all.length) return { inserted: 0 };

    const normalized: TokenRecord[] = all.map((token) => ({
      symbol: token.symbol,
      name: token.name ?? null,
      chain: token.chain ?? null,
      contractAddress: token.contractAddress ?? null,
      coingeckoId: token.coingeckoId ?? null,
      coinmarketcapId: token.coinmarketcapId ?? null,
      cryptocompareId: token.cryptocompareId ?? null,
      codexId: token.codexId ?? null,
      dextoolsId: token.dextoolsId ?? null,
      status: 'active',
      discoveryConfidence: token.contractAddress ? 1 : 0.5,
    }));

    await this.repo.upsertTokens(normalized);
    return { inserted: normalized.length };
  }
}
