# Starter home visual redesign

Updated: 2026-07-21  
**Status:** Implemented (2026-07-21)  
**Scope:** `packages/create-avedon-app/template` + `examples/basic-app` (shared visual language)

## Goal

Replace the plain “Georgia + one paragraph” scaffold with a **dark-stage starter** that feels comparable to modern framework boilerplates (large type, strong brand, working mini-demo), without turning the template into a marketing site.

## Non-goals

- Full marketing landing (feature grids, pricing, testimonials)
- Redesigning every basic-app lab page (`/stream`, error labs, etc.)
- Adding CSS frameworks, Tailwind, or new runtime dependencies
- Light theme / theme toggle (dark-only for this pass)

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Surfaces | Both template and `examples/basic-app` |
| Theme | Dark stage + accent `#06B6D4` |
| First viewport | Brand + headline + one sentence + CTAs + mini `signal` demo |
| Structure | Shared starter shell (same home language; labs stay in example nav) |

## Visual system

### Palette (from `logo/README.md`)

| Token | Hex | Use |
|-------|-----|-----|
| `--bg` | `#09090B` | Page / stage |
| `--fg` | `#FAFAFA` | Primary text / wordmark |
| `--muted` | `#A1A1AA` | Supporting sentence |
| `--accent` | `#06B6D4` | CTA fill, focus, demo accent |
| `--accent-deep` | `#0891B2` | CTA hover |
| `--line` | `rgba(250,250,250,0.12)` | Hairline rules / demo frame |

### Typography

- **Display / brand:** expressive geometric sans via Google Fonts (e.g. **Syne** or **Space Grotesk**) — not Inter / system UI stack.
- **Body:** same family at lighter weight, or a paired grotesk for the supporting line.
- Loaded in `app.html` (`<link rel="preconnect">` + stylesheet); CSS variables for family names.
- Wordmark casing: lowercase **`avedon`** (brand rule).

### Atmosphere (not flat black)

- Full-bleed dark base `#09090B`.
- Subtle radial or linear wash (deep slate → black) plus a faint grid or noise so the first viewport is not a flat fill.
- Optional soft cyan glow **only** as atmospheric depth behind the brand block — not a neon “AI glow” halo on text; keep restrained.

### Motion (2–3 intentional)

1. Brand / headline: short fade + slight rise on first paint (`@keyframes`, `prefers-reduced-motion: reduce` → instant).
2. Accent underline or CTA: gentle opacity/color transition on hover.
3. Demo counter: value change feels snappy (no bounce spam).

## First viewport composition

One composition (not a dashboard):

1. **Brand** — hero-level `avedon` (largest type on the page).
2. **Headline** — one line (e.g. “Full-stack TypeScript, one `.ave` file.”).
3. **Support** — one short sentence (edit `Home.ave` / get productive fast).
4. **CTA group** — primary text button “Open `Home.ave`” (anchor or plain emphasis) + secondary link to docs (template: `#` or stub path; example: `/docs/intro`).
5. **Dominant visual** — the interactive demo block as the visual anchor (not a stock photo; product-as-demo).

No floating badges, pill clusters, or stat strips in the hero.

### Mini demo

- Client `signal` counter (or equivalent) with increment / reset.
- Framed with hairline border (`--line`), not a heavy card shadow.
- Label that makes the point: e.g. “Live `signal` — this runs in the browser.”
- Proves the scaffold is alive without a feature grid.

## Layout chrome

### Template (`create-avedon-app`)

- Single route `/` → polished `Home.ave`.
- Minimal or no nav (optional top-right “Docs” later); avoid lab clutter.
- `app.html`: font links, `theme-color` / dark color-scheme, favicon if we ship a small public asset (optional in this pass — can reuse monogram later).

### Example (`basic-app`)

- Same dark stage + home composition.
- Keep existing lab links in a **quiet top nav** (small, muted, does not compete with brand).
- Demo login / admin: move to nav or a secondary control under the demo — **not** in the hero CTA primary slot.
- Lab pages keep working; only Home + Layout (+ `app.html` fonts) need the new shell. Other pages inherit body styles from Layout and should remain readable on dark (tweak Layout `:global(body)` and basic type colors).

## File touch list (implementation)

| Path | Change |
|------|--------|
| `packages/create-avedon-app/template/src/pages/Home.ave` | Full starter UI + demo |
| `packages/create-avedon-app/template/src/app.html` | Fonts, `color-scheme: dark` |
| `packages/create-avedon-app/template/src/pages/Layout.ave` | Add only if shared chrome needed; else Home-owned styles |
| `examples/basic-app/src/pages/Home.ave` | Match template language + keep example-specific actions |
| `examples/basic-app/src/pages/Layout.ave` | Dark shell, quiet nav |
| `examples/basic-app/src/app.html` | Same font / color-scheme hooks |

No new packages. Prefer scoped styles in `.ave` files.

## Success criteria

- First viewport brand-test: removing nav still reads as **avedon**, not a generic dark landing.
- Template `pnpm create` / scaffold smoke still passes.
- Example `pnpm -F example dev` home looks intentional on mobile and desktop.
- Existing basic-app routes still resolve; no broken lab links.
- `prefers-reduced-motion` respected.

## Out of scope follow-ups

- Light mode
- Shared CSS package across template and example (copy-paste / parallel files OK for now)
- Rewriting docs site styling
