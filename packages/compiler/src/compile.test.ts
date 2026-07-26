import { describe, expect, it } from 'vitest'
import { compile, compileSsr, parse, scopeCss } from './index.js'

describe('parse', () => {
  it('splits client, server, style, markup', () => {
    const p = parse(`
<script lang="ts">
  let count = 0
  export let title
</script>
<script lang="ts" server>
  export async function load() { return { title: 'Hi' } }
</script>
<style>
  h1 { color: red; }
</style>
<h1>{title}</h1>
`)
    expect(p.clientScript).toContain('let count')
    expect(p.serverScript).toContain('export async function load')
    expect(p.style).toContain('h1')
    expect(p.markup).toContain('<h1>{title}</h1>')
  })
})

describe('compile', () => {
  it('generates client render and mount', () => {
    const { code, cssHash } = compile(
      `
<script lang="ts">
  export let title
  let count = 0
</script>
<style>h1 { font-weight: 600; }</style>
<h1>{title}</h1>
<button on:click={() => count++}>{count}</button>
`,
      { filename: 'Home.ave' },
    )
    expect(cssHash.startsWith('avedon-')).toBe(true)
    expect(code).toContain('export function render')
    expect(code).toContain('export function mount')
    expect(code).toContain('__escape(title)')
    expect(code).not.toContain('export async function load')
    // Arrow handlers must keep balanced braces (not truncate at first `}`)
    expect(code).toContain('() => count++')
    expect(code).toMatch(/addEventListener\("click"/)
    expect(code).toContain('typeof __handler === \'function\'')
    expect(code).not.toContain(' count++}>')
  })

  it('ssr generate includes server script and excludes mount', () => {
    const { code } = compileSsr(
      `
<script lang="ts">export let title</script>
<script lang="ts" server>
  export async function load() { return { title: 'X' } }
  export const api = { 'GET /api/x': async () => Response.json({ ok: true }) }
</script>
<p>{title}</p>
`,
      { filename: 'Page.ave' },
    )
    expect(code).toContain('export async function load')
    expect(code).toContain('GET /api/x')
    expect(code).toContain('export function render')
    expect(code).toContain('export function renderToStream')
    expect(code).toContain('export async function renderInto')
    expect(code).not.toContain('export function mount')
  }, 15_000)

  it('ssr stream emits OOO await boundaries', () => {
    const { code } = compileSsr(
      `
<script lang="ts">
  const p = Promise.resolve('x')
</script>
{#await p}{:then v}<span>{v}</span>{/await}
`,
      { filename: 'Await.ave' },
    )
    expect(code).toContain('__awaitBoundary')
    expect(code).toContain('Promise.resolve(p)')
    expect(code).toContain('createRenderStream')
  })

  it('compiles if and each', () => {
    const { code } = compile(
      `
<script lang="ts">
  let show = true
  let items = [1, 2]
</script>
{#if show}<span>yes</span>{:else}<span>no</span>{/if}
{#each items as item}<i>{item}</i>{/each}
`,
      { filename: 'List.ave' },
    )
    expect(code).toContain('show')
    expect(code).toContain('.map(')
  })

  it('compiles slot to children prop', () => {
    const { code } = compileSsr(
      `<div class="wrap"><slot /></div>`,
      { filename: 'Layout.ave' },
    )
    expect(code).toContain('__props.children')
    expect(code).toContain('__pipeChildren')
  })

  it('client slot accepts Node children without stringifying via innerHTML only', () => {
    const { code } = compile(
      `<script>export let children</script><template><div class="wrap"><slot /></div></template>`,
      { filename: 'Layout.ave' },
    )
    expect(code).toContain('instanceof Node')
    expect(code).toContain("createElement('template')")
    expect(code).toMatch(/trusted framework|trusted HTML|framework-produced/i)
  })

  it('emits unescaped html for {@html} on SSR and client', () => {
    const src = `<script>export let body</script><template><div class="prose">{@html body}</div></template>`
    const client = compile(src, { filename: 'Html.ave' })
    expect(client.code).toMatch(/innerHTML/)
    expect(client.code).toMatch(/\bbody\b/)
    expect(client.code).not.toMatch(/__escape\(body\)/)
    const ssr = compileSsr(src, { filename: 'Html.ave' })
    expect(ssr.code).toMatch(/\(body\)/)
    expect(ssr.code).not.toMatch(/__escape\(body\)/)
  })

  it('strips TypeScript from client script in client and SSR bundles', () => {
    const src = `
<script lang="ts">
  function greet(name: string): string {
    return name
  }
</script>
<template><p>{greet('hi')}</p></template>
`
    const client = compile(src, { filename: 'TsClient.ave' })
    expect(client.code).not.toMatch(/name:\s*string/)
    expect(client.code).not.toMatch(/\):\s*string/)
    expect(client.code).toMatch(/function greet\s*\(\s*name\s*\)/)

    const ssr = compileSsr(src, { filename: 'TsClient.ave' })
    expect(ssr.code).not.toMatch(/name:\s*string/)
    expect(ssr.code).toMatch(/function greet\s*\(\s*name\s*\)/)
  })

  it('nested if/each effects dispose previous nodes effect runners', () => {
    const { code } = compile(
      `<script>import { signal } from '@avedon/runtime'
const on = signal(true)
const items = signal([1,2])
</script>
<template>{#if on}{#each items as n}<span>{n}</span>{/each}{/if}</template>`,
      { filename: 'Nested.ave' },
    )
    expect(code).toContain('__blockEffects')
    expect(code).toMatch(/const __effects = __blockEffects/)
  })

  it('parses <template> and scoped style', () => {
    const p = parse(`
<script>let x = 1</script>
<style scoped>.t { color: red }</style>
<template><p>{x}</p></template>
`)
    expect(p.markup).toBe('<p>{x}</p>')
    expect(p.scoped).toBe(true)
  })

  it('physically excludes server script from client bundle (leak test)', () => {
    const secret = 'SUPER_SECRET_DB_PASSWORD_xyz_never_leak'
    const source = `
<script server>
  import { db } from '$lib/db';
  const password = "${secret}";
  export async function load() { return { title: db.get(password) } }
  export async function api_GET() { return Response.json({ ok: true }) }
</script>
<script>
  export let title
  import { signal } from '@avedon/runtime'
  const n = signal(0)
</script>
<template><h1>{title}</h1></template>
`
    const client = compile(source, { filename: 'Secret.ave' })
    expect(client.code).not.toContain(secret)
    expect(client.code).not.toContain('$lib/db')
    expect(client.code).not.toContain('api_GET')
    expect(client.code).not.toContain('export async function load')
    expect(client.code).not.toContain('SUPER_SECRET')

    const ssr = compileSsr(source, { filename: 'Secret.ave' })
    expect(ssr.code).toContain(secret)
    expect(ssr.code).toContain('api_GET')
    expect(ssr.code).toContain('const api =')
  })

  it('BUG-002: rejects dynamic HTML event attributes (use on:*)', () => {
    expect(() =>
      compile(`<img src="x" onerror={payload} />`, { filename: 'Xss.ave' }),
    ).toThrow(/on:error/)
    expect(() =>
      compileSsr(`<img src="x" onerror={payload} />`, { filename: 'Xss.ave' }),
    ).toThrow(/on:error/)
  })

  it('BUG-002: strips static HTML event attributes from SSR output', () => {
    const { code } = compileSsr(`<img src="x" onerror="alert(1)" />`, { filename: 'StaticOn.ave' })
    expect(code).not.toMatch(/onerror\s*=/)
  })

  it('BUG-003: client each/if insert preserves document order', () => {
    const { code } = compile(
      `{#each items as item}<i>{item}</i><b>x</b>{/each}`,
      { filename: 'EachOrder.ave' },
    )
    expect(code).toContain('let __insertBefore')
    expect(code).not.toMatch(
      /insertBefore\(__frag\.firstChild,\s*\w+\.nextSibling\)/,
    )
  })
})

describe('component composition', () => {
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
    expect(out.code).not.toContain('document.createElement("Card")')
  })

  it('throws when a PascalCase tag has no matching default import', () => {
    const src = `<template><Card /></template>`
    expect(() => compile(src, { filename: 'Home.ave', generate: 'ssr' })).toThrow(
      /Unknown component <Card>/,
    )
  })

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

  it('emits component render into the streaming SSR path', () => {
    const src = `<script>
  import Card from './Card.ave'
</script>
<template><Card label="hi"><i>c</i></Card></template>`
    const out = compile(src, { filename: 'Home.ave', generate: 'ssr' })
    expect(out.code).toMatch(/__enqueue\(Card\.render\(/)
  })

  it('aggregates imported component css into the parent css export (ssr)', () => {
    const src = `<script>
  import Card from './Card.ave'
</script>
<template><Card /></template>`
    const out = compile(src, { filename: 'Home.ave', generate: 'ssr' })
    expect(out.code).toContain("(Card.css || '')")
  })
})

describe('fail-closed syntax', () => {
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
    expect(() => compile(src, { filename: 'T.ave', generate: 'ssr' })).toThrow(
      /bind: is not supported on components/,
    )
  })

  it('still allows bind:value on native inputs and on:click on elements', () => {
    const src = `<template><input bind:value={name} /><button on:click={() => 1}>x</button></template>`
    expect(() => compile(src, { filename: 'T.ave', generate: 'ssr' })).not.toThrow()
  })
})

describe('asUiComponent', () => {
  const srcWithServer = `<script server>
  export function load() { return { data: {} } }
</script>
<template><p>x</p></template>`

  it('rejects <script server> when compiled as a UI component', () => {
    expect(() => compile(srcWithServer, { filename: 'Card.ave', asUiComponent: true })).toThrow(
      /UI components cannot have a <script server>/,
    )
    expect(() => compileSsr(srcWithServer, { filename: 'Card.ave', asUiComponent: true })).toThrow(
      /UI components cannot have a <script server>/,
    )
  })

  it('allows <script server> by default (route pages)', () => {
    expect(() => compile(srcWithServer, { filename: 'Page.ave' })).not.toThrow()
  })
})

describe('scopeCss', () => {
  it('BUG-005: scopes selectors inside @media', () => {
    const out = scopeCss('@media (min-width: 1px) { .card { color:red } }', 'avedon-x')
    expect(out).toContain('.card[avedon-x]')
    expect(out).toMatch(/@media \(min-width: 1px\)/)
  })

  it('scopes top-level selectors', () => {
    expect(scopeCss('h1 { color: red; }', 'avedon-y')).toContain('h1[avedon-y]')
  })
})
