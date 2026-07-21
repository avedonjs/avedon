# @vexjs/server

Platform-agnostic request pipeline: route matching, guards, route-agnostic middleware (`sequence`, `cors`, `logger`, `rateLimit`), cookies + sealed session (`requireSession`), `load` / `actions` / `api_*`, streaming SSR/SSG/CSR orchestration, CSRF for form actions (Origin/Referer), and helpers (`notFound`, `redirect`, `error`, `json`).

Node streaming helper: `import { pipeWebResponse } from '@vexjs/server/node'`.

See [Middleware](../../docs/middleware.md) for the hooks API.
