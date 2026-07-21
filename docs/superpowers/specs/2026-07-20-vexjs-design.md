# vexjs Design Spec

**Date:** 2026-07-20  
**Status:** Approved (design sections + plan confirmed)

## Summary

vexjs is a TypeScript-first full-stack web framework with:

- A custom Svelte-like component language (`.vex`)
- Angular-style explicit routing via `routes.ts` (not file-based)
- Colocated server logic (`load`, `actions`, `api`) in the same `.vex` file
- Hybrid rendering (`ssr` | `ssg` | `csr`)
- Vite-based toolchain and an adapter model (Node first)

Public announcement happens only when the full skeleton below is complete.

## Goals

- One mental model: page UI + styles + client + server in `.vex`
- Explicit routes in `routes.ts` with per-route render mode
- Platform-agnostic server core (`Request`/`Response`); adapters for deploy targets
- Strong TypeScript DX from day one

## Non-goals (post-announcement)

- Bun / Cloudflare Workers adapter implementations (interface only until then)
- Large store ecosystem, animations toolkit, or UI component library
- File-based routing

## Architecture

### Packages (monorepo)

| Package | Responsibility |
|---------|----------------|
| `@vexjs/compiler` | Parse `.vex`, client/server codegen, scoped CSS |
| `@vexjs/runtime` | Hydration, client navigation, form enhancement |
| `@vexjs/server` | Route match, guards, load/actions/api, SSR, hooks |
| `@vexjs/vite-plugin` | Vite transform + HMR for `.vex` |
| `@vexjs/adapter-node` | Production Node HTTP + static assets |
| `vex` (CLI) | `create`, `dev`, `build`, `preview` |

### Data flow

```
.vex ──► compiler ──► vite-plugin ──► client bundle + server bundle
routes.ts ─────────────────────────► @vexjs/server
server bundle ──► adapter-node ──► Node HTTP
client bundle ──────────────────► browser (hydrate)
```

## `.vex` file format

### Sections

1. `<script lang="ts">` — client only; never runs on server after split
2. `<script lang="ts" server>` — server only; exports `load`, `actions`, `api`
3. `<style>` — scoped by default
4. Markup — Svelte-like template syntax

### Server exports

- `load(event: LoadEvent): Promise<Record<string, unknown>> | Record<string, unknown>`
- `actions: Record<string, ActionHandler>` — `default` or named; form `action="?/name"`
- `api: Record<string, ApiHandler>` — keys are absolute from site root, e.g. `'GET /api/items'`

Server script must never appear in the client bundle.

### Template syntax (v1)

- Text/expressions: `{expr}`
- Events: `on:click={handler}`
- Control flow: `{#if}`, `{:else}`, `{/if}`, `{#each}`, `{/each}`, `{#await}`, `{:then}`, `{:catch}`, `{/await}`
- Bindings: `bind:value={name}`
- Forms: `method="POST"` → `actions.default`

### Reactivity

Compile-time updates (no virtual DOM). Minimal runtime stores: `writable` / `readable`.

## Routing (`routes.ts`)

```ts
import type { Routes } from '@vexjs/server'
import Home from './pages/Home.vex'

export const routes: Routes = [
  { path: '/', component: Home, render: 'ssr' },
]
```

### Route fields

- `path: string` — path-to-regexp style (`:id`, `*`)
- `component` — `.vex` module
- `render?: 'ssr' | 'ssg' | 'csr'` — default `ssr`
- `layout?: Component` — optional layout wrapper
- `children?: Routes` — nested routes
- `canActivate?` / `canMatch?` — async guards
- `entries?: () => Promise<string[]> | string[]` — SSG param expansion
- `error?` / `notFound?` — route-level overrides

Global fallbacks: `src/error.vex`, `src/not-found.vex`.

### Render modes

| Mode | Behavior |
|------|----------|
| `ssr` | Per-request `load` → HTML → hydrate |
| `ssg` | Build-time `load` (+ `entries`) → static HTML; actions/api still on server |
| `csr` | Minimal shell; client fetch / navigate for data |

## Request pipeline

1. Adapter normalizes to Web `Request`
2. `hooks.server.ts` `handle({ request, resolve })`
3. Match `routes.ts`
4. Run `canMatch` / `canActivate`
5. Dispatch:
   - Form action → `actions`
   - Matching `api` key → handler
   - Otherwise page → `load` + render
6. Errors → `HttpError` or error component; unknown paths → not-found

## Adapter API

```ts
interface Adapter {
  name: string
  adapt(builder: Builder): Promise<void>
}
```

`Builder` provides client assets, server entry, SSG pages, and a route/asset manifest.  
`@vexjs/adapter-node` writes a Node server entry and serves static files.

## App template

```
my-app/
  src/
    app.html
    routes.ts
    hooks.server.ts
    pages/*.vex
    error.vex
    not-found.vex
  vex.config.ts
  package.json
```

## CLI

- `vex create` — scaffold TS app with Node adapter
- `vex dev` — Vite + SSR middleware + HMR
- `vex build` — client + server + SSG + `adapter.adapt()`
- `vex preview` — run Node production output

## TypeScript

- Packages and app code are TypeScript
- `.vex` scripts use `lang="ts"`
- Generated `*.vex.d.ts` (or equivalent) for component props / imports

## Testing

- Compiler: fixture unit tests (`.vex` → expected JS/CSS shape)
- Server: routing, load, actions, api with `Request`/`Response`
- E2E: Playwright against `examples/basic` (dev and preview)

## Announcement checklist

- [x] Design approved
- [x] All core packages working
- [x] Hybrid render
- [x] Hooks + error/404
- [x] CLI
- [x] Node adapter
- [x] Docs + `examples/basic`
- [x] Unit + smoke tests (`npm test`, `npm run test:smoke`)

Bun/Workers adapters: interface present; implementations after announcement.
