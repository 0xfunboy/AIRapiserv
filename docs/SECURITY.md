# Security

## Authentication

- Fastify JWT (`@fastify/jwt`) for public/server-to-server APIs. Secrets pulled from `.env` or the secret manager.
- API keys (planned) will live in Postgres and be enforced via middleware (`x-api-key`).
- WebGUI will rely on JWT sessions with a login form (placeholder today).

## Rate limiting

- `@fastify/rate-limit` applies globally (`API_RATE_LIMIT`, default 200 req/min per IP).
- Fallback providers (CoinGecko/CryptoCompare) enforce an additional poll interval (>= 5 minutes) to respect quotas.

## Input validation

- Every route uses `zod` schemas for query validation.
- WebSocket subscriptions will be validated server-side (TODO: add schema enforcement in the WS gateway).

## Audit & logging

- Pino logger is used across ingestion and API.
- `audit_events` table records admin overrides and other privileged actions (logic to be expanded).
- WebGUI Admin page will read audit logs and override entries.

## Secrets

- Local development uses `.env` (generated via `./setup`).
- Production should pull secrets from a dedicated manager (AWS SSM, Doppler, Vault, ...).

## Hardening backlog

1. Enable HTTPS termination (Fastify TLS, NGINX, or Cloudflare).
2. Implement RBAC in Postgres and enforce row-level policies for watchlists/overrides.
3. Feed logs into SIEM / enable WAF rules on public routes.
4. Add circuit breakers + Prometheus metrics for unstable providers (Kraken, DEX, etc.).
