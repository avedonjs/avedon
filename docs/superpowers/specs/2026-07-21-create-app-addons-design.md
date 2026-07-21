# Create-app optional add-ons (Tailwind + ORM)

Updated: 2026-07-21  
**Status:** Implemented (2026-07-21)  
**Scope:** `packages/create-avedon-app` (+ thin `avedon create` argv passthrough)

## Goal

Keep the current minimal starter template as the default, and let `create-avedon-app` / `avedon create` optionally add **Tailwind** and/or an **ORM** at scaffold time via interactive prompts or flags.

## Non-goals

- Opinionated full stack wizard (auth, ESLint, package-manager picker, etc.)
- Generating ORM schemas, models, or migrations
- Changing `examples/basic-app` styles (plain CSS stays)
- Teaching the avedon CLI to merge arbitrary Vite plugins from user config (not required for this feature)
- Multiple full combinatorial templates

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Product shape | Light optional add-ons on one base template |
| Add-ons (v1) | Tailwind (yes/no) + ORM (Drizzle / Prisma / none) |
| UX | Interactive prompts on TTY; flags + `--yes` for non-interactive |
| Defaults (`--yes` / Enter) | Tailwind **off**, ORM **none** (current minimal behavior) |
| Implementation | Single template + conditional transforms |
| Tailwind depth | Convert starter styles to Tailwind utilities (+ small custom CSS where needed) |
| ORM depth | Dependencies + config stubs only; **no** schema/models |
| Tailwind toolchain | v4 via `@tailwindcss/postcss` + `postcss.config.js` (Vite auto-loads PostCSS; no CLI plugin merge) |
| Prompt library | `@clack/prompts` |

## Architecture

```
CLI (create-avedon-app | avedon create)
  → resolveCreateOptions(argv)   // prompts and/or flags
  → scaffoldApp(dest, options)
       1. copy base template
       2. monorepo file: link (existing)
       3. applyTailwind() if options.tailwind
       4. applyOrm() if options.orm !== 'none'
       5. formatNextSteps(result)
```

- **`scaffoldApp`** stays pure: accepts options, performs filesystem transforms, no prompting.
- **`resolveCreateOptions`** lives in `create-avedon-app` and is shared by both bins so flag/prompt behavior stays identical.
- Options omitted → same as `{ tailwind: false, orm: 'none' }`.

### Public types (sketch)

```ts
type OrmChoice = 'none' | 'drizzle' | 'prisma'

type ScaffoldOptions = {
  name?: string
  tailwind?: boolean  // default false
  orm?: OrmChoice     // default 'none'
}

type ScaffoldResult = {
  dest: string
  name: string
  packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun'
  tailwind: boolean
  orm: OrmChoice
}
```

## Tailwind transform

When `tailwind: true`:

1. Add devDependencies: `tailwindcss`, `@tailwindcss/postcss`, `postcss`.
2. Write `postcss.config.js` using `@tailwindcss/postcss`.
3. Write `src/app.css` with `@import "tailwindcss"` and `@theme` tokens matching the starter palette (`#09090B`, `#FAFAFA`, `#A1A1AA`, `#06B6D4`, `#0891B2`, Syne).
4. Import `app.css` from the client entry (`src/client.ts`).
5. Rewrite `Home.ave`: remove the large `<style unscoped>` block; map layout/typography/CTAs to utility classes.
6. Keep hard-to-utility pieces (radial glow, grid mask, keyframes, `prefers-reduced-motion`) as a small custom CSS block in `app.css` so visual parity with the starter-home design is preserved.

When `tailwind: false`: leave the plain CSS `<style unscoped>` template unchanged.

## ORM wiring

No schema generation, no sample models, no DB connection module beyond what the ORM’s default config needs.

### Shared

- Create `.env.example` with a `DATABASE_URL=` stub if missing; append the stub if the file already exists (do not create a real `.env`).
- Mention env + ORM next steps briefly in `formatNextSteps`.
- ORM packages are always registry versions (monorepo `file:` rewrite applies only to `avedon` / `@avedon/*`).

### Drizzle (`orm: 'drizzle'`)

- Dependencies: `drizzle-orm`; devDependency: `drizzle-kit`.
- Write `drizzle.config.ts` with dialect `postgresql` and conventional `schema` / `out` paths (files need not exist yet).
- Optional scripts: `db:generate`, `db:push` → drizzle-kit.

### Prisma (`orm: 'prisma'`)

- Dependencies: `@prisma/client`; devDependency: `prisma`.
- Write `prisma/schema.prisma` with `generator` + `datasource` only (**no models**).
- Script: `db:generate` → `prisma generate`.

### None

- No ORM files or dependencies.

## CLI UX

### Interactive (TTY)

1. Project name (if missing from argv)
2. Add Tailwind? — default **No**
3. ORM? — **None** / Drizzle / Prisma — default **None**

Non-TTY / piped stdin: do not prompt; use defaults unless flags supply values.

### Flags

| Flag | Meaning |
|------|---------|
| `[name]` | Destination directory / package name |
| `--yes` / `-y` | Skip prompts; use defaults |
| `--tailwind` / `--no-tailwind` | Force Tailwind on/off |
| `--orm=drizzle\|prisma\|none` | Force ORM choice |

Invalid `--orm` → clear error, exit 1.  
Prompt cancel (Ctrl+C) → exit 0.  
Existing destination directory → error (unchanged).

Both `create-avedon-app` and `avedon create` must accept the same flags and pass the resolved options into `scaffoldApp`.

## Error handling

- Fail fast on existing destination before transforms.
- Transform failures → print message, exit 1 (no mandatory temp-dir atomic rename for v1).
- Keep error messages short and actionable.

## Testing

- Unit: default scaffold matches current minimal template expectations.
- Unit: `tailwind: true` → PostCSS config + `app.css` + Home without the old unscoped style block; deps present.
- Unit: `orm: 'drizzle' | 'prisma'` → config/deps present; no model blocks / no fabricated schema tables.
- Unit: `resolveCreateOptions` / flag parsing (`--yes`, `--tailwind`, `--orm=…`).
- E2E: existing create-smoke covers `--yes` (minimal) path; deeper Tailwind install smoke optional if unit coverage is solid.

## Out of scope follow-ups (explicit)

- Vite `plugins` merge in `avedon` CLI (needed only if switching to `@tailwindcss/vite`)
- Auth / ESLint / other add-ons
- Syncing Tailwind variant into `examples/basic-app`
- Drizzle/Prisma dialect picker (MySQL, SQLite, etc.) — v1 locks PostgreSQL in config stubs
