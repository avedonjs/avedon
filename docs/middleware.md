# Middleware

Route-agnostic request middleware runs **before** route matching and **guards**. Use it for cross-cutting concerns such as logging, CORS, and rate limiting.

Guards (`guard` / `canActivate` / `canMatch`) stay on the route table and see `params`. Middleware never does.

## Pipeline order

1. Adapter / Vite normalizes to a Web `Request`
2. `hooks.server.ts` middleware chain (`sequence`)
3. Optional `handle` hook
4. Match routes → guards → `load` / `actions` / `api_*` / SSR

## `hooks.server.ts`

```ts
import { cors, logger, rateLimit } from '@vexjs/server'

export const middleware = [
  logger(),
  rateLimit({ max: 200 }),
  cors({ origin: true }),
]

export default { middleware }
```

You can still export a single `handle` (backward compatible). When both are present, the framework runs:

`sequence(...middleware, handle)`.

## `sequence`

Compose custom onion handlers (same shape as `handle`):

```ts
import { sequence, type Middleware } from '@vexjs/server'

const timing: Middleware = async ({ request, resolve }) => {
  const start = Date.now()
  const res = await resolve(request)
  console.log(`${Date.now() - start}ms`)
  return res
}

export const handle = sequence(timing, async ({ request, resolve }) => resolve(request))
```

First argument is outermost (sees the request first; can short-circuit).

## Built-ins

| Helper | Role |
|--------|------|
| `logger({ format? })` | Logs method, path, status, duration (`dev` or `short`) |
| `cors({ origin?, methods?, headers?, maxAge? })` | OPTIONS → 204; attaches CORS headers. `origin: true` reflects the request `Origin` |
| `rateLimit({ windowMs?, max?, key? })` | Process-local fixed window; over limit → `429` + `Retry-After` |

`rateLimit` uses an in-memory `Map`. It is fine for local/dev and single-instance demos. For multi-node production, supply a custom `key` and replace the helper with a shared store.

## Middleware vs guards

| | Middleware | Guard |
|--|------------|-------|
| Scope | All requests | Matched route chain |
| `params` | No | Yes |
| Typical use | CORS, logging, rate limit | Authz, “can this user open this page?” |

Do not put role checks that need route params in middleware; use `guard` on the route instead.
