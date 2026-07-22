<picture>
  <source media="(prefers-color-scheme: dark)" srcset="logo/logo-horizontal-dark.png">
  <img src="logo/logo-horizontal-light.png" alt="Avedon" width="280">
</picture>

TypeScript-first full-stack web framework for building applications with colocated UI, styles, and server logic.

# avedon

avedon gives you a single component format (`.ave`), explicit routing, hybrid rendering, and a Vite-based toolchain aimed at clear boundaries between client and server code.

**Docs:** [https://avedon.pages.dev](https://avedon.pages.dev) · **npm:** `avedon`, `create-avedon-app`, `@avedon/*`

## Features

- **`.ave` components** — template, scoped styles, client script, and server script in one file
- **Explicit routing** — `defineRoutes` in `routes.ts` with layouts, guards, and per-route render mode
- **Hybrid rendering** — `ssr`, `ssg`, and `csr` on a per-route basis (default `ssr`)
- **Colocated server APIs** — `load`, form `actions`, and `api_*` handlers next to the page UI
- **Reactive client runtime** — `signal`, `computed`, and `effect` from `@avedon/runtime`
- **Adapter model** — platform-agnostic `Request` / `Response` core; Node adapter for production today

## Requirements

- Node.js >= 20
- pnpm, npm, or yarn

## Quick start

```bash
pnpm create avedon-app my-app
cd my-app
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). Then:

```bash
pnpm build
pnpm start
```

Full walkthrough: [docs/quick-start.md](./docs/quick-start.md) or [https://avedon.pages.dev/docs/quick-start](https://avedon.pages.dev/docs/quick-start).

## Documentation

| Guide | Description |
|-------|-------------|
| [Documentation index](./docs/README.md) | Map of all docs |
| [Introduction](./docs/introduction.md) | What avedon is |
| [Quick start](./docs/quick-start.md) | Create and run an app |
| [Tutorial](./docs/tutorial.md) | Small end-to-end example |
| [Components](./docs/components.md) | `.ave` format |
| [Routing](./docs/routing.md) | `defineRoutes`, `route()`, layouts, guards |
| [Loading data](./docs/loading-data.md) | `load`, `actions`, `api_*` |
| [Rendering](./docs/rendering.md) | `ssr` / `ssg` / `csr` |
| [Middleware](./docs/middleware.md) | `sequence`, CORS, logging, rate-limit |
| [Session](./docs/session.md) | Cookies and sealed session |
| [Deployment](./docs/deployment.md) | Node production |

## Packages

| Package | Role |
|---------|------|
| `@avedon/shared` | Shared types and adapter interface |
| `@avedon/compiler` | `.ave` parse and codegen |
| `@avedon/runtime` | Signals, hydration, client navigation, forms |
| `@avedon/server` | Matching, guards, middleware, load/actions/api, SSR orchestration |
| `@avedon/vite-plugin` | Vite transform, HMR, and middleware |
| `@avedon/adapter-node` | Node production server |
| `@avedon/adapter-bun` | Bun adapter interface (stub) |
| `@avedon/adapter-cloudflare` | Cloudflare adapter interface (stub) |
| `avedon` | CLI (`create`, `dev`, `build`, `start`) |
| `create-avedon-app` | App scaffold (`pnpm create avedon-app`) |

## Example

Minimal `.ave` page with server `load` and client reactivity:

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

Routes are declared explicitly. Prefer `route()` when you want typed `params` in guards:

```ts
import { defineRoutes, route } from '@avedon/server'
import Home from './pages/Home.ave'
import Post from './pages/Post.ave'

export default defineRoutes([
  { path: '/', component: Home, render: 'ssg' },
  route('/posts/:id', {
    component: Post,
    render: 'ssr',
    guard: (e) => e.params.id.length > 0,
  }),
])
```

See [docs/routing.md](./docs/routing.md). Contributors working on the framework itself: [CONTRIBUTING.md](./CONTRIBUTING.md) and [`examples/basic-app`](./examples/basic-app).

## Roadmap

- Language service for `.ave` (today: sibling `.ave.d.ts` stubs)
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
