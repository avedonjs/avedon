# Packages

vexjs is a pnpm + Turborepo monorepo. Applications depend on published-style workspace packages; the `example` app consumes them via `workspace:*`.

## Core

| Package | Responsibility |
|---------|----------------|
| [`@vexjs/shared`](../packages/shared) | Shared types and the adapter interface |
| [`@vexjs/compiler`](../packages/compiler) | Parse `.vex`, emit client/server modules, scoped CSS |
| [`@vexjs/runtime`](../packages/runtime) | `signal` / `computed` / `effect`, hydration, client router, form enhance |
| [`@vexjs/server`](../packages/server) | Route match, guards, `load` / `actions` / `api_*`, SSR orchestration |
| [`@vexjs/vite-plugin`](../packages/vite-plugin) | Vite transform, HMR, and dev middleware for `.vex` |

## Adapters

| Package | Status |
|---------|--------|
| [`@vexjs/adapter-node`](../packages/adapter-node) | Production Node HTTP + static assets |
| [`@vexjs/adapter-bun`](../packages/adapter-bun) | Interface stub |
| [`@vexjs/adapter-cloudflare`](../packages/adapter-cloudflare) | Interface stub |

Adapters sit outside the platform-agnostic server core so deploy targets can vary without rewriting route logic.

## CLI

| Package | Commands |
|---------|----------|
| [`vex`](../packages/cli) | `create`, `dev`, `build`, `start` |

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
