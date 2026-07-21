# Avedon logo

Brand assets — vectors are canonical; raster exports were produced with `rsvg-convert`.

## Selected concept

**A. Frame / vignette (crop marks)** — L-shaped crop marks in the four corners; geometric **A** monogram in the center. Metaphor of a “clean frame” inspired by photographer Richard Avedon; no camera/lens clichés.

Alternate drafts: [`explorations/`](./explorations/) (fusion point, stream-lined monogram).

## Colors

| Role | Hex | Usage |
|------|-----|-------|
| Accent | `#06B6D4` | Emphasis, links, OG stripe, dark-mode hero |
| Accent (dark) | `#0891B2` | Hover, accent on accessible text |
| Text / icon (light) | `#0F172A` | Logo on light backgrounds |
| Text / icon (dark) | `#FAFAFA` | Logo on dark backgrounds |
| OG background | `#09090B` | Social card |

Logos use **`currentColor`**; set `color` in HTML/CSS for single-color (black/white) usage.

## Files

| File | Description |
|------|-------------|
| `icon.svg` | Icon only (square, 32×32 viewBox) |
| `logo-horizontal.svg` | Icon + `avedon` wordmark |
| `wordmark.svg` | Wordmark only |
| `favicon/favicon-16x16.png` | Favicon |
| `favicon/favicon-32x32.png` | Favicon / tab |
| `favicon/apple-touch-icon.png` | 180×180 touch icon |
| `github-org-avatar.png` | 1024×1024 org/profile avatar (`#09090B` + light monogram) |
| `og-image.png` | 1200×630 Open Graph / GitHub social preview |
| `og-image.svg` | OG source (for re-export) |

## Clear space

Minimum padding around the icon: **25% of monogram height** (~8px in a 32px viewBox). In the horizontal lockup, fixed **12px** between icon and wordmark (viewBox scale).

## Minimum size

- Icon alone: **16×16 px** (favicon); do not go smaller.
- Horizontal lockup: width **≥ 120 px**; otherwise prefer the icon only.

## Don'ts

- Gradients, shadows, 3D effects, or deforming the outline
- Splitting crop marks or the A into separate marks as if they were standalone brands
- Multi-color palettes outside the accent
- Distortion (uniform scale only on the icon)

## Terminal / CLI (optional)

Monochrome, low-resolution banner example:

```
 ┌──      ──┐
 │    ▲    │
 └──      ──┘
  avedon
```

For clearer ASCII, use the wordmark only: `avedon` (lowercase, matches npm/GitHub).

## Regenerating PNGs

README header (GitHub light/dark):

```bash
sed 's/currentColor/#0F172A/g' logo/logo-horizontal.svg > /tmp/logo-horizontal-light.svg
sed 's/currentColor/#FAFAFA/g' logo/logo-horizontal.svg > /tmp/logo-horizontal-dark.svg
rsvg-convert -w 560 /tmp/logo-horizontal-light.svg -o logo/logo-horizontal-light.png
rsvg-convert -w 560 /tmp/logo-horizontal-dark.svg -b '#0F172A' -o logo/logo-horizontal-dark.png
```

Favicon / OG:

```bash
rsvg-convert -w 16 -h 16 logo/icon.svg -o logo/favicon/favicon-16x16.png
rsvg-convert -w 32 -h 32 logo/icon.svg -o logo/favicon/favicon-32x32.png
rsvg-convert -w 180 -h 180 logo/icon.svg -o logo/favicon/apple-touch-icon.png
rsvg-convert -w 1200 -h 630 logo/og-image.svg -o logo/og-image.png
sed 's/currentColor/#FAFAFA/g' logo/icon.svg | rsvg-convert -w 1024 -h 1024 -b '#09090B' -o logo/github-org-avatar.png
```

## GitHub About / social

GitHub has no public API for social preview or org avatar uploads. Use:

- **Org avatar:** Settings → [Organization profile](https://github.com/organizations/avedonjs/settings/profile) → upload `logo/github-org-avatar.png`
- **Repo social preview:** [Repository settings → Social preview](https://github.com/avedonjs/avedon/settings#social-preview) → upload `logo/og-image.png`
- **Topics / description:** editable via `gh repo edit`

## Typography (wordmark)

Geometric grotesque sans: **Inter** / system UI stack (SVG `<text>`). If the font is missing at render time, the system sans-serif is used; converting the wordmark to paths is optional for pixel-perfect branding.

**Casing:** lowercase `avedon` (matches npm and GitHub org `avedonjs`). Title case `Avedon` is fine in prose.
