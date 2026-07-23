# Quick start

Create a new avedon app, run it locally, and produce a production build.

## Prerequisites

- Node.js **>= 20**
- A package manager: **pnpm** (recommended), npm, or yarn

## Create an app

```bash
pnpm create avedon-app my-app
cd my-app
pnpm install
pnpm dev
```

Equivalents:

```bash
npm create avedon-app@latest my-app
# or
npx create-avedon-app my-app
# or
avedon create my-app
```

Open [http://localhost:5173](http://localhost:5173). The scaffold ships a home page at `/`.

### Scaffold options

On a TTY the CLI can prompt for adapter, Tailwind, and ORM. Flags skip prompts:

| Flag | Effect |
|------|--------|
| `--yes` / `-y` | Skip prompts (defaults: Node adapter, no Tailwind, no ORM) |
| `--adapter=node\|cloudflare\|bun` | Production adapter (default `node`) |
| `--tailwind` / `--no-tailwind` | Convert starter styles to Tailwind v4 (PostCSS) |
| `--orm=none\|drizzle\|prisma` | Wire ORM deps and config stubs (no schema models) |

```bash
pnpm create avedon-app my-app --adapter=cloudflare
pnpm create avedon-app my-app --tailwind --orm=drizzle
pnpm create avedon-app my-app --yes
```

## Everyday commands

From your app directory:

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `avedon dev` | Vite dev server + SSR middleware |
| `build` | `avedon build` | Client + server bundles and SSG pages |
| `start` | `avedon start` | Run the Node production server |
| `preview` | `avedon preview` | Alias of `start` |

```bash
pnpm build
pnpm start
```

## Next steps

1. Skim [project structure](./project-structure.md)
2. Follow the [tutorial](./tutorial.md) to add a route with data and a form
3. Read [`.ave` components](./components.md) and [routing](./routing.md)
