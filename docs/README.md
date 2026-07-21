# Documentation

Official documentation for **vexjs**, a TypeScript-first full-stack web framework.

## Guides

| Document | Audience |
|----------|----------|
| [Getting started](./guide.md) | New contributors and app authors |
| [`.vex` components](./vex-components.md) | Writing pages and UI |
| [Routing](./routing.md) | Declaring routes, layouts, and guards |
| [Rendering](./rendering.md) | Choosing `ssr`, `ssg`, or `csr` |
| [Packages](./packages.md) | Understanding the monorepo |

## Reference

| Document | Notes |
|----------|-------|
| [Design spec](./superpowers/specs/2026-07-20-vexjs-design.md) | Approved architecture and goals |
| [Implementation plan](./superpowers/plans/2026-07-20-vexjs-implementation.md) | Historical build plan for the skeleton |
| Package READMEs under [`packages/`](../packages/) | Per-package short descriptions |

## Repository map

```
vexjs/
├── packages/          # Framework packages
├── examples/basic-app # Reference application
├── docs/              # This documentation
├── e2e/               # Smoke and Playwright coverage
└── README.md          # Project overview
```

## Contributing docs

Doc changes follow the same process as code: see [CONTRIBUTING.md](../CONTRIBUTING.md). Prefer accurate, current APIs from `examples/basic-app` over outdated snippets.
