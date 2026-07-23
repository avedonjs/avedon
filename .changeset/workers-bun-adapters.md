---
"@avedon/adapter-cloudflare": minor
"@avedon/adapter-bun": minor
"@avedon/runtime": patch
"@avedon/server": patch
"avedon": patch
---

Ship Cloudflare Workers and Bun production adapters, and fix form-action redirect URL handling plus the CSR outlet marker.

- `@avedon/adapter-cloudflare`: Workers + static assets + `wrangler.jsonc` (SSG; ISR not on Workers yet)
- `@avedon/adapter-bun`: `Bun.serve` with Node-parity static files, SSG, and ISR SWR
- `@avedon/runtime`: `enhance()` boots the final URL after action redirects
- `@avedon/server`: fix malformed `data-avedon-csr` attribute
- `avedon`: include `revalidate` on the build manifest for adapter warnings
