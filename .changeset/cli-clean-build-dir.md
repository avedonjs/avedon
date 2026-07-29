---
'avedon': patch
---

Clear stale `build/` before `avedon build` so Vite does not dep-scan previous SSG HTML.
