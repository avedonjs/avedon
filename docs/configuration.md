# Configuration

App-level configuration lives in `avedon.config.ts` at the project root (created by the scaffold).

## Adapter

Default scaffold (Node):

```ts
import { nodeAdapter } from '@avedon/adapter-node'

export default {
  adapter: nodeAdapter({ out: 'build' }),
}
```

Cloudflare Workers:

```ts
import { cloudflareAdapter } from '@avedon/adapter-cloudflare'

export default {
  adapter: cloudflareAdapter({ out: 'build', name: 'my-avedon-app' }),
}
```

Bun:

```ts
import { bunAdapter } from '@avedon/adapter-bun'

export default {
  adapter: bunAdapter({ out: 'build' }),
}
```

`out` is the adapter output directory used by `avedon build` (and by `avedon start` for the Node adapter).

## Environment variables

Common variables your app may need:

| Variable | Purpose |
|----------|---------|
| `SESSION_SECRET` | Required for [sealed sessions](./session.md) (at least 32 characters) |
| Database URLs | If you scaffolded with `--orm=drizzle` or `--orm=prisma`, set whatever your ORM config expects |

Load secrets via your host’s env (`.env` files are app convention — not required by the framework).

## TypeScript

The scaffold includes a `tsconfig.json` that covers `src` and `avedon.config.ts`. Generated `*.ave.d.ts` files sit next to `.ave` components for editor support.

## See also

- [Project structure](./project-structure.md)
- [CLI](./cli.md)
- [Deployment](./deployment.md)
