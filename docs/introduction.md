# Introduction

avedon is a TypeScript-first full-stack web framework for building apps with colocated UI, styles, and server logic.

## What you get

- **`.ave` components** — template, scoped styles, client script, and server script in one file
- **Explicit routing** — declare paths in `routes.ts` with layouts, guards, and per-route render mode
- **Hybrid rendering** — choose `ssr`, `ssg`, or `csr` per route (default `ssr`)
- **Colocated data** — `load`, form `actions`, and `api_*` handlers next to the page
- **Reactive client runtime** — `signal`, `computed`, and `effect` from `@avedon/runtime`
- **Node production** — `@avedon/adapter-node` via `avedon build` and `avedon start`

## Who this is for

You are building an application. Scaffold with [`pnpm create avedon-app`](./quick-start.md), then grow routes and pages in that project. You do not need to clone or compile the avedon monorepo.

## Mental model

1. Declare routes in `src/routes.ts`.
2. Implement each page as a `.ave` file.
3. Put request-only work in `<script server>`; put interactive UI in `<script>` + `<template>`.
4. Pick a [render mode](./rendering.md) per route.
5. Deploy with the [Node adapter](./deployment.md).

## See also

- [Quick start](./quick-start.md) — create your first app
- [Tutorial](./tutorial.md) — build a small end-to-end example
- [Project structure](./project-structure.md) — what the scaffold contains
