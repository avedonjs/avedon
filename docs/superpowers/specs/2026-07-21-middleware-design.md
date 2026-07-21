# Middleware chain design

Güncelleme: 2026-07-21

## Goal

Add a **route-agnostic** middleware layer (logging, CORS, rate-limit) separate from route **guards**, without breaking existing `hooks.server.ts` `handle`.

## Non-goals

- `locals` / request context bag
- Distributed / Redis rate limiting
- Replacing guards for authz

## Architecture

Onion / `resolve` wrapping. Middleware shares the shape of today’s `HandleHook`:

```ts
type Middleware = (args: {
  request: Request
  resolve: (request: Request) => Promise<Response>
}) => Promise<Response> | Response
```

`sequence(...handlers)` composes outer → inner (first listed sees the request first).

Pipeline order:

1. Adapter / Vite → Web `Request`
2. `sequence(...middleware, handle?)` 
3. Core `handleRequest` (match → `canMatch` / `guard` → load / actions / api / SSR)

**Boundaries**

| Layer | When | Sees params? | Role |
|-------|------|--------------|------|
| Middleware | All requests, before match | No | Cross-cutting (CORS, log, rate limit) |
| Guard | After match, per route chain | Yes | Activation / authz |

## App API

```ts
// hooks.server.ts
import { sequence, cors, logger, rateLimit } from '@avedon/server'

export const middleware = [
  logger(),
  rateLimit({ max: 120 }),
  cors({ origin: true }),
]

// optional escape hatch; runs after middleware array, before core
export const handle = async ({ request, resolve }) => resolve(request)

export default { middleware, handle }
```

`HandlerOptions.hooks`:

```ts
hooks?: {
  handle?: HandleHook
  middleware?: Middleware[]
}
```

Effective wrapper:

```ts
sequence(...(middleware ?? []), ...(handle ? [handle] : []))
```

If both empty → call core directly (today’s no-hooks behavior).

## Built-ins

### `logger(opts?)`

- Options: `format?: 'dev' | 'short'` (default `'dev'`)
- Logs method, pathname, status, duration (ms) via `console`

### `cors(opts?)`

- Options: `origin?` (`true` | `string` | `string[]` | `RegExp` | `(origin: string) => boolean`), `methods?`, `headers?`, `maxAge?`
- `origin: true` → reflect request `Origin` when present
- `OPTIONS` → `204` + CORS headers (no core)
- Other methods → `resolve`, then attach CORS headers on the response

### `rateLimit(opts?)`

- Options: `windowMs?` (default `60_000`), `max?` (default `100`), `key?: (req: Request) => string`
- Default key: `cf-connecting-ip` → first `x-forwarded-for` hop → `'anon'`
- Over limit → `429` + `Retry-After`
- Process-local `Map` only; docs warn single-instance / not for multi-node production without a shared store

## Compatibility

- Existing apps that only export `handle` keep working
- Vite plugin already passes the hooks default object into `createHandler`; `middleware` is just another property

## Testing

- Unit: `sequence` order, short-circuit, response mutation
- Unit: `cors` OPTIONS / headers, `rateLimit` 429, `logger` spy
- Pipeline: middleware before match; short-circuit skips guards
