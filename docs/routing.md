# Routing

vexjs uses **explicit** route tables. There is no file-based route discovery: you declare paths in `src/routes.ts` with `defineRoutes`.

## Declaring routes

```ts
import { defineRoutes } from '@vexjs/server'
import Layout from './pages/Layout.vex'
import Home from './pages/Home.vex'
import Post from './pages/Post.vex'
import Admin from './pages/Admin.vex'
import AdminError from './pages/AdminError.vex'
import { requireAuth } from './guards/auth'

export default defineRoutes([
  {
    path: '/',
    layout: Layout,
    component: Home,
    render: 'ssg',
  },
  {
    path: '/posts/:id',
    layout: Layout,
    component: Post,
    render: 'ssr',
  },
  {
    path: '/admin',
    layout: Layout,
    component: Admin,
    render: 'csr',
    guard: requireAuth,
    error: AdminError,
  },
])
```

## Route fields

| Field | Description |
|-------|-------------|
| `path` | Path pattern (`:param` segments supported) |
| `component` | Page `.vex` module |
| `layout` | Optional layout `.vex` wrapping the page |
| `render` | `'ssr'` \| `'ssg'` \| `'csr'` (see [Rendering](./rendering.md)) |
| `guard` | Optional activation check (`canActivate` is an alias) |
| `error` | Optional error UI for that route |

## Guards

Guards run before the route activates. Return or resolve in a way that allows navigation, or deny / redirect according to your guard implementation.

```ts
// examples/basic-app/src/guards/auth.ts
export async function requireAuth(/* event */) {
  // allow or deny
}
```

Attach with `guard: requireAuth` on the route entry.

## Layouts

Layouts are `.vex` components that wrap child pages. Share chrome (nav, shell) via `layout` instead of duplicating markup in every page.

## Errors and not-found

Apps can provide global and per-route error / not-found `.vex` modules (see `examples/basic-app/src/error.vex` and `not-found.vex`). Prefer throwing helpers such as `notFound()` from `@vexjs/server` inside `load` or actions.

## Client navigation

`@vexjs/runtime` installs client-side navigation for same-origin links so transitions stay in-app after the first load. Forms can be progressively enhanced with the runtime helpers.

## Reference implementation

[`examples/basic-app/src/routes.ts`](../examples/basic-app/src/routes.ts) is the canonical example used by smoke and e2e tests.
