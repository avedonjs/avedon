# vexjs

TypeScript-first full-stack web framework.

```
.vex ──► @vexjs/compiler ──► client + server modules
routes.ts ──► @vexjs/server ──► adapter-node ──► HTTP
                 └─ @vexjs/vite-plugin (dev/HMR)
browser ◄── @vexjs/runtime (hydrate, client nav, forms)
```

## Packages

| Package | Role |
|---------|------|
| `@vexjs/shared` | Shared types + adapter interface |
| `@vexjs/compiler` | `.vex` parse + codegen |
| `@vexjs/runtime` | `signal` / hydrate / client nav |
| `@vexjs/server` | Match, guards, load/actions/api, SSR |
| `@vexjs/vite-plugin` | Vite transform + middleware |
| `@vexjs/adapter-node` | Node production server |
| `vex` | CLI (`dev` / `build` / `start`) |

## Quick start

```bash
pnpm install
pnpm build
pnpm -F example dev
```

Open http://localhost:5173 — Home (SSG), `/posts/1` (SSR + like action + `.json` API), `/admin` (CSR + guard).

## `.vex` format

```vex
<script server>
  export async function load() { return { title: 'Hi' } }
  export const actions = { async like() { return { ok: true } } }
  export async function api_GET() { return Response.json({ ok: true }) }
</script>

<script>
  import { signal } from '@vexjs/runtime'
  export let title
  const n = signal(0)
</script>

<style scoped>
  h1 { font-weight: 700; }
</style>

<template>
  <h1>{title}</h1>
  <button on:click={() => n.set(n.get() + 1)}>{n}</button>
</template>
```

Routing is explicit via `defineRoutes([...])` in `src/routes.ts` (not file-based). Per-route `render: 'ssr' | 'ssg' | 'csr'`.

## Future work

- Full VS Code language service for `.vex` (today: sibling `.vex.d.ts`)
- Real Bun / Cloudflare / Vercel / Deno adapters (interface stubs only)
- CSS-in-JS / Tailwind integrations

## Community

- [Contributing](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security](./SECURITY.md)
- [Support](./SUPPORT.md)
- [License (MIT)](./LICENSE)
