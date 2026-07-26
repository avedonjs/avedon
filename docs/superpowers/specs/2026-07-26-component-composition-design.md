# Component composition (UI components in `.ave`)

Updated: 2026-07-26  
**Status:** Approved for implementation (2026-07-26)  
**Plan:** _(pending)_ `docs/superpowers/plans/2026-07-26-component-composition.md`

## Goal

Make PascalCase tags in `.ave` templates real reusable UI components (props, default slot, `on:` callbacks) with SSR + client mount — ending the current silent bug where `<Card />` becomes `document.createElement("Card")`. In the same change, make unsupported template syntax fail closed with clear compile errors instead of emitting broken or misleading code.

## Non-goals (v1)

- Named slots (`<slot name="…">`)
- Nested `load` / `<script server>` on UI components
- `createEventDispatcher` / component-emitted custom events (parent passes callbacks via `on:` → props)
- `bind:` on components
- Dynamic component (`<svelte:component>`-style)
- Fine-grained hydration (keep today’s SSR HTML + client `mount`)
- Per-page `<head>` / title / meta API (separate follow-up)
- `class:`, `style:`, `transition:`, `use:`, keyed `{#each}`, `{#key}`, `{@const}`, object spread attrs

## Locked decisions

| Topic | Choice |
|-------|--------|
| Scope | Props + default slot + `on:` → child props; no named slots |
| Server on UI components | Forbidden — compile error if `<script server>` present when file is used as UI component; UI components are presentational only |
| Tag rule | PascalCase (`^[A-Z]`) ⇒ component; matching import required or compile error |
| Implementation | Compile-time emit of `Comp.render` / `Comp.mount` (extend layout `children` contract) — not runtime wrappers or macro inlining |
| Event mapping | Parent `on:${name}={h}` on a component tag ⇒ prop `on${name}` (colon removed): `on:click` → `onclick`, `on:pointerdown` → `onpointerdown` |
| Fail-closed hygiene | Same deliverable: unsupported syntax throws at compile time |
| Custom elements | kebab-case stays HTML (`<my-el>`); only PascalCase is a component |

## Roles

| Role | Where | `<script server>` |
|------|--------|-------------------|
| Page / layout | `routes.ts` (`component` / `layout`) | Allowed (`load`, `actions`, `api`) |
| UI component | Imported and used as PascalCase in another `.ave` template | Forbidden |

Pages/layouts (route `component` / `layout`) may use `<script server>`. UI components may not.

**Enforcement (v1, two checks):**

1. **Usage site:** PascalCase tag requires a **default** import of the same binding name; otherwise compile error.
2. **Imported `.ave` used as a component:** When the compiler emits a component tag, it must verify the imported module has no `<script server>` (read/parse that file or rely on a compile option). Concrete mechanism for the plan: `compile(source, { asUiComponent: true })` rejects server scripts; the Vite plugin compiles `.ave` modules that are **not** the app’s route entry pages with `asUiComponent: true` when they are pulled in only as imports. Route page/layout modules keep default `asUiComponent: false`.

If a file is both a route page and imported as `<Page />` elsewhere, treat that as unsupported in v1 (document: do not import route modules as UI components).

## Authoring model

```avedon
<!-- Button.ave -->
<script>
  export let label
  export let onclick
</script>
<template>
  <button type="button" on:click={onclick}>{label}</button>
</template>
```

```avedon
<!-- Home.ave (page) -->
<script>
  import Button from './Button.ave'
  import { signal } from '@avedon/runtime'
  const n = signal(0)
</script>
<template>
  <Button label={'Count ' + n} on:click={() => n.set(n.get() + 1)} />
  <Card>
    <p>Default slot content</p>
  </Card>
</template>
```

### Props

- `export let name` declares inputs (same as today).
- Attributes: static `title="hi"`, dynamic `title={expr}`.
- Parent reactive updates flow through existing `__effects` / invalidate; child sees updated props (reassign `export let` bindings and refresh).

### Events

- On a **component** tag, `on:${name}={handler}` becomes prop `on${name}` (not a DOM listener on a fake element).
- On an **HTML** tag, `on:click` remains a DOM listener (unchanged).
- Child wires the callback to the DOM (or ignores it). No framework dispatcher in v1.

### Default slot

- Parent children of `<Card>…</Card>` become `children`.
- Child `<slot />` reads `children` (SSR: string; client: `Node` | trusted string — same contract as route layouts; see `docs/security.md`).
- Self-closing `<Card />` → no / `undefined` children.
- Named slots → compile error.

## Compiler / runtime architecture

```
tokenize
  → tag matches ^[A-Z] → token type `component` { name, attrs, children, selfClosing }
  → resolve name against import map from client <script>
  → missing import → Error

emit SSR (string render)
  → childrenHtml = emitSsr(componentChildren)
  → Comp.render({ ...props, children: childrenHtml })

emit SSR (stream)
  → build children (string or pipe helper) then writeComponent(Comp, props, ctrl)
    or Comp equivalent of layout nesting

emit client mount
  → childrenFrag = mount child DOM nodes into a fragment
  → Comp.mount(parent, { ...props, children: childrenFrag })
```

### Import map

Collect from the client script (not server):

- `import Button from './Button.ave'`
- `import Button from './Button.ave.js'` / extension variants as already resolved by Vite
- Named imports: `import { Button } from '…'` only if we document them; **v1 requires default import** for component tags (clearer; named import of a component binding can be a fast follow if needed). Locked: **default import only** for PascalCase tags in v1.

### CSS

UI component `export const css` / `cssHash` participates like layouts: when a parent renders/mounts a child, include child CSS in the page CSS accumulation path (pipeline already collects layout CSS; extend for nested component modules discovered at compile/build — Vite already injects per-module CSS for client; SSR must keep concatenating `css` from nested `render` trees the same way layouts do).

### Hydration / HMR

- No new hydration protocol: SSR HTML embeds child output; client `mount` replaces/attaches as today.
- HMR: existing Vite + signal HMR; child module invalidation is enough for v1.

## Fail-closed syntax

Compile must **throw** (not emit literal/wrong JS) for at least:

| Syntax | Error intent |
|--------|----------------|
| `{@const …}` | unsupported |
| `bind:checked`, `bind:group`, any `bind:` other than `bind:value` on HTML inputs | unsupported |
| `bind:*` on a component tag | unsupported |
| `{...spread}` on tags | unsupported |
| `{#each list as item (key)}` | already throws; keep |
| `{#key}` | unsupported |
| `class:`, `style:`, `transition:`, `use:` | unsupported |
| `<slot name="…">` | unsupported in v1 |
| PascalCase tag without default import | unknown component |
| UI component file with `<script server>` | server script not allowed on UI components |

`bind:value` on native inputs remains supported.

## Testing

- Unit (`compile.test.ts`): emit `render`/`mount` for component tags; missing import throws; server script on UI component throws; each fail-closed case throws; `on:click` → `onclick` prop; default slot → `children`.
- E2E (basic-app): add `Button.ave` (or similar); page uses it; SSR shows label; click updates a signal.

## Docs

- Update `docs/components.md`: page/layout vs UI component; props; `on:` → callback props; `<slot />`; link security note for `children`.
- Remove / rewrite “page or layout unit” phrasing that implies components cannot be composed.
- Optional small tutorial step — plan may fold into components doc only if tutorial stays short.

## Acceptance

- `pnpm build && pnpm test` green; smoke/e2e covering Button (or equivalent) green.
- No silent `createElement("PascalCase")` for imported components.
- Unsupported syntax listed above fails at compile with an actionable message.

## Follow-ups (out of this spec)

1. Per-page `<head>` / title / meta API (SEO).
2. Named slots; `bind:` on components; dispatcher-style events if needed.
3. Nested `load` on components (unlikely soon).
