# Getting started

This guide walks through running vexjs from this repository and the core development loop.

## Prerequisites

- Node.js **>= 20**
- pnpm **>= 9**

## Install and build

From the repository root:

```bash
pnpm install
pnpm build
```

This builds all workspace packages (`@vexjs/*` and `vex`).

## Run the example app

```bash
pnpm -F example dev
```

The CLI starts Vite on [http://localhost:5173](http://localhost:5173) with the vexjs plugin and SSR middleware.

Useful routes in `examples/basic-app`:

| Path | Render | Notes |
|------|--------|-------|
| `/` | `ssg` | Pre-rendered at build time |
| `/docs/:slug` | `ssg` + `revalidate: 60` | `getStaticPaths` → `/docs/intro`, `/docs/api` (ISR) |
| `/posts/:id` | `ssr` | `load`, named action, `api_GET` |
| `/admin` | `csr` | Client-only; `guard` + route `error` |

## CLI

The `vex` package provides:

| Command | Description |
|---------|-------------|
| `vex create [name]` | Scaffold a new app directory (same as `pnpm create vex-app`) |
| `vex dev` | Development server (Vite + middleware) |
| `vex build` | Client + server bundles, SSG pages, Node adapter output |
| `vex start` | Run the production server (`preview` is an alias) |

You can also scaffold with:

```bash
pnpm create vex-app my-app
# or: npm create vex-app my-app
```

Inside the example package these map to `pnpm -F example dev`, `build:app`, and `start`.

## Verify the monorepo

```bash
pnpm test
pnpm test:smoke
```

End-to-end (Playwright):

```bash
pnpm test:e2e
```

## Project layout (example)

```
examples/basic-app/
├── src/
│   ├── routes.ts          # defineRoutes([...])
│   ├── pages/*.vex        # Route components + layouts
│   ├── guards/            # Route guards
│   ├── hooks.server.ts    # Middleware + optional handle
│   ├── client.ts          # Client boot
│   └── server-entry.ts    # Server entry
├── package.json
└── ...
```

## Next steps

1. Read [`.vex` components](./vex-components.md)
2. Configure routes in [Routing](./routing.md)
3. Add cross-cutting middleware in [Middleware](./middleware.md)
4. Pick render modes in [Rendering](./rendering.md)
4. Skim [Packages](./packages.md) if you are changing the framework itself
