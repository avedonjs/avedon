# Getting started

This guide walks through running avedon from this repository and the core development loop.

## Prerequisites

- Node.js **>= 20**
- pnpm **>= 9**

## Install and build

From the repository root:

```bash
pnpm install
pnpm build
```

This builds all workspace packages (`@avedon/*` and `avedon`).

## Run the example app

```bash
pnpm -F example dev
```

The CLI starts Vite on [http://localhost:5173](http://localhost:5173) with the avedon plugin and SSR middleware.

Useful routes in `examples/basic-app`:

| Path | Render | Notes |
|------|--------|-------|
| `/` | `ssg` | Pre-rendered at build time |
| `/docs/:slug` | `ssg` + `revalidate: 60` | `getStaticPaths` → `/docs/intro`, `/docs/api` (ISR) |
| `/posts/:id` | `ssr` | `load`, named action, `api_GET` |
| `/admin` | `csr` | Client-only; `guard` + route `error` |

## CLI

The `avedon` package provides:

| Command | Description |
|---------|-------------|
| `avedon create [name]` | Scaffold a new app directory (same as `pnpm create avedon-app`) |
| `avedon dev` | Development server (Vite + middleware) |
| `avedon build` | Client + server bundles, SSG pages, Node adapter output |
| `avedon start` | Run the production server (`preview` is an alias) |

You can also scaffold with:

```bash
pnpm create avedon-app my-app
# or: npm create avedon-app my-app
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
│   ├── pages/*.avedon        # Route components + layouts
│   ├── guards/            # Route guards
│   ├── hooks.server.ts    # Middleware + optional handle
│   ├── client.ts          # Client boot
│   └── server-entry.ts    # Server entry
├── package.json
└── ...
```

## Next steps

1. Read [`.avedon` components](./avedon-components.md)
2. Configure routes in [Routing](./routing.md)
3. Add cross-cutting middleware in [Middleware](./middleware.md)
4. Pick render modes in [Rendering](./rendering.md)
4. Skim [Packages](./packages.md) if you are changing the framework itself
