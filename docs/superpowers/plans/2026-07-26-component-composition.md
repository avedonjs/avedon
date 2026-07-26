# Component Composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PascalCase tags in `.ave` templates real reusable UI components (props, default slot, `on:` → callback props, SSR + client mount), and make unsupported template syntax fail closed with clear compile errors.

**Architecture:** Extend the pure string-in/string-out compiler (`packages/compiler/src`). Add a `component` token type detected by a leading uppercase tag name, validated against the file's default imports. Emit `Comp.render({...props, children})` for the two SSR paths and `Comp.mount(parent, {...props, children})` for the client path — mirroring the existing layout `children` contract. Aggregate imported-component CSS into the parent's `export const css` so the SSR shell keeps styling nested components. Add a single `validateTokens` pass for fail-closed syntax.

**Tech Stack:** TypeScript, Vitest, the existing `@avedon/compiler` codegen (`codegen.ts`, `compile.ts`), `@avedon/runtime` mount contract, Playwright for e2e.

## Global Constraints

- Stay on `main`; commit only when the user explicitly asks (project preference). Commit steps below are marked "(when the user asks)".
- Scope v1 exactly per `docs/superpowers/specs/2026-07-26-component-composition-design.md`: props + default slot + `on:` → props; **no** named slots, `bind:` on components, `class:`/`style:`/`transition:`/`use:`, `{@const}`, `{#key}`, spread attrs, nested `load`/`<script server>` on UI components.
- Tag rule: `^[A-Z]` ⇒ component; **default import** of the same binding name required or compile error.
- Event mapping: component `on:${name}={h}` ⇒ prop `on${name}` (e.g. `on:click` → `onclick`). Wrap client handlers so the parent's `__invalidate()` runs after the callback.
- Default slot only; child reads it via existing `<slot />` → `__props.children` (SSR string; client `Node`|trusted string — see `docs/security.md`).
- `bind:value` on native inputs stays supported. No new runtime dependencies.
- Verify with `pnpm build && pnpm test` (unit) and, for the e2e task, the basic-app Playwright suite.

---

## File Structure

- `packages/compiler/src/codegen.ts` — Modify: add `component` token, detection in `tokenize`, `validateTokens`, emit in `emitSsr` / `emitSsrStream` / `emitClient(Nodes)`, extend `CompiledTemplate` + `compileMarkup` signature.
- `packages/compiler/src/compile.ts` — Modify: extract default component imports, pass to `compileMarkup`, aggregate child CSS into `export const css`, add `asUiComponent` option + server-script guard.
- `packages/compiler/src/compile.test.ts` — Modify/add: component render/mount, missing import, events→props, default slot, CSS aggregation, fail-closed cases, `asUiComponent`.
- `examples/basic-app/src/pages/Counter.ave` — Create: small reusable UI component.
- `examples/basic-app/src/pages/Home.ave` — Modify: use `<Counter />`.
- `e2e/component-composition.spec.ts` — Create: SSR shows component; click updates parent signal.
- `docs/components.md` — Modify: page/layout vs UI component; props; `on:` → callback props; `<slot />`.

Shared helpers/interfaces introduced (used across tasks):

- Token: `{ type: 'component'; name: string; attrs: Attr[]; children: Token[]; selfClosing: boolean }`
- `compileMarkup(markup: string, hash: string, components?: Set<string>): CompiledTemplate`
- `CompiledTemplate` gains `componentsUsed: string[]`
- `extractComponentImports(importsCode: string): Set<string>` in `compile.ts`
- `validateTokens(tokens: Token[], components: Set<string>): void` in `codegen.ts`

---

## Task 1: Component detection + SSR string render + missing-import error + CSS aggregation

**Files:**
- Modify: `packages/compiler/src/codegen.ts`
- Modify: `packages/compiler/src/compile.ts`
- Test: `packages/compiler/src/compile.test.ts`

**Interfaces:**
- Consumes: `parse()`, `hashStyle()`, `splitImports()` (existing in `compile.ts`).
- Produces:
  - `compileMarkup(markup, hash, components?: Set<string>): { ssrExpr, ssrStream, clientBuild, componentsUsed }`
  - `extractComponentImports(importsCode): Set<string>` — matches `import Name from '...'` where `Name` is `^[A-Z]`.
  - SSR output for `<Comp a={x} b="y">…</Comp>` ⇒ `Comp.render({ "a": (x), "b": "y", children: (<childrenSsrExpr>) })`.
  - Parent `export const css` becomes `"<own>" + (Comp.css || '')` for each used component.

- [ ] **Step 1: Write the failing tests**

Add to `packages/compiler/src/compile.test.ts`:

```ts
it('compiles a PascalCase tag to Comp.render with props and children', () => {
  const src = `<script>
  import Card from './Card.ave'
  export let title
</script>
<template><Card title={title} label="hi"><p>slot</p></Card></template>`
  const out = compile(src, { filename: 'Home.ave', generate: 'ssr' })
  expect(out.code).toContain('Card.render(')
  expect(out.code).toContain('"title": (title)')
  expect(out.code).toContain('"label": "hi"')
  expect(out.code).toMatch(/children:/)
  // child must NOT become a literal DOM element
  expect(out.code).not.toContain('document.createElement("Card")')
})

it('throws when a PascalCase tag has no matching default import', () => {
  const src = `<template><Card /></template>`
  expect(() => compile(src, { filename: 'Home.ave', generate: 'ssr' })).toThrow(
    /Unknown component <Card>/,
  )
})

it('aggregates imported component css into the parent css export (ssr)', () => {
  const src = `<script>
  import Card from './Card.ave'
</script>
<template><Card /></template>`
  const out = compile(src, { filename: 'Home.ave', generate: 'ssr' })
  expect(out.code).toContain("(Card.css || '')")
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pnpm -F @avedon/compiler test -- compile.test.ts`
Expected: FAIL — `document.createElement("Card")` still present; no `Card.render(`; no throw.

- [ ] **Step 3: Implement detection + token + validation + SSR emit**

In `packages/compiler/src/codegen.ts`:

1. Extend the `Token` union (after the `element` member):

```ts
  | {
      type: 'component'
      name: string
      attrs: Attr[]
      children: Token[]
      selfClosing: boolean
    }
```

2. In `tokenize`, inside the `if (peek() === '<')` branch, after computing `parsed` and handling `slot`, branch on an uppercase tag **before** the generic element push. Replace the element-building tail:

```ts
      const attrs = parseAttrs(parsed.attrStr)
      const selfClosing = parsed.selfClosing || VOID.has(parsed.tag.toLowerCase())
      let children: Token[] = []
      if (!selfClosing) {
        const close = `</${parsed.tag}>`
        const closeIdx = findClosingTag(input, i, parsed.tag)
        if (closeIdx === -1) throw new Error(`Unclosed tag <${parsed.tag}>`)
        children = tokenize(input.slice(i, closeIdx))
        i = closeIdx + close.length
      }
      if (/^[A-Z]/.test(parsed.tag)) {
        tokens.push({ type: 'component', name: parsed.tag, attrs, children, selfClosing: parsed.selfClosing })
        continue
      }
      tokens.push({ type: 'element', tag: parsed.tag, attrs, children, selfClosing })
      continue
```

(Note: components are never in `VOID`, so `selfClosing` for a component is `parsed.selfClosing`; children are still parsed for non-self-closing components.)

3. Update `CompiledTemplate` and `compileMarkup`:

```ts
export interface CompiledTemplate {
  ssrExpr: string
  ssrStream: string
  clientBuild: string
  componentsUsed: string[]
}

export function compileMarkup(markup: string, hash: string, components: Set<string> = new Set()): CompiledTemplate {
  const tokens = tokenize(markup)
  validateTokens(tokens, components)
  return {
    ssrExpr: emitSsr(tokens, hash),
    ssrStream: emitSsrStream(tokens, hash),
    clientBuild: emitClient(tokens, hash),
    componentsUsed: [...collectComponentNames(tokens)],
  }
}
```

4. Add helpers near `compileMarkup`:

```ts
function collectComponentNames(tokens: Token[], out: Set<string> = new Set()): Set<string> {
  for (const t of tokens) {
    if (t.type === 'component') {
      out.add(t.name)
      collectComponentNames(t.children, out)
    } else if (t.type === 'element') {
      collectComponentNames(t.children, out)
    } else if (t.type === 'if') {
      collectComponentNames(t.then, out)
      if (t.else) collectComponentNames(t.else, out)
    } else if (t.type === 'each') {
      collectComponentNames(t.body, out)
    } else if (t.type === 'await') {
      collectComponentNames(t.thenBody, out)
      if (t.catchBody) collectComponentNames(t.catchBody, out)
    }
  }
  return out
}

/** Build a component props object literal for a given emit context. */
function componentPropsObject(t: Extract<Token, { type: 'component' }>, childrenExpr: string | null): string {
  const entries: string[] = []
  for (const a of t.attrs) {
    if (a.kind === 'event') {
      const key = 'on' + a.name.slice(3) // on:click → onclick
      entries.push(`${JSON.stringify(key)}: (${a.value})`)
    } else if (a.kind === 'expr') {
      entries.push(`${JSON.stringify(a.name)}: (${a.value})`)
    } else if (a.value == null) {
      entries.push(`${JSON.stringify(a.name)}: true`)
    } else {
      entries.push(`${JSON.stringify(a.name)}: ${JSON.stringify(a.value)}`)
    }
  }
  if (childrenExpr != null) entries.push(`children: (${childrenExpr})`)
  return `{ ${entries.join(', ')} }`
}
```

5. In `emitSsr`, add a `component` branch (before the closing `return`):

```ts
    } else if (t.type === 'component') {
      const childrenExpr = t.selfClosing || t.children.length === 0 ? null : emitSsr(t.children, hash)
      parts.push(`${t.name}.render(${componentPropsObject(t, childrenExpr)})`)
```

6. Add `validateTokens` (full fail-closed logic lands in Task 4; for now implement only the unknown-component check so Task 1 passes):

```ts
function validateTokens(tokens: Token[], components: Set<string>): void {
  for (const t of tokens) {
    if (t.type === 'component') {
      if (!components.has(t.name)) {
        throw new Error(`Unknown component <${t.name}>: add \`import ${t.name} from './${t.name}.ave'\` (default import required).`)
      }
      validateTokens(t.children, components)
    } else if (t.type === 'element') {
      validateTokens(t.children, components)
    } else if (t.type === 'if') {
      validateTokens(t.then, components)
      if (t.else) validateTokens(t.else, components)
    } else if (t.type === 'each') {
      validateTokens(t.body, components)
    } else if (t.type === 'await') {
      validateTokens(t.thenBody, components)
      if (t.catchBody) validateTokens(t.catchBody, components)
    }
  }
}
```

In `packages/compiler/src/compile.ts`:

7. Add the import extractor:

```ts
function extractComponentImports(importsCode: string): Set<string> {
  const set = new Set<string>()
  const re = /import\s+([A-Z][A-Za-z0-9_]*)\s+from\s+['"][^'"]+['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(importsCode))) set.add(m[1])
  return set
}
```

8. In `compile()` (client path) replace the `compileMarkup` call and css export:

```ts
  const components = extractComponentImports(clientImports)
  const { ssrExpr, clientBuild, componentsUsed } = compileMarkup(parsed.markup || '<!-- empty -->', cssHash, components)
```

and change the css export line to include child css:

```ts
export const css = ${cssExportExpr(css, componentsUsed)};
```

9. In `compileSsr()` do the same:

```ts
  const components = extractComponentImports(clientImports)
  const { ssrExpr, ssrStream, componentsUsed } = compileMarkup(parsed.markup || '<!-- empty -->', cssHash, components)
```

and change `export const css = ${JSON.stringify(css)};` to `export const css = ${cssExportExpr(css, componentsUsed)};`.

10. Add the css helper in `compile.ts`:

```ts
function cssExportExpr(css: string, componentsUsed: string[]): string {
  const base = JSON.stringify(css)
  if (componentsUsed.length === 0) return base
  const parts = componentsUsed.map((n) => `(${n}.css || '')`)
  return [base, ...parts].join(' + ')
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm -F @avedon/compiler test -- compile.test.ts`
Expected: PASS for the three new tests; existing tests still pass.

- [ ] **Step 5: Commit (when the user asks)**

```bash
git add packages/compiler/src/codegen.ts packages/compiler/src/compile.ts packages/compiler/src/compile.test.ts
git commit -m "feat(compiler): render PascalCase tags as components (SSR string + css aggregation)"
```

---

## Task 2: Client mount for components (props, events→props, children fragment, reactivity)

**Files:**
- Modify: `packages/compiler/src/codegen.ts`
- Test: `packages/compiler/src/compile.test.ts`

**Interfaces:**
- Consumes: `emitClientNodes(tokens, hash, parent, effectsVar)`, `componentPropsObject`, the mount contract `Comp.mount(target, props) → { destroy, update }`.
- Produces: client code that (a) builds a `DocumentFragment` of slot children, (b) calls `Name.mount(parent, initialProps)`, (c) registers a parent effect calling `inst.update({...dynamicProps})`, (d) wraps event props so parent `__invalidate()` fires after the callback.

- [ ] **Step 1: Write the failing test**

```ts
it('mounts a component on the client with children and reactive props', () => {
  const src = `<script>
  import Card from './Card.ave'
  export let title
</script>
<template><Card title={title}><span>x</span></Card></template>`
  const out = compile(src, { filename: 'Home.ave', generate: 'client' })
  expect(out.code).toContain('Card.mount(')
  expect(out.code).toMatch(/\.update\(\{/)
  expect(out.code).not.toContain('document.createElement("Card")')
})

it('maps component on:click to an onclick prop that re-invalidates the parent', () => {
  const src = `<script>
  import Btn from './Btn.ave'
</script>
<template><Btn on:click={() => 1} /></template>`
  const out = compile(src, { filename: 'Home.ave', generate: 'client' })
  expect(out.code).toContain('"onclick":')
  expect(out.code).toContain('__invalidate()')
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm -F @avedon/compiler test -- compile.test.ts`
Expected: FAIL — no `Card.mount(`; component still hits the element path.

- [ ] **Step 3: Implement client emit for components**

In `emitClientNodes`, add a branch (before `} else if (t.type === 'element') {`):

```ts
    } else if (t.type === 'component') {
      const childrenVar = `${id}_children`
      const instVar = `${id}_inst`
      const hasChildren = !t.selfClosing && t.children.length > 0
      const sub: string[] = []
      if (hasChildren) {
        sub.push(`const ${childrenVar} = document.createDocumentFragment();`)
        sub.push(emitClientNodes(t.children, hash, childrenVar, effectsVar))
      }
      const staticEntries: string[] = []
      const dynamicEntries: string[] = []
      for (const a of t.attrs) {
        if (a.kind === 'event') {
          const key = 'on' + a.name.slice(3)
          staticEntries.push(`${JSON.stringify(key)}: (...__a) => { const __h = (${a.value}); const __r = typeof __h === 'function' ? __h(...__a) : undefined; __invalidate(); return __r; }`)
        } else if (a.kind === 'expr') {
          dynamicEntries.push(`${JSON.stringify(a.name)}: (${a.value})`)
        } else if (a.value == null) {
          staticEntries.push(`${JSON.stringify(a.name)}: true`)
        } else {
          staticEntries.push(`${JSON.stringify(a.name)}: ${JSON.stringify(a.value)}`)
        }
      }
      if (hasChildren) staticEntries.push(`children: ${childrenVar}`)
      const initProps = `{ ${[...staticEntries, ...dynamicEntries].join(', ')} }`
      sub.push(`const ${instVar} = ${t.name}.mount(${parent}, ${initProps});`)
      if (dynamicEntries.length > 0) {
        sub.push(`${effectsVar}.push(() => { ${instVar}.update({ ${dynamicEntries.join(', ')} }); });`)
      }
      lines.push(`{ ${sub.join('\n')} }`)
```

- [ ] **Step 4: Run test — expect PASS**

Run: `pnpm -F @avedon/compiler test -- compile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit (when the user asks)**

```bash
git add packages/compiler/src/codegen.ts packages/compiler/src/compile.test.ts
git commit -m "feat(compiler): client mount for component tags with reactive props and events"
```

---

## Task 3: SSR streaming path for components

**Files:**
- Modify: `packages/compiler/src/codegen.ts`
- Test: `packages/compiler/src/compile.test.ts`

**Interfaces:**
- Consumes: `emitSsrStream(tokens, hash)`, the stream helper `__enqueue(html)` defined in `ssrStreamBody`, `componentPropsObject`, child `Comp.render(props): string`.
- Produces: streaming SSR that enqueues the child's synchronous string render. (v1: slotted content inside components does not create out-of-order boundaries — documented limitation.)

- [ ] **Step 1: Write the failing test**

```ts
it('emits component render into the streaming SSR path', () => {
  const src = `<script>
  import Card from './Card.ave'
</script>
<template><Card label="hi"><i>c</i></Card></template>`
  const out = compile(src, { filename: 'Home.ave', generate: 'ssr' })
  // renderInto body uses __enqueue with Card.render
  expect(out.code).toMatch(/__enqueue\(\s*Card\.render\(/)
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm -F @avedon/compiler test -- compile.test.ts`
Expected: FAIL — no `__enqueue(Card.render(`.

- [ ] **Step 3: Implement stream emit for components**

In `emitSsrStream`, add a branch (before `} else if (t.type === 'element') {`):

```ts
    } else if (t.type === 'component') {
      const childrenExpr = t.selfClosing || t.children.length === 0 ? null : emitSsr(t.children, hash)
      lines.push(`__enqueue(${t.name}.render(${componentPropsObject(t, childrenExpr)}));`)
```

Note: children use `emitSsr` (string expression), not `emitSsrStream`, so slot content is materialized synchronously into the child render — consistent with the v1 non-goal of streaming boundaries inside components.

- [ ] **Step 4: Run test — expect PASS**

Run: `pnpm -F @avedon/compiler test -- compile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit (when the user asks)**

```bash
git add packages/compiler/src/codegen.ts packages/compiler/src/compile.test.ts
git commit -m "feat(compiler): stream component render in SSR renderInto path"
```

---

## Task 4: Fail-closed syntax hygiene

**Files:**
- Modify: `packages/compiler/src/codegen.ts`
- Test: `packages/compiler/src/compile.test.ts`

**Interfaces:**
- Consumes: `tokenize`, `validateTokens`, `parseAttrs`.
- Produces: compile-time `Error` (not literal/wrong JS) for: `{@const}` / other `{@x}` except `{@html}`; `{#key}`; named `<slot name>`; spread `{...}` attrs; `bind:*` other than `bind:value` on elements; any `bind:*` on components; directives `class:`/`style:`/`transition:`/`use:`/`animate:`/`in:`/`out:`; keyed `{#each … (key)}` keeps its existing throw.

- [ ] **Step 1: Write the failing tests**

```ts
it.each([
  ['const', `<template>{#each xs as x}{@const y = x}<b>{y}</b>{/each}</template>`, /Unsupported \{@const\}/],
  ['key', `<template>{#key id}<b>x</b>{/key}</template>`, /Unsupported \{#key\}/],
  ['named slot', `<template><div><slot name="footer" /></div></template>`, /Named slots are not supported/],
  ['spread', `<template><div {...rest}>x</div></template>`, /Spread attributes are not supported/],
  ['bind checked', `<template><input type="checkbox" bind:checked={on} /></template>`, /Unsupported binding "bind:checked"/],
  ['class dir', `<template><div class:active={on}>x</div></template>`, /Unsupported directive "class:active"/],
])('fails closed on %s', (_name, src, re) => {
  expect(() => compile(src, { filename: 'T.ave', generate: 'ssr' })).toThrow(re)
})

it('rejects bind on a component tag', () => {
  const src = `<script>
  import Card from './Card.ave'
</script>
<template><Card bind:value={v} /></template>`
  expect(() => compile(src, { filename: 'T.ave', generate: 'ssr' })).toThrow(/bind: is not supported on components/)
})

it('still allows bind:value on native inputs and on:click on elements', () => {
  const src = `<template><input bind:value={name} /><button on:click={() => 1}>x</button></template>`
  expect(() => compile(src, { filename: 'T.ave', generate: 'ssr' })).not.toThrow()
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pnpm -F @avedon/compiler test -- compile.test.ts`
Expected: FAIL — these currently emit literal/wrong JS instead of throwing.

- [ ] **Step 3: Implement the throws**

In `tokenize`, add near the top of the `while` loop, **before** the generic `{` expression branch and after the `{@html ` branch:

```ts
    if (startsWith('{@') && !startsWith('{@html ')) {
      const end = input.indexOf('}', i)
      const tag = input.slice(i, end === -1 ? input.length : end + 1)
      const m = tag.match(/^\{@(\w+)/)
      throw new Error(`Unsupported {@${m ? m[1] : ''}} — not available in v1`)
    }
    if (startsWith('{#key')) {
      throw new Error('Unsupported {#key} — not available in v1')
    }
```

Also make the `{@const}` message match the test: since the branch above throws `Unsupported {@const}` when `m[1]` is `const`, the regex `/Unsupported \{@const\}/` will match the emitted text `Unsupported {@const} — not available in v1`. ✅

In the `slot` handling inside `tokenize`, replace the slot push with a name check:

```ts
      if (parsed.tag.toLowerCase() === 'slot') {
        if (/(^|\s)name\s*=/.test(parsed.attrStr)) {
          throw new Error('Named slots are not supported in v1 — use the default <slot />')
        }
        if (!parsed.selfClosing) {
          const closeIdx = findClosingTag(input, i, parsed.tag)
          if (closeIdx === -1) throw new Error('Unclosed tag <slot>')
          i = closeIdx + `</${parsed.tag}>`.length
        }
        tokens.push({ type: 'slot' })
        continue
      }
```

Extend `validateTokens` to check attributes for both elements and components. Replace the `element` and `component` branches in `validateTokens`:

```ts
    if (t.type === 'component') {
      if (!components.has(t.name)) {
        throw new Error(`Unknown component <${t.name}>: add \`import ${t.name} from './${t.name}.ave'\` (default import required).`)
      }
      validateAttrs(t.attrs, { component: true, tag: t.name })
      validateTokens(t.children, components)
    } else if (t.type === 'element') {
      validateAttrs(t.attrs, { component: false, tag: t.tag })
      validateTokens(t.children, components)
    } else if ...
```

Add `validateAttrs`:

```ts
function validateAttrs(attrs: Attr[], ctx: { component: boolean; tag: string }): void {
  for (const a of attrs) {
    if (a.name.startsWith('{')) {
      throw new Error(`Spread attributes are not supported (${a.name}) on <${ctx.tag}>`)
    }
    const colon = a.name.indexOf(':')
    if (colon > 0) {
      const prefix = a.name.slice(0, colon)
      if (prefix === 'on') continue // event — allowed on both
      if (prefix === 'bind') {
        if (ctx.component) {
          throw new Error(`bind: is not supported on components (<${ctx.tag} ${a.name}>)`)
        }
        if (a.name !== 'bind:value') {
          throw new Error(`Unsupported binding "${a.name}" — only bind:value on native inputs is supported`)
        }
        continue
      }
      throw new Error(`Unsupported directive "${a.name}" on <${ctx.tag}>`)
    }
  }
}
```

Remove now-dead silent handling: the existing `emitSsrElement` / `emitClientElement` code that ignored non-`bind:value` binds can stay (it's now unreachable for those cases because validation throws first), but leave it untouched to avoid churn.

Note the keyed `{#each … (key)}` already throws `Invalid each:`; keep as-is.

- [ ] **Step 4: Run tests — expect PASS + regression**

Run: `pnpm -F @avedon/compiler test`
Expected: new fail-closed tests PASS; all existing compiler tests still PASS (they only use `bind:value`, `on:*`, `{@html}`, `{#if}`, `{#each}`, `{#await}`, default `<slot />`).

- [ ] **Step 5: Commit (when the user asks)**

```bash
git add packages/compiler/src/codegen.ts packages/compiler/src/compile.test.ts
git commit -m "feat(compiler): fail closed on unsupported template syntax"
```

---

## Task 5: Ban `<script server>` on UI components (compile option)

**Files:**
- Modify: `packages/compiler/src/compile.ts`
- Test: `packages/compiler/src/compile.test.ts`

**Interfaces:**
- Consumes: `parse()` (returns `serverScript`), `CompileOptions`.
- Produces: `CompileOptions.asUiComponent?: boolean`. When `true` and a non-empty `<script server>` is present, `compile`/`compileSsr` throw. Default `false` (route pages/layouts unaffected).

**Scope note:** This task adds the guard and covers it with a unit test. **Auto-wiring** the flag in the Vite plugin/build for every imported-but-non-route `.ave` is deferred (documented follow-up) — the practical risk is low because the client build already physically strips server script and the pipeline never calls a non-route child's `load`.

- [ ] **Step 1: Write the failing test**

```ts
it('rejects <script server> when compiled as a UI component', () => {
  const src = `<script server>
  export function load() { return { data: {} } }
</script>
<template><p>x</p></template>`
  expect(() => compile(src, { filename: 'Card.ave', asUiComponent: true })).toThrow(
    /UI components cannot have a <script server>/,
  )
  expect(() => compileSsr(src, { filename: 'Card.ave', asUiComponent: true })).toThrow(
    /UI components cannot have a <script server>/,
  )
})

it('allows <script server> by default (route pages)', () => {
  const src = `<script server>
  export function load() { return { data: {} } }
</script>
<template><p>x</p></template>`
  expect(() => compile(src, { filename: 'Page.ave' })).not.toThrow()
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm -F @avedon/compiler test -- compile.test.ts`
Expected: FAIL — `asUiComponent` unknown; no throw.

- [ ] **Step 3: Implement the option + guard**

In `compile.ts`, extend `CompileOptions`:

```ts
export interface CompileOptions {
  filename?: string
  generate?: 'client' | 'ssr'
  hmr?: boolean
  /** When true, forbid <script server> (file used as a presentational UI component). */
  asUiComponent?: boolean
}
```

Add a guard helper and call it at the top of both `compile()` and `compileSsr()` after `parse()`:

```ts
function assertNoServerOnUiComponent(serverScript: string, asUiComponent: boolean | undefined, filename: string) {
  if (asUiComponent && serverScript.trim()) {
    throw new Error(`UI components cannot have a <script server> (${filename}). Move server logic to a route page or layout.`)
  }
}
```

In `compile()`:

```ts
  const parsed = parse(source)
  assertNoServerOnUiComponent(parsed.serverScript, options.asUiComponent, filename)
```

`compileSsr()` currently has `options: { filename?: string }`. Widen it:

```ts
export function compileSsr(source: string, options: { filename?: string; asUiComponent?: boolean } = {}): CompileResult {
  const filename = options.filename ?? 'Component.ave'
  const parsed = parse(source)
  assertNoServerOnUiComponent(parsed.serverScript, options.asUiComponent, filename)
```

Also update the `compile()` delegation so it forwards the flag when routing to `compileSsr`:

```ts
  if (generate === 'ssr') return compileSsr(source, { filename, asUiComponent: options.asUiComponent })
```

- [ ] **Step 4: Run test — expect PASS**

Run: `pnpm -F @avedon/compiler test -- compile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit (when the user asks)**

```bash
git add packages/compiler/src/compile.ts packages/compiler/src/compile.test.ts
git commit -m "feat(compiler): add asUiComponent option that forbids server script"
```

---

## Task 6: Example component + e2e + docs

**Files:**
- Create: `examples/basic-app/src/pages/Counter.ave`
- Modify: `examples/basic-app/src/pages/Home.ave`
- Create: `e2e/component-composition.spec.ts`
- Modify: `docs/components.md`

**Interfaces:**
- Consumes: everything from Tasks 1–4 (component render + mount + events + slot).
- Produces: a working `<Counter />` usage proving SSR output + client interactivity end-to-end.

- [ ] **Step 1: Inspect Home + routes to place the component correctly**

Run: `sed -n '1,80p' examples/basic-app/src/pages/Home.ave` (read the current home page structure and how it is routed) and confirm `examples/basic-app/src/routes.ts` maps `/` → `Home`.
Expected: understand where to drop `<Counter />` inside `Home.ave`'s `<template>`.

- [ ] **Step 2: Create the component**

Create `examples/basic-app/src/pages/Counter.ave`:

```avedon
<script lang="ts">
  import { signal } from '@avedon/runtime'
  export let start
  const count = signal(Number(start ?? 0))
</script>

<style scoped>
  .counter {
    display: inline-flex;
    gap: 0.5rem;
    align-items: center;
  }
</style>

<template>
  <span class="counter" data-testid="counter">
    <button type="button" on:click={() => count.set(count.get() + 1)}>+</button>
    <output>{count}</output>
  </span>
</template>
```

- [ ] **Step 3: Use it in Home**

In `examples/basic-app/src/pages/Home.ave`, add to the `<script>`:

```ts
  import Counter from './Counter.ave'
```

and place inside the `<template>` (near existing demo content):

```avedon
  <Counter start={3} />
```

- [ ] **Step 4: Write the e2e spec**

Create `e2e/component-composition.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('component renders in SSR and is interactive after hydration', async ({ page }) => {
  const res = await page.goto('/')
  const html = await res!.text()
  // SSR: the component markup is present in the first response (not created client-only)
  expect(html).toContain('data-testid="counter"')
  expect(html).toContain('>3<')

  const output = page.getByTestId('counter').locator('output')
  await expect(output).toHaveText('3')
  await page.getByTestId('counter').getByRole('button', { name: '+' }).click()
  await expect(output).toHaveText('4')
})
```

- [ ] **Step 5: Build the app and run the e2e spec**

Run:
```bash
pnpm build
pnpm -F example build:app
pnpm test:e2e -- component-composition.spec.ts
```
Expected: PASS — SSR HTML contains `data-testid="counter"` and `>3<`; clicking `+` updates the output to `4`.

If `pnpm test:e2e` needs a specific config/project, run `sed -n '1,40p' package.json` at repo root to find the exact `test:e2e` script and matching Playwright config, then invoke that config with the single spec.

- [ ] **Step 6: Update docs**

In `docs/components.md`, replace the opening line and add a "Using components" section:

- Change the first paragraph so it no longer implies a `.ave` file is only a page/layout. New opening:

```md
A `.ave` file is a **page**, **layout**, or reusable **UI component**: markup, styles, client logic, and (for pages/layouts) server logic live together. The compiler splits client and server so server code never ships to the browser.
```

- Add after the "Template" section:

```md
## Using components

Import another `.ave` file and use it as a **PascalCase** tag. The import must be a default import whose name matches the tag, or compilation fails.

\`\`\`avedon
<script>
  import Counter from './Counter.ave'
</script>
<template>
  <Counter start={3} />
</template>
\`\`\`

- **Props:** attributes become props — `start={3}` (dynamic) or `label="hi"` (static). `export let` in the component declares them.
- **Events:** `on:click={handler}` on a component becomes an `onclick` prop the component can wire to the DOM. There is no event dispatcher in v1.
- **Default slot:** children between the tags fill the component's `<slot />` (`__props.children`; see [Security](./security.md) for the trusted-HTML contract).

UI components are presentational: they cannot declare `<script server>` / `load` / `actions`. Keep server logic in the route page or layout.

Not supported in v1: named slots, `bind:` on components, `class:`/`style:`/`transition:`/`use:` directives, `{@const}`, `{#key}`, and spread attributes — these fail at compile time with a clear message.
```

(Escape the code fences properly when writing the file — the `\`\`\`avedon` above is illustrative.)

- [ ] **Step 7: Full verification**

Run: `pnpm build && pnpm test`
Expected: all unit tests PASS.

- [ ] **Step 8: Commit (when the user asks)**

```bash
git add examples/basic-app/src/pages/Counter.ave examples/basic-app/src/pages/Home.ave e2e/component-composition.spec.ts docs/components.md
git commit -m "feat(example,docs): demonstrate and document component composition"
```

---

## Self-Review

**1. Spec coverage**

| Spec requirement | Task |
|------------------|------|
| PascalCase ⇒ component; default import required or error | Task 1 |
| SSR string render with props + children | Task 1 |
| Child CSS reaches SSR shell | Task 1 (css aggregation) |
| Client mount with reactive props | Task 2 |
| `on:` → `on*` prop; parent re-invalidate | Task 2 |
| SSR streaming path | Task 3 |
| Default slot via `<slot />`/`children` | Tasks 1–3 (reuses existing slot emit) |
| Fail closed: `{@const}`, `{#key}`, named slot, spread, bad binds, directives | Task 4 |
| `bind:value` on inputs still works | Task 4 (regression test) |
| `<script server>` forbidden on UI components | Task 5 (option; auto-wire deferred, noted) |
| Example + e2e + docs | Task 6 |

**2. Placeholder scan:** No TBD/TODO; every code step includes full code. The docs code-fence escaping caveat is called out in Task 6 Step 6.

**3. Type consistency:** `componentPropsObject(t, childrenExpr)` is used identically in Task 1 (`emitSsr`) and Task 3 (`emitSsrStream`). `CompiledTemplate.componentsUsed` (Task 1) is consumed by `cssExportExpr` (Task 1). `extractComponentImports` (Task 1) feeds the `components` set passed to `compileMarkup` in both `compile` and `compileSsr`. `validateTokens` is introduced minimally in Task 1 and extended in Task 4 with `validateAttrs` — names consistent. `asUiComponent` (Task 5) added to `CompileOptions` and `compileSsr`'s options.

**Known v1 limitations (documented, intentional):** slot/component content is not out-of-order-streamed (Task 3 note); `asUiComponent` auto-wiring deferred (Task 5 note).
