# Documentation

Official documentation for **avedon**, a TypeScript-first full-stack web framework.

The public site lives in [`apps/www`](../apps/www) (landing + these guides, SSG → Cloudflare Pages): **[https://avedon.pages.dev](https://avedon.pages.dev)**.

Navigation order is defined in [`manifest.json`](./manifest.json).

## Getting started

| Document | Description |
|----------|-------------|
| [Introduction](./introduction.md) | What avedon is and who it is for |
| [Quick start](./quick-start.md) | `create avedon-app`, `dev`, `build`, `start` |
| [Project structure](./project-structure.md) | Scaffold layout |
| [CLI](./cli.md) | Commands and create flags |

## Tutorial

| Document | Description |
|----------|-------------|
| [Tutorial](./tutorial.md) | Small app: routes, load, form action |

## Concepts

| Document | Description |
|----------|-------------|
| [Components](./components.md) | `.ave` format, scripts, template |
| [Routing](./routing.md) | `defineRoutes`, layouts, guards |
| [Loading data](./loading-data.md) | `load`, `actions`, `api_*` |
| [Rendering](./rendering.md) | `ssr` / `ssg` / `csr` |
| [Reactivity](./reactivity.md) | Signals and client runtime |

## Guides

| Document | Description |
|----------|-------------|
| [Middleware](./middleware.md) | Logging, CORS, rate-limit, CSRF |
| [Session](./session.md) | Cookies and sealed session |
| [Security](./security.md) | Trusted HTML, reporting |
| [Configuration](./configuration.md) | `avedon.config.ts` and env |
| [Deployment](./deployment.md) | Node production build |

## Maintainer / contributor

| Document | Notes |
|----------|-------|
| [Contributing](../CONTRIBUTING.md) | Monorepo setup, tests, packages map |
| [Publishing](./publishing.md) | npm publish + Trusted Publisher (OIDC) |
| [Design specs](./superpowers/specs/) | Architecture and historical plans |

## Contributing docs

Doc changes follow the same process as code: see [CONTRIBUTING.md](../CONTRIBUTING.md). Prefer accurate, current APIs from the create-app scaffold and published packages over outdated snippets.
