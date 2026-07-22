# Reactivity

Client interactivity in avedon uses `@avedon/runtime`: `signal`, `computed`, and `effect`.

## Signals

```avedon
<script>
  import { signal } from '@avedon/runtime'
  const count = signal(0)
</script>

<template>
  <button type="button" on:click={() => count.set(count.get() + 1)}>
    {count}
  </button>
</template>
```

- Read with `count.get()` or by interpolating `{count}` in the template
- Write with `count.set(next)`

## Computed and effect

```ts
import { signal, computed, effect } from '@avedon/runtime'

const count = signal(0)
const doubled = computed(() => count.get() * 2)

effect(() => {
  console.log('count is', count.get())
})
```

Use `effect` for side effects that should re-run when dependencies change. Prefer deriving UI with `computed` instead of duplicating state.

## Forms and navigation

`@avedon/runtime` installs client-side navigation for same-origin links after the first load. Forms that post to `actions` can be progressively enhanced by the runtime helpers.

## Rules of thumb

- Keep mutable UI state in signals on the client
- Keep secrets, DB access, and auth decisions in `<script server>` ([Loading data](./loading-data.md))
- Do not import server modules into the client script

## See also

- [Components](./components.md)
- [Tutorial](./tutorial.md)
