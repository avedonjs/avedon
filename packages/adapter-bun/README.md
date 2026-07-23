# @avedon/adapter-bun

Bun adapter for avedon. Emits a `Bun.serve` production server with Node-parity static files, SSG HTML, and ISR (stale-while-revalidate).

## Config

```ts
import { bunAdapter } from '@avedon/adapter-bun'

export default {
  adapter: bunAdapter({ out: 'build' }),
}
```

## Build and run

```bash
pnpm build          # avedon build → build/
bun run build/server.js
```

Requires [Bun](https://bun.sh/). Set `PORT` to change the listen port (default `3000`).

### Sessions

Same as Node: provide `SESSION_SECRET` in the environment (at least 32 characters) when using sealed sessions.

## Behavior

- Static assets under `build/client` with path-traversal guards
- SSG HTML served from disk; routes with `revalidate` use SWR regeneration
- All other requests go through `createHandler` (SSR streaming, actions, APIs)
