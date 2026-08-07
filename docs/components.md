# Components

A `.ave` file is a **page**, **layout**, or reusable **UI component**: markup, styles, client logic, and (for pages/layouts) server logic live together. The compiler splits client and server so server code never ships to the browser.

## Sections

| Section | Purpose |
|---------|---------|
| `<script server>` | Server-only. May export `load`, `actions`, `api_*`, etc. |
| `<script>` | Client-only. Receives props / load data; uses the runtime |
| `<style scoped>` | CSS scoped to the component |
| `<template>` | Markup rendered for the page |

Order of sections is flexible; keep server script clearly separated from client script.

## Client script

```avedon
<script>
  import { signal } from '@avedon/runtime'
  export let title
  const count = signal(0)
</script>
```

- `export let …` declares inputs from `load` / parent data
- Use `signal`, `computed`, and `effect` for reactivity — see [Reactivity](./reactivity.md)
- Never import server-only modules into the client script

## Typing load, params, and actions

Generated `*.ave.d.ts` files type `Props` (including inferred `data` from `load`), `mount` / `render` props, and server handlers.

Annotate `load` with `LoadEvent<'/posts/:id'>` (path pattern) or `LoadContext<{ id: string }>`. Keep that path string aligned with `route('/posts/:id', …)` in `routes.ts`.

```avedon
<script server>
  import { type LoadEvent, notFound } from '@avedon/server'

  export async function load({
    params,
  }: LoadEvent<'/posts/:id'>): Promise<{ data: { id: string } }> {
    if (!params.id) throw notFound()
    return { data: { id: params.id } }
  }
</script>
```

For `load`, `actions`, and `api_*` details, see [Loading data](./loading-data.md). Prefer `route('/posts/:id', { guard: (e) => … })` so `e.params` is typed in [Routing](./routing.md).

## Template

```avedon
<template>
  <h1>{title}</h1>
  <button type="button" on:click={() => count.set(count.get() + 1)}>
    {count}
  </button>
</template>
```

Supported patterns include:

- Text and expressions: `{expr}`
- HTML comments: `<!-- … -->` (stripped at compile time; never reach the DOM)
- Trusted HTML: `{@html htmlString}` — unescaped; see [Security](./security.md)
- Local bindings: `{@const name = expr}` — scoped to following siblings in the same block
- Reusable template fragments: `{#snippet name(a, b)}…{/snippet}` at the template root, invoked with `{@render name(x, y)}` anywhere in the template (parameters are simple identifiers; shares outer scope)
- Events: `on:click={handler}` or `on:click={() => …}`; modifiers `preventDefault`, `stopPropagation`, `stopImmediatePropagation`, `once`, `self`, `capture`, `passive`, `nonpassive` (e.g. `on:submit|preventDefault`, `on:wheel|nonpassive`)
- Boolean attributes: `disabled={cond}`, `hidden={cond}`, `required={cond}`, … — omitted when falsy (not `disabled="false"`)
- Spread attributes: `{...obj}` on elements (skips `on*` and `:` keys) and on components (merged into props via `Object.assign`, later wins)
- Control flow: `{#if}` / `{:else if}` / `{:else}` / `{/if}`, `{#each items as item (item.id)}` / `{:else}` / `{/each}`, `{#await promise}…{:then value}…{:catch err}…{/await}`, `{#key expr}` / `{/key}`
- Bindings: `bind:value={name}` on inputs/textareas/`<select>` (select uses `change` + SSR `selected` on options; `<select multiple bind:value={arr}>` binds a `string[]`; static `type="number"` / `type="range"` bind as `number`, empty → `undefined`), `bind:checked={on}`, `bind:indeterminate={mid}` (checkbox IDL, client-only), `bind:open={show}` on `<details>` / `<dialog>` (SSR `open` attr + client `toggle`), `bind:muted` / `paused` / `volume` / `currentTime` / `playbackRate` / `duration` / `ended` / `seeking` / `played` / `buffered` / `seekable` / `readyState` / `networkState` / `videoWidth` / `videoHeight` on `<audio>` / `<video>` (client-only; `duration` / `ended` / `seeking` / `played` / `buffered` / `seekable` / `readyState` / `networkState` / `videoWidth` / `videoHeight` are read from the element), `bind:naturalWidth` / `naturalHeight` on `<img>` (client-only, `load` / `error`), `bind:textContent={text}` / `bind:innerText={text}` on contenteditable elements (client-only), `bind:group={choice}` (radios) / `bind:group={tags}` (checkbox arrays) on native inputs; `bind:files={list}` on `type="file"` (client `FileList`, SSR ignored); `bind:clientWidth` / `clientHeight` / `offsetWidth` / `offsetHeight` (client `ResizeObserver`, SSR ignored); `bind:scrollTop` / `scrollLeft` (two-way, SSR ignored); `bind:selectionStart` / `selectionEnd` (two-way caret range on text inputs / textareas, SSR ignored); `bind:this={el}` for element refs (client-only)
- Class toggles: `class:active={cond}` (or `class:active` shorthand when the name matches an identifier)
- Style properties: `style:color={c}` / `style:font-size={n}` / `style:--accent={c}` (or `style:color` shorthand)
- Element actions: `use:action` / `use:action={params}` (client-only)
- Intro/outro transitions: `transition:fade` / `fly` / `slide` / `scale` / `blur` / `draw`, plus intro-only `in:` / outro-only `out:` (optional `duration` / `delay` / `easing` CSS timing function; fly `x`/`y`; scale `start`; blur `amount`; draw uses SVG `getTotalLength` + stroke-dashoffset; client-only). `in:crossfade={{ key }}` / `out:crossfade={{ key }}` morph between matched keys. Client SVG tags under `<svg>` use `createElementNS`.
- Component `bind:value={signal}` — passes `value` + `onUpdate` props; the child should call `onUpdate(next)` when the value changes.
- Forms: `method="POST"` with [actions](./loading-data.md)

## Using components

Import another `.ave` file and use it as a **PascalCase** tag. The import must be a default import whose name matches the tag, or compilation fails.

```avedon
<script>
  import Counter from './Counter.ave'
</script>
<template>
  <Counter start={3} />
</template>
```

- **Props:** attributes become props — `start={3}` (dynamic) or `label="hi"` (static). `export let` in the component declares them.
- **Events:** `on:click={handler}` on a component becomes an `onclick` prop. Prefer `createEventDispatcher()` from `@avedon/runtime` inside the child — `dispatch('save', detail)` calls the parent's `on:save` handler with `{ type, detail }`. You can still forward manually with `export let onclick` + `on:click={onclick}` on a DOM node.
- **Context:** `setContext(key, value)` in a parent and `getContext(key)` / `hasContext(key)` / `getAllContexts()` in a child (top-level `<script>` during init / SSR).
- **Lifecycle:** nested components call `.destroy()` when removed from `{#if}` / `{#each}` / `{#key}` / `{#await}` blocks (and when the parent instance is destroyed), so `onDestroy`, `pageTitle` restore, and other mount cleanups run.
- **Default slot:** children between the tags fill the component's `<slot />` (`children` prop; see [Security](./security.md) for the trusted-HTML contract).
- **Named slots:** mark projected content with `slot="name"` and receive it with `<slot name="name">fallback</slot>`. Content arrives on a `slots` prop bag (`slots.header`, …). Default content still uses `children` / bare `<slot />`.

### `{#key}`

When the expression changes (`Object.is`), the block is destroyed and remounted. Useful when you need a fresh DOM subtree for the same markup shape:

```avedon
<template>
  {#key selectedId}
    <Editor id={selectedId} />
  {/key}
</template>
```

SSR renders the body once; remount is a client concern.

### Keyed `{#each}`

Add `(keyExpression)` after the item/index binding to preserve DOM identity while items reorder:

```avedon
{#each todos as todo, i (todo.id)}
  <Todo item={todo} position={i} />
{/each}
```

Keys must be unique. Reordering the same item objects moves their existing DOM nodes; changed item values are rebuilt so template bindings stay current.

### Empty `{#each}` (`{:else}`)

When the list is empty (or nullish), render the `{:else}` branch instead of item rows — works with keyed and unkeyed each:

```avedon
{#each todos as todo (todo.id)}
  <Todo item={todo} />
{:else}
  <p>No todos yet.</p>
{/each}
```

### `{@const}`

Declare a local binding for following siblings in the same block (handy inside `{#each}` / `{#if}`):

```avedon
{#each items as item}
  {@const total = item.price * qty}
  <li>{item.name}: {total}</li>
{/each}
```

### Snippets

Reusable template fragments in the same file — define once at the template root, render anywhere:

```avedon
{#snippet badge(label, tone)}
  <span class="badge badge-{tone}">{label}</span>
{/snippet}

<ul>
  {#each items as item}
    <li>{@render badge(item.name, item.active ? 'ok' : 'muted')}</li>
  {/each}
</ul>
```

Snippet parameters are simple identifiers. The body can read outer scope (props, signals, `{@const}`). Definitions must sit at the template root (not inside `{#if}` / `{#each}`).

### `{#await}` pending

Content before `{:then}` / `{:catch}` is the pending UI (SSR + client). Streaming SSR puts it inside the OOO placeholder until the promise settles:

```avedon
{#await loadUser()}
  <p>Loading…</p>
{:then user}
  <p>{user.name}</p>
{:catch err}
  <p>{err.message}</p>
{/await}
```

Skip the pending block with a header shorthand:

```avedon
{#await loadUser() then user}
  <p>{user.name}</p>
{/await}

{#await loadUser() catch err}
  <p>{err.message}</p>
{/await}
```

### Event modifiers

Pipe modifiers after the event name. Handler is optional when modifiers alone are enough:

```avedon
<form on:submit|preventDefault={save}>…</form>
<button on:click|once|stopPropagation={ping}>Once</button>
<div on:click|self={onSelf}>Only direct clicks</div>
```

Supported: `preventDefault`, `stopPropagation`, `stopImmediatePropagation`, `once`, `self`, `capture`, `passive`, `nonpassive` (`passive` and `nonpassive` cannot be combined).

### Boolean attributes

Expression forms of HTML boolean attributes omit the attribute when falsy (so `disabled={false}` does not become `disabled="false"`):

```avedon
<button disabled={busy}>Save</button>
<input required={must} readonly={locked} />
```

Covers common booleans such as `disabled`, `hidden`, `required`, `readonly`, `open`, `multiple`, `selected`, …

### `class:` directive

Toggle CSS class names from a boolean expression. Merges with a static or dynamic `class` attribute:

```avedon
<template>
  <button class="btn" class:primary={isPrimary} class:disabled={busy}>Save</button>
</template>
```

Shorthand `class:active` means `class:active={active}` when the class name is a valid identifier. Not supported on component tags (elements only).

### `style:` directive

Set individual CSS properties from expressions. Merges with a static or dynamic `style` attribute. `null` / `undefined` / `false` omit the property:

```avedon
<template>
  <div style="display:block" style:color={fg} style:font-size={size}>Hi</div>
  <p style:--accent={fg} style="color: var(--accent)">Themed</p>
</template>
```

Shorthand `style:color` means `style:color={color}` when the property name is a valid identifier. CSS custom properties work the same way (`style:--accent={fg}`). Not supported on component tags (elements only).

### `use:` actions

Attach a client-side action to an element. SSR ignores `use:` (no attribute emitted):

```avedon
<script>
  function autofocus(node) {
    node.focus()
  }
  function tooltip(node, text) {
    node.title = text
    return {
      update(next) { node.title = next },
      destroy() { node.removeAttribute('title') },
    }
  }
</script>
<template>
  <input use:autofocus />
  <button use:tooltip={label}>Save</button>
</template>
```

The action may return a cleanup function, or `{ update, destroy }`. Parameter changes call `update` when present; otherwise the action is destroyed and recreated. Not supported on component tags.

`portal` from `@avedon/runtime` moves a node into another host (useful for modals/tooltips):

```avedon
<script>
  import { portal } from '@avedon/runtime'
</script>
<template>
  <div id="overlay-root"></div>
  <dialog use:portal={'#overlay-root'}>…</dialog>
</template>
```

Default target is `'body'`. Selector targets resolve in the current mount tree first (so soft-hydrate remounts work), then `document`. `update` re-parents when the selector/host changes; `destroy` removes the node.

`clickOutside` calls a handler on capture-phase `pointerdown` outside the element (pass `null` to disable):

```avedon
<script>
  import { clickOutside, signal } from '@avedon/runtime'
  const open = signal(true)
</script>
<template>
  {#if open}
    <div use:clickOutside={() => open.set(false)}>Menu</div>
  {/if}
</template>
```

`longPress` calls a handler after the pointer is held on the element (handler or `{ handler, duration }`, default 500ms; pass `null` to disable):

```avedon
<script>
  import { longPress, signal } from '@avedon/runtime'
  const n = signal(0)
</script>
<template>
  <button type="button" use:longPress={() => n.update((v) => v + 1)}>Hold</button>
</template>
```

`holdRepeat` fires on pointerdown and keeps firing while held (steppers; `{ handler, delay?, interval?, immediate? }`; defaults delay `400` / interval `100` / immediate `true`; pass `null` to disable):

```avedon
<script>
  import { holdRepeat, signal } from '@avedon/runtime'
  const n = signal(0)
  const bump = { delay: 300, interval: 50, handler: () => n.update((v) => v + 1) }
</script>
<template>
  <button type="button" use:holdRepeat={bump}>+</button>
</template>
```

`autofocus` focuses the element after mount (microtask; pass `false` to skip; re-enabling focuses again):

```avedon
<script>
  import { autofocus, signal } from '@avedon/runtime'
  const show = signal(false)
</script>
<template>
  {#if show.get()}
    <input use:autofocus />
  {/if}
</template>
```

`selectOnFocus` selects the control's text when it receives focus (inputs/textareas with `select()`; pass `false`/`null` to disable):

```avedon
<script>
  import { selectOnFocus } from '@avedon/runtime'
</script>
<template>
  <input value="edit me" use:selectOnFocus />
</template>
```

`trim` removes leading/trailing whitespace from an input/textarea value on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { trim } from '@avedon/runtime'
</script>
<template>
  <input use:trim />
</template>
```

`trimStart` removes leading whitespace from an input/textarea value on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { trimStart } from '@avedon/runtime'
</script>
<template>
  <input use:trimStart />
</template>
```

`trimEnd` removes trailing whitespace from an input/textarea value on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { trimEnd } from '@avedon/runtime'
</script>
<template>
  <input use:trimEnd />
</template>
```

`initials` converts words to their initials on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { initials } from '@avedon/runtime'
</script>
<template>
  <input use:initials />
</template>
```

`collapseWhitespace` collapses runs of whitespace to a single space and trims on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { collapseWhitespace } from '@avedon/runtime'
</script>
<template>
  <input use:collapseWhitespace />
</template>
```

`removeWhitespace` removes all whitespace from an input/textarea value on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { removeWhitespace } from '@avedon/runtime'
</script>
<template>
  <input use:removeWhitespace />
</template>
```

`numeric` keeps only digit characters (`0-9`) in an input/textarea as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { numeric } from '@avedon/runtime'
</script>
<template>
  <input use:numeric inputmode="numeric" />
</template>
```

`decimal` keeps digits and at most one `.` as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { decimal } from '@avedon/runtime'
</script>
<template>
  <input use:decimal inputmode="decimal" />
</template>
```

`hex` keeps an optional leading `#` and hex digits (`0-9a-f`) as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { hex } from '@avedon/runtime'
</script>
<template>
  <input use:hex />
</template>
```

`integer` keeps an optional leading `-` and digits as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { integer } from '@avedon/runtime'
</script>
<template>
  <input use:integer inputmode="numeric" />
</template>
```

`signedDecimal` keeps an optional leading `-`, digits, and at most one `.` as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { signedDecimal } from '@avedon/runtime'
</script>
<template>
  <input use:signedDecimal inputmode="decimal" />
</template>
```

`phone` keeps phone-friendly characters (digits, `+`, `-`, `(`, `)`, `.`, spaces) as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { phone } from '@avedon/runtime'
</script>
<template>
  <input use:phone type="tel" />
</template>
```

`email` keeps email-friendly characters (`a-z`, `0-9`, `@`, `.`, `_`, `+`, `-`) and lowercases as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { email } from '@avedon/runtime'
</script>
<template>
  <input use:email type="email" />
</template>
```

`url` keeps URL-friendly characters (letters, digits, and common URI punctuation) as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { url } from '@avedon/runtime'
</script>
<template>
  <input use:url type="url" />
</template>
```

`username` keeps handle-friendly characters (`a-z`, `0-9`, `_`, `-`) and lowercases as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { username } from '@avedon/runtime'
</script>
<template>
  <input use:username autocomplete="username" />
</template>
```

`creditCard` keeps digits, spaces, and hyphens as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { creditCard } from '@avedon/runtime'
</script>
<template>
  <input use:creditCard inputmode="numeric" autocomplete="cc-number" />
</template>
```

`postalCode` keeps letters, digits, spaces, and hyphens and uppercases as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { postalCode } from '@avedon/runtime'
</script>
<template>
  <input use:postalCode autocomplete="postal-code" />
</template>
```

`iban` keeps letters, digits, and spaces and uppercases as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { iban } from '@avedon/runtime'
</script>
<template>
  <input use:iban autocomplete="off" />
</template>
```

`cvv` keeps up to 4 digits (card CVV/CVC) as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { cvv } from '@avedon/runtime'
</script>
<template>
  <input use:cvv inputmode="numeric" autocomplete="cc-csc" />
</template>
```

`expiry` formats card expiry as `MM/YY` while typing (pass `false`/`null` to disable):

```avedon
<script>
  import { expiry } from '@avedon/runtime'
</script>
<template>
  <input use:expiry inputmode="numeric" autocomplete="cc-exp" />
</template>
```

`letters` keeps only letters (`A-Z`, `a-z`) as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { letters } from '@avedon/runtime'
</script>
<template>
  <input use:letters />
</template>
```

`pin` keeps up to 4 digits (PIN) as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { pin } from '@avedon/runtime'
</script>
<template>
  <input use:pin type="password" inputmode="numeric" autocomplete="off" />
</template>
```

`ascii` keeps printable ASCII characters (U+0020–U+007E) as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { ascii } from '@avedon/runtime'
</script>
<template>
  <input use:ascii />
</template>
```

`removePunct` removes punctuation while typing (keeps letters, digits, and whitespace; pass `false`/`null` to disable):

```avedon
<script>
  import { removePunct } from '@avedon/runtime'
</script>
<template>
  <input use:removePunct />
</template>
```

`removeDiacritics` removes accent marks while typing (e.g. `é` → `e`; pass `false`/`null` to disable):

```avedon
<script>
  import { removeDiacritics } from '@avedon/runtime'
</script>
<template>
  <input use:removeDiacritics />
</template>
```

`currency` keeps an optional leading `$`, digits, and at most one `.` as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { currency } from '@avedon/runtime'
</script>
<template>
  <input use:currency inputmode="decimal" />
</template>
```

`percent` keeps digits, at most one `.`, and an optional trailing `%` as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { percent } from '@avedon/runtime'
</script>
<template>
  <input use:percent inputmode="decimal" />
</template>
```

`otp` keeps up to 6 digits (one-time passcode) as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { otp } from '@avedon/runtime'
</script>
<template>
  <input use:otp inputmode="numeric" autocomplete="one-time-code" />
</template>
```

`alphanumeric` keeps only letters and digits (`A-Z`, `a-z`, `0-9`) as the user types (pass `false`/`null` to disable):

```avedon
<script>
  import { alphanumeric } from '@avedon/runtime'
</script>
<template>
  <input use:alphanumeric />
</template>
```

`slugify` turns an input/textarea value into a URL slug on blur (lowercase, non-alphanumeric → `-`; pass `false`/`null` to disable):

```avedon
<script>
  import { slugify } from '@avedon/runtime'
</script>
<template>
  <input use:slugify />
</template>
```

`capitalize` title-cases each word in an input/textarea value on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { capitalize } from '@avedon/runtime'
</script>
<template>
  <input use:capitalize />
</template>
```

`sentenceCase` uppercases the first letter and lowercases the rest on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { sentenceCase } from '@avedon/runtime'
</script>
<template>
  <input use:sentenceCase />
</template>
```

`camelCase` converts words to camelCase on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { camelCase } from '@avedon/runtime'
</script>
<template>
  <input use:camelCase />
</template>
```

`snakeCase` converts words to snake_case on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { snakeCase } from '@avedon/runtime'
</script>
<template>
  <input use:snakeCase />
</template>
```

`kebabCase` converts words to kebab-case on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { kebabCase } from '@avedon/runtime'
</script>
<template>
  <input use:kebabCase />
</template>
```

`constantCase` converts words to CONSTANT_CASE on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { constantCase } from '@avedon/runtime'
</script>
<template>
  <input use:constantCase />
</template>
```

`pascalCase` converts words to PascalCase on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { pascalCase } from '@avedon/runtime'
</script>
<template>
  <input use:pascalCase />
</template>
```

`dotCase` converts words to dot.case on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { dotCase } from '@avedon/runtime'
</script>
<template>
  <input use:dotCase />
</template>
```

`pathCase` converts words to path/case on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { pathCase } from '@avedon/runtime'
</script>
<template>
  <input use:pathCase />
</template>
```

`trainCase` converts words to Train-Case on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { trainCase } from '@avedon/runtime'
</script>
<template>
  <input use:trainCase />
</template>
```

`swapCase` swaps letter casing on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { swapCase } from '@avedon/runtime'
</script>
<template>
  <input use:swapCase />
</template>
```

`reverse` reverses the current value on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { reverse } from '@avedon/runtime'
</script>
<template>
  <input use:reverse />
</template>
```

`maxLength` clamps an input/textarea to at most N characters while typing (pass a number, `{ length }`, or `null` to disable):

```avedon
<script>
  import { maxLength } from '@avedon/runtime'
</script>
<template>
  <input use:maxLength={32} />
</template>
```

`lowercase` lowercases an input/textarea value on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { lowercase } from '@avedon/runtime'
</script>
<template>
  <input type="email" use:lowercase />
</template>
```

`uppercase` uppercases an input/textarea value on blur (pass `false`/`null` to disable):

```avedon
<script>
  import { uppercase } from '@avedon/runtime'
</script>
<template>
  <input use:uppercase />
</template>
```

`autoHeight` grows a textarea to fit its content on `input` (pass `false`/`null` to disable):

```avedon
<script>
  import { autoHeight } from '@avedon/runtime'
</script>
<template>
  <textarea use:autoHeight rows="1"></textarea>
</template>
```

`debounce` calls `handler(value)` after input settles (`wait` default `300` ms; pass a handler or `{ handler, wait }`; pass `null` to disable):

```avedon
<script>
  import { debounce, signal } from '@avedon/runtime'
  const q = signal('')
  const search = { wait: 250, handler: (v) => q.set(v) }
</script>
<template>
  <input type="search" use:debounce={search} />
</template>
```

`throttle` calls `handler(value)` at most once per `wait` ms (default `200`; leading + trailing; pass `null` to disable):

```avedon
<script>
  import { signal, throttle } from '@avedon/runtime'
  const q = signal('')
  const live = { wait: 100, handler: (v) => q.set(v) }
</script>
<template>
  <input type="search" use:throttle={live} />
</template>
```

`input` calls `handler(value, event)` on every `input` event (live while typing; pass `null` to disable):

```avedon
<script>
  import { input, signal } from '@avedon/runtime'
  const q = signal('')
</script>
<template>
  <input type="search" use:input={(v) => q.set(v)} />
</template>
```

`change` calls `handler(value, event)` on the control's `change` event (committed value; pass `null` to disable):

```avedon
<script>
  import { change, signal } from '@avedon/runtime'
  const picked = signal('')
</script>
<template>
  <select use:change={(v) => picked.set(v)}>
    <option value="a">A</option>
  </select>
</template>
```

`submit` handles `<form>` submit with `handler(FormData, event)` (`preventDefault` defaults to `true`; pass `null` to disable):

```avedon
<script>
  import { signal, submit } from '@avedon/runtime'
  const name = signal('')
</script>
<template>
  <form use:submit={(fd) => name.set(String(fd.get('name') || ''))}>
    <input name="name" />
    <button type="submit">Save</button>
  </form>
</template>
```

`formdata` runs when `FormData` is constructed for a form (e.g. during `use:submit`), so you can append or tweak entries first (pass `null` to disable):

```avedon
<script>
  import { formdata, signal, submit } from '@avedon/runtime'
  const tag = signal('')
</script>
<template>
  <form
    use:formdata={(fd) => fd.set('tag', 'ok')}
    use:submit={(fd) => tag.set(String(fd.get('tag') || ''))}
  >
    <button type="submit">Save</button>
  </form>
</template>
```

`reset` calls a handler on `<form>` reset (pass `null` to disable):

```avedon
<script>
  import { reset, signal } from '@avedon/runtime'
  const n = signal(0)
</script>
<template>
  <form use:reset={() => n.update((x) => x + 1)}>
    <button type="reset">Clear</button>
  </form>
</template>
```

`invalid` calls a handler when a control fails constraint validation (`preventDefault` defaults to `true`; pass `null` to disable):

```avedon
<script>
  import { invalid, signal } from '@avedon/runtime'
  const err = signal('')
</script>
<template>
  <input type="email" required use:invalid={() => err.set('bad email')} />
</template>
```

`copy` writes text to the clipboard on click (string/number, getter, or `null` to disable):

```avedon
<script>
  import { copy } from '@avedon/runtime'
</script>
<template>
  <button type="button" use:copy={'hello'}>Copy</button>
</template>
```

`paste` reads pasted plain text and calls `handler(text, event)` (`preventDefault` defaults to true; pass a handler or `{ handler, preventDefault? }`; pass `null` to disable):

```avedon
<script>
  import { paste, signal } from '@avedon/runtime'
  const text = signal('')
</script>
<template>
  <textarea use:paste={(t) => text.set(t)}></textarea>
</template>
```

`cut` reads cut plain text (falls back to the current selection) and calls `handler(text, event)` (`preventDefault` defaults to true; pass `null` to disable):

```avedon
<script>
  import { cut, signal } from '@avedon/runtime'
  const text = signal('')
</script>
<template>
  <textarea use:cut={(t) => text.set(t)}></textarea>
</template>
```

`beforeinput` calls a handler on `beforeinput` (IME-aware insert/delete; pass `null` to disable):

```avedon
<script>
  import { beforeinput, signal } from '@avedon/runtime'
  const last = signal('')
</script>
<template>
  <input use:beforeinput={(e) => last.set(e.data || '')} />
</template>
```

`composition` reports IME composition phases as `{ phase, data, event }` (`start` / `update` / `end`; pass `null` to disable):

```avedon
<script>
  import { composition, signal } from '@avedon/runtime'
  const composing = signal(false)
</script>
<template>
  <input use:composition={(i) => composing.set(i.phase !== 'end')} />
</template>
```

`selectionchange` reports the current selection in an input/textarea as `{ start, end, text }` (pass `null` to disable):

```avedon
<script>
  import { selectionchange, signal } from '@avedon/runtime'
  const sel = signal('')
</script>
<template>
  <input use:selectionchange={(i) => sel.set(i.text)} value="hello" />
</template>
```

`hover` reports pointer enter/leave as `(hovered, event)` (pass `null` to disable):

```avedon
<script>
  import { hover, signal } from '@avedon/runtime'
  const over = signal(false)
</script>
<template>
  <div use:hover={(v) => over.set(v)}>{over.get() ? 'in' : 'out'}</div>
</template>
```

`dblclick` calls a handler on double-click (pass `null` to disable):

```avedon
<script>
  import { dblclick, signal } from '@avedon/runtime'
  const n = signal(0)
</script>
<template>
  <button type="button" use:dblclick={() => n.update((x) => x + 1)}>Edit</button>
</template>
```

`contextmenu` calls a handler on right-click / context menu. `preventDefault` defaults to `true` (pass `null` to disable):

```avedon
<script>
  import { contextmenu, signal } from '@avedon/runtime'
  const open = signal(false)
</script>
<template>
  <div use:contextmenu={() => open.set(true)}>Custom menu target</div>
</template>
```

`wheel` calls a handler on wheel / trackpad scroll over the element (pass `null` to disable):

```avedon
<script>
  import { signal, wheel } from '@avedon/runtime'
  const dy = signal(0)
</script>
<template>
  <div use:wheel={(e) => dy.set(e.deltaY)}>Scroll me</div>
</template>
```

`scroll` reports the element's `scrollLeft` / `scrollTop` as `{ x, y }` on scroll (pass `null` to disable; `{ immediate: true }` fires once on attach):

```avedon
<script>
  import { scroll, signal } from '@avedon/runtime'
  const y = signal(0)
</script>
<template>
  <div use:scroll={(pos) => y.set(pos.y)} style="overflow:auto;height:8rem">…</div>
</template>
```

`snap` enables CSS scroll snap on a container and sets `scroll-snap-align` on direct children (`axis` default `x`, `align` default `start`, `type` default `mandatory`):

```avedon
<script>
  import { snap } from '@avedon/runtime'
</script>
<template>
  <div use:snap={{ axis: 'x' }} style="display:flex;width:20rem">
    <section style="flex:0 0 20rem">One</section>
    <section style="flex:0 0 20rem">Two</section>
  </div>
</template>
```

`pressed` toggles a CSS class (default `pressed`) while the pointer is down. Pass a class name string, `{ class, handler }`, or `false`/`null` to disable:

```avedon
<script>
  import { pressed } from '@avedon/runtime'
</script>
<template>
  <button type="button" use:pressed>Hold</button>
</template>
```

`focusWithin` reports whether focus is inside the element or its descendants (pass `null` to disable):

```avedon
<script>
  import { focusWithin, signal } from '@avedon/runtime'
  const inside = signal(false)
</script>
<template>
  <div use:focusWithin={(v) => inside.set(v)}>
    <input />
  </div>
</template>
```

`focus` reports whether the element itself is focused (pass `null` to disable):

```avedon
<script>
  import { focus, signal } from '@avedon/runtime'
  const on = signal(false)
</script>
<template>
  <input use:focus={(v) => on.set(v)} />
</template>
```

`focusVisible` toggles a CSS class (default `focus-visible`) when the element matches `:focus-visible` — typically keyboard focus, not a mouse click. Pass a class name string, `{ class, handler }`, or `false`/`null` to disable:

```avedon
<script>
  import { focusVisible } from '@avedon/runtime'
</script>
<template>
  <button type="button" use:focusVisible>Tab me</button>
</template>
```

`download` saves a file on click (`{ filename, data, type? }`; `data` may be a getter; pass `null` to disable):

```avedon
<script>
  import { download } from '@avedon/runtime'
</script>
<template>
  <button type="button" use:download={{ filename: 'hi.txt', data: 'hello' }}>Save</button>
</template>
```

`fullscreen` toggles the Fullscreen API for the element on click (pass `false` to disable):

```avedon
<script>
  import { fullscreen } from '@avedon/runtime'
</script>
<template>
  <div use:fullscreen>Click me</div>
</template>
```

`resize` observes element size via `ResizeObserver` (pass `null` to disable):

```avedon
<script>
  import { resize, signal } from '@avedon/runtime'
  const w = signal(0)
</script>
<template>
  <div use:resize={(e) => w.set(e.contentRect.width)}>{w.get()}</div>
</template>
```

`swipe` detects pointer swipes (`left` / `right` / `up` / `down`; handler or `{ handler, threshold }`, default 40px):

```avedon
<script>
  import { swipe, signal } from '@avedon/runtime'
  const dir = signal('none')
</script>
<template>
  <div use:swipe={(i) => dir.set(i.direction)}>{dir.get()}</div>
</template>
```

`pinch` reports two-pointer scale relative to the distance when the second finger landed (pass `null` to disable):

```avedon
<script>
  import { pinch, signal } from '@avedon/runtime'
  const scale = signal(1)
</script>
<template>
  <div use:pinch={(i) => scale.set(i.scale)}>{scale.get()}</div>
</template>
```

`tooltip` shows a lightweight tip on hover/focus (string or `{ content, delay }`; pass `null` to disable):

```avedon
<script>
  import { tooltip } from '@avedon/runtime'
</script>
<template>
  <button type="button" use:tooltip={'Save'}>Save</button>
</template>
```

`mutate` observes DOM mutations via `MutationObserver` (handler or options; `childList`/`subtree` default true):

```avedon
<script>
  import { mutate, signal } from '@avedon/runtime'
  const n = signal(0)
</script>
<template>
  <div use:mutate={() => n.update((v) => v + 1)}></div>
</template>
```

`sticky` reports when a `position: sticky` element is stuck (compares layout top to the CSS `top` offset on scroll/resize; pass `null` to disable):

```avedon
<script>
  import { sticky, signal } from '@avedon/runtime'
  const stuck = signal(false)
</script>
<template>
  <div style="position:sticky;top:0" use:sticky={(v) => stuck.set(v)}>Bar</div>
</template>
```

`drag` reports pointer drag `start` / `move` / `end` with deltas from the press point (pass `null` to disable):

```avedon
<script>
  import { drag, signal } from '@avedon/runtime'
  const delta = signal('0,0')
</script>
<template>
  <div use:drag={(i) => delta.set(`${i.dx},${i.dy}`)}>{delta.get()}</div>
</template>
```

`dropzone` accepts file drops (handler or `{ handler, onActive }`; pass `null` to disable):

```avedon
<script>
  import { dropzone, signal } from '@avedon/runtime'
  const names = signal('')
</script>
<template>
  <div use:dropzone={(files) => names.set(files.map((f) => f.name).join(','))}>Drop</div>
</template>
```

`focusTrap` keeps Tab focus inside the element (autofocuses the first control; pass `false` to pause):

```avedon
<script>
  import { focusTrap } from '@avedon/runtime'
</script>
<template>
  <div use:focusTrap role="dialog">
    <button type="button">OK</button>
  </div>
</template>
```

`lockScroll` locks `documentElement` / `body` overflow while active (refcount-safe; pass `false` to unlock):

```avedon
<script>
  import { lockScroll, signal } from '@avedon/runtime'
  const open = signal(true)
</script>
<template>
  <div use:lockScroll={open.get()} role="dialog">Modal</div>
</template>
```

`escapeKey` runs a handler when Escape is pressed (pass `null` to disable):

```avedon
<script>
  import { escapeKey, signal } from '@avedon/runtime'
  const open = signal(true)
</script>
<template>
  <div use:escapeKey={() => open.set(false)}>Dialog</div>
</template>
```

`inView` observes viewport intersection via `IntersectionObserver` (handler or `{ handler, once, root, rootMargin, threshold }`):

```avedon
<script>
  import { inView, signal } from '@avedon/runtime'
  const seen = signal(false)
</script>
<template>
  <div use:inView={(d) => seen.set(d.isIntersecting)}>Lazy</div>
</template>
```

`scrollIntoView` scrolls the element into view when the param is truthy (`true`, or `ScrollIntoViewOptions` with optional `when`; pass `false`/`null` to skip; re-enabling scrolls again):

```avedon
<script>
  import { scrollIntoView, signal } from '@avedon/runtime'
  const show = signal(false)
</script>
<template>
  <div use:scrollIntoView={show.get() ? { block: 'center' } : false}>…</div>
</template>
```

`infiniteScroll` calls `handler` when a scrollable element is near its bottom (`offset` default `200` px; set `disabled` while loading; pass `null` to disable):

```avedon
<script>
  import { infiniteScroll, signal } from '@avedon/runtime'
  const page = signal(1)
  const more = {
    offset: 80,
    handler: () => page.update((n) => n + 1),
  }
</script>
<template>
  <div style="overflow: auto; height: 240px" use:infiniteScroll={more}>…</div>
</template>
```

`reveal` toggles a CSS class when the element enters the viewport (default class `revealed`, `once` default true; pass `false`/`null` to disable):

```avedon
<script>
  import { reveal } from '@avedon/runtime'
</script>
<template>
  <div class="card" use:reveal>Hello</div>
</template>
```

`lazy` copies a deferred URL onto the element when it enters the viewport (default `data-src` → `src`; pass `false`/`null` to disable):

```avedon
<script>
  import { lazy } from '@avedon/runtime'
</script>
<template>
  <img data-src="/hero.jpg" alt="" use:lazy />
</template>
```

`scrollspy` watches section ids (or CSS selectors) and calls `handler` with the id that has the highest intersection ratio (pass `null` to disable):

```avedon
<script>
  import { scrollspy, signal } from '@avedon/runtime'
  const active = signal(null)
  const spy = {
    sections: ['intro', 'pricing'],
    handler: (id) => active.set(id),
  }
</script>
<template>
  <nav use:scrollspy={spy}>…</nav>
</template>
```

`hotkey` listens on `document` for a key (optional `ctrl` / `meta` / `alt` / `shift`; `preventDefault` defaults to true):

```avedon
<script>
  import { hotkey, signal } from '@avedon/runtime'
  const n = signal(0)
  const save = { key: 's', ctrl: true, handler: () => n.update((v) => v + 1) }
</script>
<template>
  <div use:hotkey={save}>…</div>
</template>
```

`keydown` is the same shape as `hotkey`, but listens on the element itself (focus the control first; pass `null` to disable):

```avedon
<script>
  import { keydown, signal } from '@avedon/runtime'
  const n = signal(0)
  const go = { key: 'Enter', handler: () => n.update((v) => v + 1) }
</script>
<template>
  <input use:keydown={go} />
</template>
```

`keyup` is the same as `keydown`, but fires on key release:

```avedon
<script>
  import { keyup, signal } from '@avedon/runtime'
  const n = signal(0)
  const go = { key: 'Enter', handler: () => n.update((v) => v + 1) }
</script>
<template>
  <input use:keyup={go} />
</template>
```

### `transition:` / `in:` / `out:` (`fade` / `fly` / `slide` / `scale` / `spin` / `pop` / `blur`)

Client-only (SSR renders at rest). Optional `duration` in milliseconds (default `200`). When `(prefers-reduced-motion: reduce)` matches, duration and delay are forced to `0` via runtime `transitionMs`.

- `transition:` — intro and outro
- `in:` — intro only
- `out:` — outro only (runs when the node leaves an `{#if}` / `{#each}` block, including keyed each)

```avedon
<template>
  {#if show}
    <div transition:fade>Hello</div>
    <p transition:fly={{ y: 16, duration: 80 }}>Quick</p>
    <section transition:slide={{ duration: 120 }}>Panel</section>
    <aside transition:slideX={{ duration: 120 }}>Drawer</aside>
    <span transition:scale={{ start: 0.8 }}>Pop</span>
    <span transition:spin={{ degrees: 90 }}>Twirl</span>
    <span transition:pop={{ start: 0.8, y: -8 }}>Pop</span>
    <span transition:bounce={{ start: 0.4 }}>Bounce</span>
    <span transition:drop={{ start: 0.9, y: -24 }}>Drop</span>
    <span transition:shake={{ x: 12 }}>Shake</span>
    <span transition:flip={{ degrees: 90 }}>Flip</span>
    <span transition:pulse={{ start: 1.2 }}>Pulse</span>
    <span transition:wipe={{ axis: 'left' }}>Wipe</span>
    <span transition:skew={{ x: 20 }}>Skew</span>
    <span transition:roll={{ degrees: 90 }}>Roll</span>
    <span transition:zoom={{ start: 0.5 }}>Zoom</span>
    <em transition:blur={{ amount: 8 }}>Soft</em>
    <svg viewBox="0 0 100 20">
      <path transition:draw={{ duration: 400 }} d="M0 10 H100" fill="none" stroke="currentColor" />
    </svg>
    <span in:fade>Enter only</span>
    <span out:fly={{ y: 12 }}>Leave only</span>
  {/if}
</template>
```

`fly` defaults to `y: 8` (and `x: 0`); both axes are overridable. `slide` animates `height` + opacity with `overflow: hidden` during the transition. `slideX` animates `width` + opacity the same way for horizontal panels. `scale` animates `transform: scale()` + opacity (`start` defaults to `0`). `spin` animates `transform: rotate()` + opacity (`degrees` defaults to `90`). `pop` animates `scale` + `translateY` + opacity (`start` defaults to `0.8`, `y` to `-8`, easing defaults to a slight overshoot curve). `bounce` animates `scale` + opacity with a springy bounce easing (`start` defaults to `0.3`, duration to `280`). `drop` animates `scale` + `translateY` + opacity settling from above (`start` defaults to `0.9`, `y` to `-24`, duration to `240`). `shake` animates `translateX` + opacity with a wobbly easing (`x` defaults to `12`, duration to `220`). `flip` animates `perspective` + `rotateY` + opacity (`degrees` defaults to `90`, `perspective` to `600`, duration to `280`). `pulse` animates an overscale settle + opacity (`start` defaults to `1.2`, duration to `260`, easing defaults to a slight overshoot). `wipe` animates `clip-path: inset()` (`axis` defaults to `left`; also `right` / `up` / `down`, duration to `240`). `skew` animates `skewX` / `skewY` + opacity (`x` defaults to `20`, `y` to `0`, duration to `220`). `roll` animates `perspective` + `rotateX` + opacity (`degrees` defaults to `90`, `perspective` to `600`, duration to `280`). `zoom` animates `scale` + opacity with a smooth ease-out (`start` defaults to `0.5`, duration to `240`). `blur` animates `filter: blur()` + opacity (`amount` defaults to `5` px). Other transitions are not supported yet.

### Spread attributes (`{...obj}`)

- **Elements:** `{...attrs}` copies enumerable own keys onto the DOM node (SSR + client). Values `null` / `undefined` / `false` omit the attribute; `true` emits a boolean attribute. Keys matching `/^on/i` or containing `:` are skipped (use `on:click`, `class:`, … explicitly).
- **Components:** `{...props}` merges into the props object in source order (`Object.assign`; later entries win). `children` / `slots` are applied last so spreads cannot clobber projection.

```avedon
<template>
  <button {...buttonProps}>Save</button>
  <Card label="x" {...extra} />
</template>
```

UI components are presentational: they cannot declare `<script server>` / `load` / `actions`. Keep server logic in the route page or layout. The Vite plugin auto-enables this guard for every `.ave` file that is **not** imported from `src/routes.ts` (plus `src/error.ave` / `src/not-found.ave`). Do not import route modules as UI components.

On the client, child components always `.mount()` (including during page hydrate). See [Hydration and client navigation](./rendering.md#hydration-and-client-navigation).

Not supported in v1 (fails at compile time with a clear message): `bind:` / `class:` / `style:` / `use:` / `transition:` / `in:` / `out:` on components, and transitions other than `fade` / `fly` / `slide` / `scale` / `blur` / `draw`.

## Isolation rule

Server script must not appear in the client bundle. Keep secrets and database access only under `<script server>`.

## See also

- [Loading data](./loading-data.md)
- [Reactivity](./reactivity.md)
- [Tutorial](./tutorial.md)
