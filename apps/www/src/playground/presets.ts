import type { PlaygroundPreset } from './types.js'

const btn =
  'cursor-pointer rounded-[0.3rem] border border-line bg-transparent px-3 py-[0.45rem] text-[0.9rem] font-semibold text-fg transition-[border-color,color] duration-150 hover:border-accent hover:text-accent'
const input =
  'rounded-[0.3rem] border border-line bg-transparent px-3 py-2 text-fg outline-none focus:border-accent'

export const playgroundPresets: PlaygroundPreset[] = [
  {
    id: 'counter',
    title: 'Counter',
    category: 'Basics',
    description: 'Signals and click handlers.',
    source: `<script lang="ts">
  import { signal } from '@avedon/runtime'
  const count = signal(0)
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="m-0 text-muted">Count: <span class="font-semibold text-fg tabular-nums">{count}</span></p>
    <button
      type="button"
      class="w-fit ${btn}"
      on:click={() => count = count + 1}
    >Increment</button>
  </div>
</template>`,
  },
  {
    id: 'todo',
    title: 'Todo list',
    category: 'Basics',
    description: 'Keyed each block with local state.',
    source: `<script lang="ts">
  import { signal } from '@avedon/runtime'

  type Todo = { id: number; text: string }
  const items = signal<Todo[]>([
    { id: 1, text: 'Learn signals' },
    { id: 2, text: 'Try the playground' },
  ])
  const draft = signal('')
  let nextId = 3

  function add() {
    const text = draft.trim()
    if (!text) return
    items = [...items, { id: nextId++, text }]
    draft = ''
  }
</script>

<template>
  <div class="flex flex-col gap-4">
    <form class="flex flex-wrap gap-2" on:submit|preventDefault={add}>
      <input
        class="min-w-[12rem] flex-1 ${input}"
        bind:value={draft}
        placeholder="New todo"
      />
      <button type="submit" class="${btn}">Add</button>
    </form>
    <ul class="m-0 flex list-none flex-col gap-2 p-0">
      {#each items as item (item.id)}
        <li class="rounded-[0.3rem] border border-line px-3 py-2 text-fg">{item.text}</li>
      {/each}
    </ul>
  </div>
</template>`,
  },
  {
    id: 'conditional',
    title: 'Conditional',
    category: 'Basics',
    description: 'if / else branches.',
    source: `<script lang="ts">
  import { signal } from '@avedon/runtime'
  const on = signal(true)
</script>

<template>
  <div class="flex flex-col gap-3">
    <button type="button" class="w-fit ${btn}" on:click={() => on = !on}>Toggle</button>
    {#if on}
      <p class="m-0 text-accent">Lights on</p>
    {:else}
      <p class="m-0 text-muted">Lights off</p>
    {/if}
  </div>
</template>`,
  },
  {
    id: 'bind-value',
    title: 'Two-way bind',
    category: 'Forms',
    description: 'bind:value on a text input.',
    source: `<script lang="ts">
  import { signal } from '@avedon/runtime'
  const name = signal('avedon')
</script>

<template>
  <div class="flex flex-col gap-3">
    <label class="flex flex-col gap-1 text-sm text-muted">
      Name
      <input class="${input}" bind:value={name} />
    </label>
    <p class="m-0 text-fg">Hello, {name}!</p>
  </div>
</template>`,
  },
  {
    id: 'checkbox-group',
    title: 'Checkbox group',
    category: 'Forms',
    description: 'bind:group with multiple checkboxes.',
    source: `<script lang="ts">
  import { signal } from '@avedon/runtime'
  const picks = signal<string[]>(['docs'])

  function label() {
    return picks.join(', ') || '(none)'
  }
</script>

<template>
  <div class="flex flex-col gap-3">
    <label class="flex items-center gap-2 text-fg"><input type="checkbox" bind:group={picks} value="docs" /> Docs</label>
    <label class="flex items-center gap-2 text-fg"><input type="checkbox" bind:group={picks} value="playground" /> Playground</label>
    <label class="flex items-center gap-2 text-fg"><input type="checkbox" bind:group={picks} value="github" /> GitHub</label>
    <p class="m-0 text-muted">Selected: <span class="text-fg">{label()}</span></p>
  </div>
</template>`,
  },
  {
    id: 'batch',
    title: 'batch()',
    category: 'Reactivity',
    description: 'Coalesce multiple signal writes.',
    source: `<script lang="ts">
  import { batch, signal } from '@avedon/runtime'
  const a = signal(0)
  const b = signal(0)
  const runs = signal(0)

  function bump() {
    batch(() => {
      a = a + 1
      b = b + 1
      runs = runs + 1
    })
  }
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="m-0 font-mono text-sm text-muted">a={a} b={b} runs={runs}</p>
    <button type="button" class="w-fit ${btn}" on:click={bump}>Batch bump</button>
  </div>
</template>`,
  },
  {
    id: 'class-directive',
    title: 'class:',
    category: 'Directives',
    description: 'Toggle classes from expressions.',
    source: `<script lang="ts">
  import { signal } from '@avedon/runtime'
  const active = signal(false)
</script>

<template>
  <button
    type="button"
    class="cursor-pointer rounded-[0.3rem] border border-line bg-transparent px-3 py-[0.45rem] text-[0.9rem] font-semibold text-fg transition-[border-color,color] duration-150"
    class:primary={active}
    on:click={() => active = !active}
  >
    {active ? 'Active' : 'Inactive'}
  </button>
</template>`,
  },
  {
    id: 'transition-fade',
    title: 'transition:fade',
    category: 'Directives',
    description: 'Fade intro/outro on if blocks.',
    source: `<script lang="ts">
  import { signal } from '@avedon/runtime'
  const show = signal(true)
</script>

<template>
  <div class="flex flex-col gap-3">
    <button type="button" class="w-fit ${btn}" on:click={() => show = !show}>Toggle</button>
    {#if show}
      <p class="m-0 text-accent" transition:fade>Fading content</p>
    {/if}
  </div>
</template>`,
  },
  {
    id: 'use-slugify',
    title: 'use:slugify',
    category: 'Directives',
    description: 'Slugify input on blur.',
    source: `<script lang="ts">
  import { signal, slugify } from '@avedon/runtime'
  const out = signal('')
  function onInput(e: Event) {
    out = (e.target as HTMLInputElement).value
  }
</script>

<template>
  <div class="flex flex-col gap-3">
    <input
      type="text"
      class="${input}"
      use:slugify
      placeholder="Hello World"
      on:input={onInput}
    />
    <p class="m-0 text-muted">{out}</p>
  </div>
</template>`,
  },
  {
    id: 'await-then',
    title: '{#await}',
    category: 'Reactivity',
    description: 'Pending UI with spinner, then settled content.',
    source: `<script lang="ts">
  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

  const promise = delay(1800).then(() => 'Configuration loaded')
</script>

<template>
  {#await promise}
    <div class="flex flex-col items-center gap-3 py-4" role="status" aria-label="Loading">
      <div
        class="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent"
        aria-hidden="true"
      ></div>
      <p class="m-0 text-sm text-muted">Fetching data…</p>
    </div>
  {:then value}
    <p class="m-0 text-accent">{value}</p>
  {/await}
</template>`,
  },
  {
    id: 'snake-case',
    title: 'use:snakeCase',
    category: 'Directives',
    description: 'Format text to snake_case on blur.',
    source: `<script lang="ts">
  import { signal, snakeCase } from '@avedon/runtime'
  const out = signal('')
  function onInput(e: Event) {
    out = (e.target as HTMLInputElement).value
  }
</script>

<template>
  <div class="flex flex-col gap-3">
    <input
      type="text"
      class="${input}"
      use:snakeCase
      placeholder="Hello World"
      on:input={onInput}
    />
    <p class="m-0 text-muted">{out}</p>
  </div>
</template>`,
  },
  {
    id: 'load-data',
    title: 'load() mock',
    category: 'Server',
    description: 'Server load() returns data to the page.',
    source: `<script lang="ts">
  export let data
</script>

<script server>
  export async function load() {
    return {
      data: {
        message: 'Hello from mock load()',
        items: ['Signals', 'Routes', 'Actions'],
      },
    }
  }
</script>

<template>
  <div class="flex flex-col gap-3">
    <h2 class="m-0 text-xl font-bold tracking-tight text-fg">{data.message}</h2>
    <ul class="m-0 flex list-disc flex-col gap-1 pl-5 text-muted">
      {#each data.items as item}
        <li class="text-fg">{item}</li>
      {/each}
    </ul>
  </div>
</template>`,
  },
  {
    id: 'form-action',
    title: 'actions mock',
    category: 'Server',
    description: 'Form action updates data via mock server.',
    source: `<script lang="ts">
  export let data
</script>

<script server>
  let count = 0

  export async function load() {
    return { data: { count } }
  }

  export const actions = {
    async increment() {
      count += 1
      return { data: { count } }
    },
  }
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="m-0 text-muted">Count: <span class="font-semibold text-fg tabular-nums">{data.count}</span></p>
    <form method="POST" action="?_action=increment">
      <button type="submit" class="${btn}">Increment (action)</button>
    </form>
  </div>
</template>`,
  },
]

export function getPreset(id: string): PlaygroundPreset | undefined {
  return playgroundPresets.find((p) => p.id === id)
}

export function resolvePresetSource(preset: PlaygroundPreset): string {
  return preset.source
}
