# create-avedon-app

When you scaffold **inside the avedon monorepo** (or set `AVEDON_MONOREPO_ROOT`), dependencies are rewritten to `file:../packages/*` so `pnpm install` works before packages are published to npm.

For published apps, install `@avedon/*` and `avedon` from the npm registry once they are released.

```bash
pnpm create avedon-app my-app
pnpm create avedon-app my-app --yes
pnpm create avedon-app my-app --tailwind --orm=drizzle
# or
npx create-avedon-app my-app --orm=prisma
# or
avedon create my-app --no-tailwind --orm=none
```

On a TTY, the CLI prompts for project name (if missing), Tailwind, and ORM. Use `--yes` / `-y` to skip prompts (defaults: no Tailwind, no ORM). Non-TTY runs also use those defaults unless flags are set.

- **Tailwind:** converts the starter home styles to Tailwind v4 (PostCSS) utilities.
- **ORM:** adds Drizzle or Prisma dependencies and config stubs only — no schema models.
