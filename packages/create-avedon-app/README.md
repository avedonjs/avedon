# create-avedon-app

When you scaffold **inside the avedon monorepo** (or set `AVEDON_MONOREPO_ROOT`), dependencies are rewritten to `file:../packages/*` so `pnpm install` works before packages are published to npm.

For published apps, install `@avedon/*` and `avedon` from the npm registry once they are released.

```bash
pnpm create avedon-app my-app
# or
npx create-avedon-app my-app
# or
avedon create my-app
```
