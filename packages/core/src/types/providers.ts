export type DirectoryToken = {
  symbol: string;
  name?: string | null;
  chain?: string | null;
  contractAddress?: string | null;
  coingeckoId?: string | null;
  coinmarketcapId?: string | null;
  cryptocompareId?: string | null;
  codexId?: string | null;
  dextoolsId?: string | null;
  source: string;
  metadata?: Record<string, unknown>;
};

export interface DirectoryAPIProvider {
  readonly name: string;
  fetchTokens(): Promise<DirectoryToken[]>;
}

export type VenueCapabilities = {
  hasSpot: boolean;
  hasPerp: boolean;
  wsTrades: boolean;
  wsKlines: boolean;
  restOhlcv: boolean;
};

export type VenueMarket = {
  venue: string;
  marketType: 'spot' | 'perp' | 'options';
  baseSymbol: string;
  quoteSymbol: string;
  venueSymbol: string;
};

export interface VenueProvider {
  readonly name: string;
  capabilities: VenueCapabilities;
  fetchMarkets(): Promise<VenueMarket[]>;
}
