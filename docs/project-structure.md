# Project structure

After `pnpm create avedon-app`, your app looks like this:

```
my-app/
├── avedon.config.ts      # Adapter and build options
├── package.json
├── tsconfig.json
└── src/
    ├── app.html          # HTML shell (%avedon.head%, %avedon.body%)
    ├── client.ts         # Client boot
    ├── server-entry.ts   # Server app export (routes, hooks, errors)
    ├── hooks.server.ts   # Middleware chain
    ├── routes.ts         # defineRoutes([...])
    ├── pages/            # Route components (.ave)
    ├── error.ave         # Global error UI
    └── not-found.ave     # Global 404 UI
```

## Key files

| File | Role |
|------|------|
| `src/routes.ts` | Explicit route table — paths, layouts, `render`, guards |
| `src/pages/*.ave` | Pages and layouts |
| `avedon.config.ts` | Production adapter (Node by default) |
| `src/server-entry.ts` | What the server/dev middleware loads |
| `src/hooks.server.ts` | Cross-cutting [middleware](./middleware.md) |
| `src/client.ts` | Hydration and client navigation boot |

## Adding a page

1. Create `src/pages/About.ave`.
2. Register it in `src/routes.ts`:

```ts
import { defineRoutes } from '@avedon/server'
import Home from './pages/Home.ave'
import About from './pages/About.ave'

export const routes = defineRoutes([
  { path: '/', component: Home, render: 'ssr' },
  { path: '/about', component: About, render: 'ssg' },
])

export default routes
```

## Optional add-ons

If you scaffolded with `--tailwind` or `--orm=drizzle|prisma`, the CLI also adds PostCSS/Tailwind files or ORM config stubs. Those are optional wiring — see [CLI](./cli.md).

## See also

- [Quick start](./quick-start.md)
- [Configuration](./configuration.md)
- [Routing](./routing.md)
