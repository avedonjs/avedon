# vexjs Guide

TypeScript-first full-stack framework with `.vex` components, Angular-style `routes.ts`, and Vite.

## Quick start

```bash
npm install
npm run build -w @vexjs/runtime -w @vexjs/compiler -w @vexjs/server -w @vexjs/vite-plugin -w @vexjs/adapter-node -w vex
cd examples/basic
npx vex dev
```

Or scaffold:

```bash
npx vex create my-app
```

## `.vex` files

```vex
<script lang="ts">
  export let title
  let count = 0
</script>

<script lang="ts" server>
  export async function load() {
    return { title: 'Hi' }
  }
  export const actions = {
    default: async ({ formData }) => ({ title: String(formData.get('q')) }),
  }
  export const api = {
    'GET /api/items': async () => Response.json([]),
  }
</script>

<style>
  h1 { font-weight: 600; }
</style>

<h1>{title}</h1>
<button on:click={() => count++}>{count}</button>
```

- Client script never receives server exports
- API keys are absolute from the site root

## Routing

```ts
import type { Routes } from '@vexjs/server'
import Home from './pages/Home.vex'

export const routes: Routes = [
  { path: '/', component: Home, render: 'ssr' },
  { path: '/about', component: Home, render: 'ssg' },
  { path: '/app', component: Home, render: 'csr' },
]
```

## CLI

| Command | Description |
|---------|-------------|
| `vex dev` | Vite + SSR middleware |
| `vex build` | Client + server + SSG + Node adapter |
| `vex preview` | Run `build/server.js` |
| `vex create` | New app template |

## Packages

- `@vexjs/compiler` — `.vex` → JS
- `@vexjs/runtime` — stores, navigate, enhance, HTML escape
- `@vexjs/server` — routes + request pipeline
- `@vexjs/vite-plugin` — transform + HMR + `.vex.d.ts`
- `@vexjs/adapter-node` — production Node
- `@vexjs/adapter-bun` / `@vexjs/adapter-cloudflare` — stubs (not implemented yet)
- `vex` — CLI

See [design spec](./superpowers/specs/2026-07-20-vexjs-design.md).
