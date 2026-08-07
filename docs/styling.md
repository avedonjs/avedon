# Styling

Avedon components use colocated `<style>` (scoped by default). You can also add global CSS toolchains via Vite — the framework does not require a specific CSS framework.

## Scoped styles in `.ave`

```avedon
<style scoped>
  h1 { font-weight: 700; }
</style>

<template>
  <h1>Hello</h1>
</template>
```

Use `:global(…)` when a selector must escape the component hash. See [Components](./components.md).

## Tailwind CSS (scaffold)

```bash
pnpm create avedon-app my-app --tailwind
```

The scaffold adds Vite-compatible PostCSS + Tailwind v4:

- `postcss.config.js` with `@tailwindcss/postcss`
- `src/app.css` with `@import "tailwindcss"` and optional `@theme` tokens
- Import `./app.css` from `src/client.ts`

Utility classes work in `.ave` templates like any HTML. No Avedon-specific Tailwind plugin is required — Vite loads PostCSS automatically when `postcss.config.js` is present.

The docs site (`apps/www`) uses the same PostCSS + Tailwind v4 stack for chrome and playground styling.

## PostCSS (DIY)

1. Add `postcss` and any plugins you need.
2. Place `postcss.config.js` (or `.mjs` / `.cjs`) at the app root.
3. Import your CSS entry from `src/client.ts` (or a layout component).

Avedon does not merge PostCSS configs; Vite’s default discovery applies.

## UnoCSS

UnoCSS is not a first-class create-app flag. Typical setup:

1. Add `@unocss/vite` (or the PostCSS Uno plugin) to your Vite config beside `@avedon/vite-plugin`.
2. Import the generated CSS from your client entry.

See [UnoCSS Vite docs](https://unocss.dev/integrations/vite) for the upstream recipe.

## See also

- [CLI](./cli.md) — `--tailwind` / `--no-tailwind`
- [Project structure](./project-structure.md)
- [Components](./components.md) — scoped CSS and `:global`
