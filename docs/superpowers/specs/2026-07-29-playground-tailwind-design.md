# Playground Tailwind (browser runtime)

Updated: 2026-07-29  
**Status:** Approved  
**Scope:** `apps/www` playground only (`runner.ts`, presets, prebuild script, `package.json`)

## Goal

Make Tailwind utility classes work in the www playground preview iframe, and restyle all playground presets with Tailwind so examples dogfood the same look as `create-avedon-app --tailwind`.

## Non-goals

- Adding PostCSS / Tailwind to the www docs shell itself
- Changing `create-avedon-app` Tailwind scaffolding
- Processing user CSS through Vite/PostCSS inside the compile worker
- CDN delivery of Tailwind

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Delivery | `@tailwindcss/browser` (Play-style runtime) |
| Hosting | Local asset under `apps/www/public/` (no CDN) |
| Theme | Same `@theme` tokens as create-app `app.css` (`bg`, `fg`, `muted`, `accent`, `line`, …) |
| Preset styling | Utility-first; small custom CSS only where utilities are awkward (e.g. spinner) |
| www shell | Unchanged (no Tailwind on docs chrome) |
| Version | Align with create-app (`^4.1.11` range) |

## Architecture

```
predev / prebuild
  → build-playground-runtime.mjs   (existing: playground-runtime.js)
  → copy/bundle @tailwindcss/browser → public/playground-tailwind.js

runner.buildIframeHtml()
  → base dark shell styles (existing)
  → theme <style> with @theme + body tokens
  → <script src="/playground-tailwind.js">
  → component <style id="pg-css"> (compiled .ave CSS)

presets.ts
  → every example uses Tailwind utilities; drop redundant <style scoped>
```

### Asset pipeline

1. Add `devDependency` `@tailwindcss/browser` on `www`.
2. Extend `scripts/build-playground-runtime.mjs` (or a sibling script invoked from the same predev/prebuild chain) to emit `public/playground-tailwind.js` from the package entry (copy or esbuild bundle — whichever yields a single browser-ready file).
3. `.gitignore` already covers build artefacts if needed; commit the generator, not necessarily a huge checked-in binary if prebuild always runs (same pattern as `playground-runtime.js`).

### iframe head

- Keep current dark base (`#09090b` / `#fafafa`) so empty/unclassed markup stays readable.
- Inject a small theme block matching create-app tokens so classes like `text-accent`, `border-line`, `bg-bg` resolve.
- Load `/playground-tailwind.js` so arbitrary utilities typed in the editor work without a content scan.

### Presets

Update all entries in `playgroundPresets`:

- Buttons, inputs, labels, lists, spacing → Tailwind utilities.
- Remove `<style scoped>` where fully replaced.
- Keep `class:` directive demo meaningful (toggle a Tailwind-named class such as a custom `.primary` or utility-compatible class).
- `{#await}` spinner: either Tailwind `animate-spin` + border utilities, or a tiny remaining custom `@keyframes` if needed.
- Preserve behavioral intent of each preset (signals, binds, server mocks, transitions).

## Error handling

- If the Tailwind asset is missing, preview still mounts; utilities simply have no effect. Predev/prebuild must fail loudly if the copy/bundle step fails (same as runtime build).

## Testing

- Manual: open `/playground`, switch presets, confirm styled preview; edit a new utility class and see it apply.
- Existing www Playwright / smoke must stay green (no new framework APIs).
- No new unit tests required unless the build script gains non-trivial logic worth asserting.

## Out of scope follow-ups

- Optional Tailwind for the docs chrome
- Shared theme package between create-app and www playground
`)