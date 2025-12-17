# API reference

All endpoints live under `/v1`. Public access uses JWT (`Authorization: Bearer <token>`). The WebGUI bypasses auth in dev mode.

## REST

| Endpoint | Query params | Description |
| --- | --- | --- |
| `GET /v1/resolve` | `symbol`, `chain?`, `marketType?`, `contractAddress?` | Symbol/contract resolution |
| `GET /v1/price` | `marketId` | Returns last, mark, best bid/ask |
| `GET /v1/ohlcv` | `marketId`, `interval`, `limit?` | Normalised candles |
| `GET /v1/trades` | `marketId`, `limit?` | Latest normalised trades |
| `GET /v1/search` | `q` | Asset search |
| `GET /v1/providers` | `marketType`, `requestType`, `supportsWs?` | Provider priority for each request type |
| `GET /v1/health` | - | Health of Redis / ClickHouse / Postgres |

## WebSocket `/v1/ws`

Messages are JSON:

```json
{ "type": "subscribe", "channel": "ticker", "marketId": "binance:BTC-USDT:spot", "interval": "1s" }
```

Channels: `ticker`, `trades`, `candles`. The server responds with `{ "type":"update", "channel":"ticker", ... }`.

## AIRTrack compatibility

| Current AIRTrack feature | Legacy endpoint | AIRapiserv endpoint | Notes |
| --- | --- | --- | --- |
| Symbol resolution | N/A | `GET /v1/resolve?symbol=BTC&quote=USD&marketType=spot` | Response includes canonical `marketId` |
| Spot/OHLCV (CryptoCompare) | `/data/v2/histominute` etc | `GET /v1/ohlcv?marketId=<id>&interval=1m&limit=720` | Same `from/to` semantics can be added down the line |
| Last price | `/data/price` | `GET /v1/price?marketId=<id>` | Returns `last`, `mark`, `bestBid`, `bestAsk` |
| Recent trades | N/A | `GET /v1/trades?marketId=<id>&limit=100` | Fully normalised trades |
| Realtime push | CryptoCompare WS | `ws /v1/ws` with `ticker`/`candles` | Supports 1s/5s rolling candles |

Migration steps:

1. Call `/v1/resolve` once to store the canonical `marketId` for each symbol.
2. Replace CryptoCompare OHLCV and price endpoints with `/v1/ohlcv` + `/v1/price` using `marketId`.
3. Use `ws /v1/ws` with the `candles` channel for 1s/5s charting.
4. For long-tail markets rely on the fallback layer; the global poll interval (≥ 5 minutes) protects the free quotas.
