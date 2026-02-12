# Video

https://youtu.be/CT3Ctv1RICo

# Buena Dashboard

Production URL: `https://buena.grzegorz.ie/`

## Prerequisites

- Bun installed
- PostgreSQL available
- OpenRouter environment variables configured

Required env variables:

- `PORT`
- `DATABASE_URL`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`

Optional env variable:

- `OPENROUTER_BASE_URL` (defaults to OpenRouter public API)

Openrouter costs:
<img width="1281" height="385" alt="image" src="https://github.com/user-attachments/assets/865dfdd4-44e5-4784-a920-b633e2d03aaf" />

Its not alot.

## Main scripts

These are the two primary scripts for local and deployed runtime:

- `bun run dev`
- `bun run prod`

## PM2 (optional)

Use PM2 for managed restarts in production:

- `bun run prod:pm2:start`
- `bun run prod:pm2:restart`
- `bun run prod:pm2:stop`
- `bun run prod:pm2:logs`

## Useful commands

- Build client: `bun run client:build`
- Dev DB init: `bun run prisma:dev:init`
- Prod DB init: `bun run prisma:prod:init`
