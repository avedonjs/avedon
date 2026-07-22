# Documentation

Official documentation for **avedon**, a TypeScript-first full-stack web framework.

## Guides

| Document | Audience |
|----------|----------|
| [Getting started](./guide.md) | New contributors and app authors |
| [`.ave` components](./avedon-components.md) | Writing pages and UI |
| [Routing](./routing.md) | Declaring routes, layouts, and guards |
| [Security](./security.md) | Trusted layout children, reporting |
| [Publishing](./publishing.md) | First npm publish + trusted publishing (OIDC) |
| [Middleware](./middleware.md) | Logging, CORS, rate-limit (route-agnostic) |
| [Session & cookies](./session.md) | Sealed session cookie + `requireSession` |
| [Rendering](./rendering.md) | Choosing `ssr`, `ssg`, or `csr` |
| [Packages](./packages.md) | Understanding the monorepo |

## Reference

| Document | Notes |
|----------|-------|
| [Design spec](./superpowers/specs/2026-07-20-avedon-design.md) | Approved architecture and goals |
| [Implementation plan](./superpowers/plans/2026-07-20-avedon-implementation.md) | Historical build plan for the skeleton |
| Package READMEs under [`packages/`](../packages/) | Per-package short descriptions |

## Repository map

```
avedon/
├── packages/          # Framework packages
├── examples/basic-app # Reference application
├── docs/              # This documentation
├── e2e/               # Smoke and Playwright coverage
└── README.md          # Project overview
```

## Contributing docs

Doc changes follow the same process as code: see [CONTRIBUTING.md](../CONTRIBUTING.md). Prefer accurate, current APIs from `examples/basic-app` over outdated snippets.
