# Packages

avedon is a pnpm + Turborepo monorepo. Applications depend on published-style workspace packages; the `example` app consumes them via `workspace:*`.

## Core

| Package | Responsibility |
|---------|----------------|
| [`@avedon/shared`](../packages/shared) | Shared types and the adapter interface |
| [`@avedon/compiler`](../packages/compiler) | Parse `.avedon`, emit client/server modules, scoped CSS |
| [`@avedon/runtime`](../packages/runtime) | `signal` / `computed` / `effect`, hydration, client router, form enhance |
| [`@avedon/server`](../packages/server) | Route match, guards, middleware (`sequence` / CORS / logger / rateLimit), `load` / `actions` / `api_*`, SSR orchestration |
| [`@avedon/vite-plugin`](../packages/vite-plugin) | Vite transform, HMR, and dev middleware for `.avedon` |

## Adapters

| Package | Status |
|---------|--------|
| [`@avedon/adapter-node`](../packages/adapter-node) | Production Node HTTP + static assets |
| [`@avedon/adapter-bun`](../packages/adapter-bun) | Interface stub |
| [`@avedon/adapter-cloudflare`](../packages/adapter-cloudflare) | Interface stub |

Adapters sit outside the platform-agnostic server core so deploy targets can vary without rewriting route logic.

## CLI

| Package | Commands |
|---------|----------|
| [`avedon`](../packages/cli) | `create`, `dev`, `build`, `start` |
| [`create-avedon-app`](../packages/create-avedon-app) | `pnpm create avedon-app` / `npm create avedon-app` (same scaffold as `avedon create`) |

## Example application

| Path | Role |
|------|------|
| [`examples/basic-app`](../examples/basic-app) | Reference app (workspace name `example`) |

## Development commands

From the repo root:

```bash
pnpm build          # build packages (excludes example app build)
pnpm test           # unit tests (Vitest)
pnpm test:smoke     # smoke script
pnpm test:e2e       # Playwright
pnpm typecheck      # turbo typecheck
pnpm -F example dev # example development server
```

Each package also has a short README under `packages/<name>/README.md`.
