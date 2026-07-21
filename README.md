# avedon

TypeScript-first full-stack web framework for building applications with colocated UI, styles, and server logic.

avedon gives you a single component format (`.avedon`), explicit routing, hybrid rendering, and a Vite-based toolchain aimed at clear boundaries between client and server code.

## Features

- **`.avedon` components** — template, scoped styles, client script, and server script in one file
- **Explicit routing** — `defineRoutes` in `routes.ts` with layouts, guards, and per-route render mode
- **Hybrid rendering** — `ssr`, `ssg`, and `csr` on a per-route basis (default `ssr`)
- **Colocated server APIs** — `load`, form `actions`, and `api_*` handlers next to the page UI
- **Reactive client runtime** — `signal`, `computed`, and `effect` from `@avedon/runtime`
- **Adapter model** — platform-agnostic `Request` / `Response` core; Node adapter for production today

## Requirements

- Node.js >= 20
- pnpm >= 9

## Quick start

Clone this repository and run the example app:

```bash
pnpm install
pnpm build
pnpm -F example dev
```

Open [http://localhost:5173](http://localhost:5173).

| Route | Behavior |
|-------|----------|
| `/` | SSG home page |
| `/posts/:id` | SSR page with server action and JSON API |
| `/admin` | CSR page protected by a guard |

Production-style build of the example:

```bash
pnpm -F example build:app
pnpm -F example start
```

## Documentation

| Guide | Description |
|-------|-------------|
| [Documentation index](./docs/README.md) | Map of all docs |
| [Getting started](./docs/guide.md) | Setup, CLI, and first app flow |
| [`.avedon` components](./docs/avedon-components.md) | File format, scripts, styles, template |
| [Routing](./docs/routing.md) | `defineRoutes`, `route()`, layouts, guards |
| [Middleware](./docs/middleware.md) | `sequence`, CORS, logging, rate-limit |
| [Rendering](./docs/rendering.md) | `ssr` / `ssg` / `csr` and when to use each |
| [Packages](./docs/packages.md) | Monorepo package roles |
| [Design spec](./docs/superpowers/specs/2026-07-20-avedon-design.md) | Architecture decisions |

## Packages

| Package | Role |
|---------|------|
| `@avedon/shared` | Shared types and adapter interface |
| `@avedon/compiler` | `.avedon` parse and codegen |
| `@avedon/runtime` | Signals, hydration, client navigation, forms |
| `@avedon/server` | Matching, guards, middleware, load/actions/api, SSR orchestration |
| `@avedon/vite-plugin` | Vite transform, HMR, and middleware |
| `@avedon/adapter-node` | Node production server |
| `@avedon/adapter-bun` | Bun adapter interface (stub) |
| `@avedon/adapter-cloudflare` | Cloudflare adapter interface (stub) |
| `avedon` | CLI (`create`, `dev`, `build`, `start`) |
| `create-avedon-app` | App scaffold (`pnpm create avedon-app`) |

## Example

Minimal `.avedon` page with server `load` and client reactivity:

```avedon
<script server>
  export async function load() {
    return { title: 'Hello' }
  }
</script>

<script>
  import { signal } from '@avedon/runtime'
  export let title
  const count = signal(0)
</script>

<style scoped>
  h1 { font-weight: 700; }
</style>

<template>
  <h1>{title}</h1>
  <button type="button" on:click={() => count.set(count.get() + 1)}>
    {count}
  </button>
</template>
```

Routes are declared explicitly. Prefer `route()` when you want typed `params` in guards; plain objects still work:

```ts
import { defineRoutes, route } from '@avedon/server'
import Home from './pages/Home.avedon'
import Post from './pages/Post.avedon'

export default defineRoutes([
  { path: '/', component: Home, render: 'ssg' },
  route('/posts/:id', {
    component: Post,
    render: 'ssr',
    guard: (e) => e.params.id.length > 0, // params.id: string
  }),
])
```

See [`docs/routing.md`](./docs/routing.md) and [`examples/basic-app`](./examples/basic-app).

## Roadmap

- Language service for `.avedon` (today: sibling `.avedon.d.ts` stubs)
- Production adapters beyond Node (Bun, Cloudflare, and others)
- First-class CSS tooling integrations

## Community

- [Contributing](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security](./SECURITY.md)
- [Support](./SUPPORT.md)
- [License (MIT)](./LICENSE)

## License

[MIT](./LICENSE) © Anıl ÖZ
