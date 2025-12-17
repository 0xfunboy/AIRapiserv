import { AssetIdentifier, MarketDescriptor } from '../../types/assets.js';

export const seedAssets: AssetIdentifier[] = [
  {
    assetId: 'btc',
    name: 'Bitcoin',
    symbol: 'BTC',
    contractAddresses: {},
    aliases: ['XBT'],
    providerCoverage: ['binance', 'bybit', 'okx', 'coinbase', 'kraken'],
  },
  {
    assetId: 'eth',
    name: 'Ethereum',
    symbol: 'ETH',
    chainId: '1',
    contractAddresses: {
      '1': ['0x0000000000000000000000000000000000000000'],
      '42161': ['0x82af49447d8a07e3bd95bd0d56f35241523fbab1'],
    },
    decimals: 18,
    aliases: ['WETH'],
    providerCoverage: ['binance', 'bybit', 'okx', 'coinbase', 'kraken', 'dexscreener'],
  },
];

export const seedMarkets: MarketDescriptor[] = [
  {
    marketId: 'binance:BTC-USDT:spot',
    baseAssetId: 'btc',
    quoteAssetId: 'usdt',
    marketType: 'spot',
    venue: 'binance',
    venueSymbol: 'btcusdt',
    status: 'active',
    supportedIntervals: ['1s', '5s', '1m', '5m', '1h', '1d'],
  },
  {
    marketId: 'bybit:BTC-USDT:perp',
    baseAssetId: 'btc',
    quoteAssetId: 'usdt',
    marketType: 'perp',
    venue: 'bybit',
    venueSymbol: 'BTCUSDT',
    status: 'active',
    supportedIntervals: ['1s', '5s', '1m', '5m', '1h'],
  },
  {
    marketId: 'binance:ETH-USDT:spot',
    baseAssetId: 'eth',
    quoteAssetId: 'usdt',
    marketType: 'spot',
    venue: 'binance',
    venueSymbol: 'ethusdt',
    status: 'active',
    supportedIntervals: ['1s', '5s', '1m', '5m', '1h', '1d'],
  },
];
