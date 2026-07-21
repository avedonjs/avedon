import { describe, expect, it } from 'vitest'
import { compile, compileSsr, parse } from './index.js'

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
})
