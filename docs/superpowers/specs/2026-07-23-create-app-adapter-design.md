# Create-app adapter choice

Updated: 2026-07-23  
**Status:** Implemented (2026-07-23)  
**Scope:** `packages/create-avedon-app` (+ thin `avedon create` argv passthrough)

## Goal

Let `create-avedon-app` / `avedon create` select a production **adapter** at scaffold time (`node` | `cloudflare` | `bun`), matching the existing Tailwind/ORM add-on UX: interactive prompt on TTY, flags + `--yes` for non-interactive, single base template + transform.

## Non-goals

- Three separate full templates (`template-node` / `cloudflare` / `bun`)
- Cloudflare Pages vs Workers product picker (Workers + Assets only, via `@avedon/adapter-cloudflare`)
- ISR polyfills on Cloudflare
- Requiring Bun or `wrangler deploy` in CI smoke
- Special-casing Tailwind/ORM × adapter combinations (addons stay orthogonal)

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Depth | Config + dependency + `package.json` scripts + next-steps (not config-only) |
| Product shape | Single template + `applyAdapter()` transform |
| UX | TTY `select` + `--adapter=`; `--yes` / non-TTY default **node** |
| Default | `node` (current scaffold behavior) |
| Cloudflare deploy script | `wrangler deploy` after build (artifact under `build/`); add `wrangler` as devDependency |
| Bun start script | `bun run build/server.js` |
| Worker `name` | Scaffold project `name` (npm-safe); fallback `my-avedon-app` |
| Version pins | Same caret pattern as other `@avedon/*` in the template |

## Architecture

```
CLI (create-avedon-app | avedon create)
  → resolveCreateOptions(argv)   // prompts and/or flags
  → scaffoldApp(dest, options)
       1. copy base template
       2. applyAdapter(dest, adapter, { name })
       3. monorepo file: link (include adapter-cloudflare / adapter-bun; runs after apply so new deps exist)
       4. applyOrm() if options.orm !== 'none'
       5. applyTailwind() if options.tailwind
       6. formatNextSteps(result)
```

- **`scaffoldApp`** stays pure: accepts options, filesystem only, no prompting.
- **`resolveCreateOptions`** shared by both bins so flag/prompt behavior stays identical.
- Options omitted → same as `{ adapter: 'node', tailwind: false, orm: 'none' }`.

### Public types

```ts
type AdapterChoice = 'node' | 'cloudflare' | 'bun'
type OrmChoice = 'none' | 'drizzle' | 'prisma'

type ScaffoldOptions = {
  name?: string
  adapter?: AdapterChoice  // default 'node'
  tailwind?: boolean       // default false
  orm?: OrmChoice          // default 'none'
}

type ScaffoldResult = {
  dest: string
  name: string
  packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun'
  adapter: AdapterChoice
  tailwind: boolean
  orm: OrmChoice
}
```

### Flags and prompts

| Input | Behavior |
|-------|----------|
| `--adapter=node\|cloudflare\|bun` | Sets adapter; invalid value → clear error (like `--orm`) |
| TTY, flag absent | `@clack/prompts` select: Node (default) / Cloudflare Workers / Bun |
| `--yes` / `-y` or non-TTY | `adapter: 'node'` unless flag set |
| `avedon create …` | Same argv → `resolveCreateOptions` (existing passthrough) |

## `applyAdapter()` transform

For **node**: no-op relative to today’s template (already `nodeAdapter` + `@avedon/adapter-node` + `avedon start`).

For **cloudflare**:

1. Rewrite `avedon.config.ts` to import `cloudflareAdapter` from `@avedon/adapter-cloudflare` and call `cloudflareAdapter({ out: 'build', name: <scaffoldName> })`.
2. In `package.json` dependencies: remove `@avedon/adapter-node`; add `@avedon/adapter-cloudflare` at the same caret version style as other `@avedon/*`.
3. Add `wrangler` to `devDependencies` (compatible with current repo pin, e.g. `^4.113.0`).
4. Set `scripts.start` and `scripts.deploy` to `cd build && wrangler deploy` (matches `docs/deployment.md`; `wrangler.jsonc` paths are relative to `build/`).
5. `formatNextSteps`: `build` then `start`/`deploy`; note `SESSION_SECRET` via `wrangler secret put`; note ISR/`revalidate` not supported on Workers.

For **bun**:

1. Rewrite `avedon.config.ts` to `bunAdapter` from `@avedon/adapter-bun` with `{ out: 'build' }`.
2. Swap dependency node → bun adapter.
3. Set `start` (and `preview` if kept) to `bun run build/server.js`.
4. `formatNextSteps`: requires Bun; `PORT` default `3000`; `SESSION_SECRET` when using sessions.

### Monorepo linking

Extend `LOCAL_PKG_DIRS` / `linkScaffoldToMonorepo` so `@avedon/adapter-cloudflare` and `@avedon/adapter-bun` resolve to `file:…` when `AVEDON_MONOREPO_ROOT` / monorepo detection applies (same as node adapter today).

## Testing

- **options:** parse `--adapter=`, reject invalid, `--yes` defaults to node, TTY path covers select when flag omitted (follow existing mock style if any).
- **scaffold:** assert config import + dependency + scripts for each adapter; monorepo `file:` for cloudflare/bun.
- **formatNextSteps:** adapter-specific lines present.
- **e2e:** existing `create-smoke` with `--yes` remains node; optional light assert that `--adapter=cloudflare` scaffolds without running deploy.

## Docs

- `packages/create-avedon-app/README.md`: `--adapter` examples + prompt note.
- End-user docs that document `avedon create` / quick-start: mention adapter flag.
- Short cross-link from `docs/deployment.md` (“choose at scaffold”).

## Success criteria

- `pnpm create avedon-app my-app --yes` unchanged behavior (node).
- `pnpm create avedon-app my-app --adapter=cloudflare` produces a buildable app whose config uses `cloudflareAdapter` and lists the cloudflare package (and wrangler).
- `pnpm create avedon-app my-app --adapter=bun` likewise for Bun.
- Unit tests green; create-smoke still passes.
