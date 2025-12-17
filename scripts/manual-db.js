#!/usr/bin/env node
const message = `Docker bootstrap disabled.
Start Redis (6379), ClickHouse (8123) and Postgres (5432) manually or run ./setup to install them automatically.
The docker-compose.yml file remains available if you want to use it later.`;

console.log(message);
