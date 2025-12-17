import { AssetIdentifier, MarketDescriptor } from '../types/assets.js';
import { seedAssets, seedMarkets } from './data/assets.js';

export interface ResolveParams {
  symbol: string;
  chainId?: string;
  contractAddress?: string;
  marketType?: 'spot' | 'perp';
}

export interface SymbolResolution {
  asset: AssetIdentifier;
  market?: MarketDescriptor;
  confidence: number;
  matchedBy: 'symbol' | 'contract' | 'alias' | 'override';
}

interface OverrideRecord {
  symbol: string;
  assetId: string;
  marketId?: string;
  owner: string;
  note?: string;
  updatedAt: number;
}

export class SymbolResolver {
  private assets: AssetIdentifier[] = [];
  private markets: MarketDescriptor[] = [];
  private overrides = new Map<string, OverrideRecord>();

  constructor(initialAssets = seedAssets, initialMarkets = seedMarkets) {
    this.assets = initialAssets;
    this.markets = initialMarkets;
  }

  searchAssets(query: string, limit = 25): AssetIdentifier[] {
    const normalized = query.trim().toLowerCase();
    return this.assets
      .filter((asset) => {
        return (
          asset.assetId.includes(normalized) ||
          asset.symbol.toLowerCase().includes(normalized) ||
          asset.name.toLowerCase().includes(normalized) ||
          (asset.aliases ?? []).some((alias) => alias.toLowerCase().includes(normalized))
        );
      })
      .slice(0, limit);
  }

  resolveSymbol(params: ResolveParams): SymbolResolution | undefined {
    const overrideKey = this.buildOverrideKey(params.symbol, params.chainId);
    if (this.overrides.has(overrideKey)) {
      const entry = this.overrides.get(overrideKey)!;
      const asset = this.assets.find((a) => a.assetId === entry.assetId);
      const market = this.markets.find((m) => m.marketId === entry.marketId);
      if (asset) {
        return {
          asset,
          market,
          matchedBy: 'override',
          confidence: 1,
        };
      }
    }

    const normalized = params.symbol.trim().toLowerCase();
    const byContract = params.contractAddress
      ? this.assets.find((asset) =>
          Object.values(asset.contractAddresses).some((contracts) =>
            contracts.some((contract) => contract.toLowerCase() === params.contractAddress?.toLowerCase())
          )
        )
      : undefined;

    if (byContract) {
      return {
        asset: byContract,
        market: this.pickMarket(byContract.assetId, params.marketType),
        matchedBy: 'contract',
        confidence: 0.95,
      };
    }

    const directSymbol = this.assets.find((asset) => asset.symbol.toLowerCase() === normalized);
    if (directSymbol) {
      return {
        asset: directSymbol,
        market: this.pickMarket(directSymbol.assetId, params.marketType),
        matchedBy: 'symbol',
        confidence: 0.9,
      };
    }

    const aliasMatch = this.assets.find((asset) => (asset.aliases ?? []).some((alias) => alias.toLowerCase() === normalized));
    if (aliasMatch) {
      return {
        asset: aliasMatch,
        market: this.pickMarket(aliasMatch.assetId, params.marketType),
        matchedBy: 'alias',
        confidence: 0.75,
      };
    }

    return undefined;
  }

  registerOverride(symbol: string, assetId: string, marketId: string | undefined, owner: string, note?: string) {
    this.overrides.set(this.buildOverrideKey(symbol), {
      symbol,
      assetId,
      marketId,
      owner,
      note,
      updatedAt: Date.now(),
    });
  }

  attachAsset(asset: AssetIdentifier) {
    this.assets.push(asset);
  }

  attachMarket(market: MarketDescriptor) {
    this.markets.push(market);
  }

  private pickMarket(assetId: string, marketType?: 'spot' | 'perp') {
    return this.markets.find((market) => market.baseAssetId === assetId && (!marketType || market.marketType === marketType));
  }

  private buildOverrideKey(symbol: string, chainId?: string) {
    return `${symbol.toLowerCase()}::${chainId ?? 'any'}`;
  }
}
