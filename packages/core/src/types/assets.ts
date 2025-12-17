export interface AssetIdentifier {
  assetId: string;
  name: string;
  symbol: string;
  chainId?: string;
  contractAddresses: Record<string, string[]>; // chain -> contracts
  decimals?: number;
  aliases?: string[];
  providerCoverage?: string[];
}

export type MarketType = 'spot' | 'perp';

export interface MarketDescriptor {
  marketId: string;
  baseAssetId: string;
  quoteAssetId: string;
  marketType: MarketType;
  venue: string;
  venueSymbol: string;
  venueMarketId?: string;
  status: 'active' | 'inactive' | 'maintenance';
  supportedIntervals: string[];
}

export interface ProviderMarketCoverage {
  provider: string;
  marketIds: string[];
  latencyMs?: number;
  depthLevels?: number;
}
