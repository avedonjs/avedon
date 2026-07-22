# CLI

The `avedon` package provides the commands you use inside an app. Scaffolding is also available as `create-avedon-app`.

## Commands

| Command | Description |
|---------|-------------|
| `avedon create [name]` | Scaffold a new app (same as `pnpm create avedon-app`) |
| `avedon dev` | Development server (Vite + avedon middleware) |
| `avedon build` | Client + server bundles, SSG pages, adapter output |
| `avedon start` | Run the production Node server (`preview` is an alias) |

In a scaffolded app these map to `pnpm dev`, `pnpm build`, and `pnpm start`.

## Create flags

```bash
avedon create my-app --yes
avedon create my-app --tailwind --orm=drizzle
avedon create my-app --no-tailwind --orm=none
```

| Flag | Description |
|------|-------------|
| `--yes` / `-y` | Non-interactive; defaults to no Tailwind and `orm=none` |
| `--tailwind` / `--no-tailwind` | Enable or disable Tailwind v4 conversion of starter styles |
| `--orm=none\|drizzle\|prisma` | Add ORM dependencies and empty config (no models) |

Interactive mode (TTY) prompts for name (if missing), Tailwind, and ORM unless flags are set.

## Package managers

```bash
pnpm create avedon-app my-app
npm create avedon-app@latest my-app
npx create-avedon-app my-app
```

## See also

- [Quick start](./quick-start.md)
- [Deployment](./deployment.md)
- [Configuration](./configuration.md)
