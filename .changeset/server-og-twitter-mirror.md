---
'@avedon/server': patch
---

Mirror `head.title` / `head.description` into `og:*` and `twitter:*` meta tags so social crawlers (especially X) get a complete card without relying on `<title>` / `meta name=description` fallbacks alone.
