# Providers and policies

## WebSocket priority

| Order | Provider | Notes |
| --- | --- | --- |
| 1 | Binance (spot + futures) | Streams `@trade`, rolling ticker 24h |
| 2 | Bybit (spot + perp) | Public v5 WS for trades + tickers |
| 3 | OKX | Connector placeholder, extend base class |
| 4 | Coinbase | REST/WS mix |
| 5 | Kraken | Needs multiplexed feeds |
| 6 | Bitget | |
| 7 | KuCoin | |
| 8 | Hyperliquid | |
| 9 | Paradex | |

## REST fallback

| Provider | Usage | Constraints |
| --- | --- | --- |
| CoinGecko Pro | Discovery + long tail pricing | Paid plan already available |
| CoinMarketCap | Base coverage | Paid plan already available |
| CryptoCompare / CoinDesk (free) | Last-resort fallback | ≤ 1 call per asset / 5 min and lifetime 250k |
| DexScreener | Pool discovery + contract addresses | Public GETs |
| DefiLlama | Enrichment + cross-chain mapping | Public GETs |

## Implementation status

- `packages/ingestors` exposes `BinanceSpotConnector`, `BybitConnector`, `CoinGeckoFallbackConnector`, `CryptoCompareFallbackConnector`.
- New adapters must extend `BaseConnector` and emit unified `MarketEvent`s.
- Global throttling handled through a shared poll interval (default 5 minutes, configurable via `FALLBACK_POLL_INTERVAL_MS`).
- Routing policies live in `@airapiserv/core/routing/providerPolicy.ts` and are exposed via `/v1/providers`.
