---
'@avedon/server': patch
'avedon': patch
'@avedon/adapter-node': patch
'@avedon/adapter-bun': patch
'@avedon/adapter-cloudflare': patch
---

Link Vite-extracted client CSS in SSG/SSR shells so imports like CodeMirror styles load in production.
