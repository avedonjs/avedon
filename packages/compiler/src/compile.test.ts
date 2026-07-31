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

  it('await pending branch is kept until then', () => {
    const src = `<template>{#await p}<i data-pending>wait</i>{:then v}<b>{v}</b>{/await}</template>`
    const ssr = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(ssr.code).toContain('wait')
    const client = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(client.code).toContain('wait')
    expect(client.code).toContain("__avedonComment(")
    expect(client.code).toContain("'await'")
    expect(client.code).toMatch(/Promise\.resolve\(p\)\.then/)
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

  it('registers child component destroy on cleanups and if-block teardown', () => {
    const src = `<script>
  import Card from './Card.ave'
  let show = true
</script>
<template>{#if show}<Card /><div>x</div>{/if}</template>`
    const out = compile(src, { filename: 'Home.ave', generate: 'client' })
    expect(out.code).toContain('__cleanups.push(() => {')
    expect(out.code).toContain('.destroy();')
    expect(out.code).toContain('__blockCleanups')
    expect(out.code).toContain('__leavingCleanups')
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

  it('rewrites createEventDispatcher() to createEventDispatcher(__props)', () => {
    const src = `<script>
  import { createEventDispatcher } from '@avedon/runtime'
  const dispatch = createEventDispatcher()
</script>
<template><button type="button" on:click={() => dispatch('save')}>x</button></template>`
    const out = compile(src, { filename: 'Btn.ave', generate: 'client' })
    expect(out.code).toContain('createEventDispatcher(__props)')
    expect(out.code).not.toMatch(/createEventDispatcher\(\s*\)/)
  })

  it('wires onMount/onDestroy lifecycle around mount init', () => {
    const src = `<script>
  import { onMount, onDestroy } from '@avedon/runtime'
  onMount(() => {})
  onDestroy(() => {})
</script>
<template><p>x</p></template>`
    const out = compile(src, { filename: 'Life.ave', generate: 'client' })
    expect(out.code).toContain('__lifecycleBegin(__cleanups)')
    expect(out.code).toContain('__contextBegin')
    expect(out.code).toContain('__updateHooksBegin')
    expect(out.code).toContain('__lifecycleEnd()')
    expect(out.code).toContain('onMount(')
    expect(out.code).toContain('onDestroy(')
  })

  it('ssr render brackets context for setContext/getContext', () => {
    const src = `<script>
  import { setContext } from '@avedon/runtime'
  setContext('k', 1)
</script>
<template><p>x</p></template>`
    const out = compile(src, { filename: 'Ctx.ave', generate: 'ssr' })
    expect(out.code).toContain('__contextBegin')
    expect(out.code).toContain('__contextEnd()')
  })

  it('registers template effects with runtime effect() for signal tracking', () => {
    const src = `<script>
  import { signal } from '@avedon/runtime'
  const n = signal(0)
</script>
<template><p>{n}</p></template>`
    const out = compile(src, { filename: 'Sig.ave', generate: 'client' })
    expect(out.code).toContain('effect as __effect')
    expect(out.code).toContain('__cleanups.push(__effect(() => {')
    expect(out.code).toContain('__updateReady')
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
    ['bind scrollY', `<template><div bind:scrollY={y}>x</div></template>`, /Unsupported binding "bind:scrollY"/],
    ['transition unknown', `<template><div transition:wiggle>x</div></template>`, /Unsupported transition "transition:wiggle"/],
  ])('fails closed on %s', (_name, src, re) => {
    expect(() => compile(src, { filename: 'T.ave', generate: 'ssr' })).toThrow(re)
  })

  it('allows {...spread} on a component tag', () => {
    const src = `<script>
  import Card from './Card.ave'
</script>
<template><Card {...rest} /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain('Object.assign')
    expect(out.code).toContain('rest')
  })

  it('rejects malformed {@const}', () => {
    expect(() =>
      compile(`<template>{@const = 1}</template>`, { filename: 'T.ave', generate: 'ssr' }),
    ).toThrow(/Invalid \{@const\}/)
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

  it('rejects class: on a component tag', () => {
    const src = `<script>
  import Card from './Card.ave'
</script>
<template><Card class:active={on} /></template>`
    expect(() => compile(src, { filename: 'T.ave', generate: 'ssr' })).toThrow(
      /class: is not supported on components/,
    )
  })

  it('rejects style: on a component tag', () => {
    const src = `<script>
  import Card from './Card.ave'
</script>
<template><Card style:color={c} /></template>`
    expect(() => compile(src, { filename: 'T.ave', generate: 'ssr' })).toThrow(
      /style: is not supported on components/,
    )
  })

  it('rejects use: on a component tag', () => {
    const src = `<script>
  import Card from './Card.ave'
</script>
<template><Card use:focus /></template>`
    expect(() => compile(src, { filename: 'T.ave', generate: 'ssr' })).toThrow(
      /use: is not supported on components/,
    )
  })

  it('still allows bind:value on native inputs and on:click on elements', () => {
    const src = `<template><input bind:value={name} /><button on:click={() => 1}>x</button></template>`
    expect(() => compile(src, { filename: 'T.ave', generate: 'ssr' })).not.toThrow()
  })
})

describe('use: directive', () => {
  it('client mounts actions and registers cleanups', () => {
    const src = `<script>
  function tip(node) { node.dataset.tip = '1'; return () => {} }
</script>
<template><div use:tip>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('tip(')
    expect(out.code).toContain('__cleanups.push')
    expect(out.code).toContain('const __cleanups = []')
  })

  it('client passes parameters and supports update()', () => {
    const src = `<script>
  function tip(node, text) { return { update() {}, destroy() {} } }
</script>
<template><div use:tip={label}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('tip(')
    expect(out.code).toContain('(label)')
    expect(out.code).toContain('.update(')
  })

  it('ssr ignores use: (client-only)', () => {
    const src = `<template><div use:tip class="c">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('tip(')
    expect(out.code).toContain('class="c"')
  })
})

describe('bind:checked', () => {
  it('ssr emits a conditional checked attribute', () => {
    const src = `<template><input type="checkbox" bind:checked={on} /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain("' checked'")
    expect(out.code).toContain('(on)')
  })

  it('client syncs the checked property both ways', () => {
    const src = `<template><input type="checkbox" bind:checked={on} /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.checked = !!')
    expect(out.code).toContain("addEventListener('change'")
    expect(out.code).toMatch(/\.set\(|\.update\(/)
  })
})

describe('bind:this', () => {
  it('client assigns the element to the binding and clears on destroy', () => {
    const src = `<template><input bind:this={el} /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('el = ')
    expect(out.code).toContain('el = null')
    expect(out.code).toContain('__cleanups.push')
  })

  it('ssr ignores bind:this', () => {
    const src = `<template><input bind:this={el} class="x" /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('el =')
    expect(out.code).toContain('class="x"')
  })
})

describe('bind:group', () => {
  it('ssr checks the radio whose value matches the group', () => {
    const src = `<template><input type="radio" value="a" bind:group={choice} /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain("((choice) === \"a\" ? ' checked' : '')")
  })

  it('client syncs radio selection with the group binding', () => {
    const src = `<template><input type="radio" value="b" bind:group={choice} /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.checked = __v === "b"')
    expect(out.code).toContain('__b.update')
    expect(out.code).toContain("addEventListener('change'")
  })

  it('ssr checks checkboxes whose value is in the group array', () => {
    const src = `<template><input type="checkbox" value="x" bind:group={tags} /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain('Array.isArray(tags)')
    expect(out.code).toContain('.includes("x")')
  })

  it('client mutates the group array on checkbox change', () => {
    const src = `<template><input type="checkbox" value="y" bind:group={tags} /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.includes("y")')
    expect(out.code).toContain('.concat([')
    expect(out.code).toContain('.filter(')
  })
})

describe('transition:fade', () => {
  it('client emits an opacity intro animation', () => {
    const src = `<template><div transition:fade>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain("style.opacity = '0'")
    expect(out.code).toContain("style.opacity = '1'")
    expect(out.code).toContain('requestAnimationFrame')
    expect(out.code).toContain('__transitionMs')
  })

  it('accepts a duration option expression', () => {
    const src = `<template><div transition:fade={{ duration: 50 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('duration')
    expect(out.code).toContain('50')
  })

  it('honours delay option in CSS transition timing', () => {
    const src = `<template><div transition:fade={{ delay: 80, duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('__delay')
    expect(out.code).toContain('80')
    expect(out.code).toContain("+ __delay + 'ms'")
  })

  it('honours easing option in CSS transition timing', () => {
    const src = `<template><div transition:fade={{ easing: 'linear', duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('__ease')
    expect(out.code).toContain('easing')
    expect(out.code).toContain("+ __ease +")
  })

  it('ssr ignores transition:fade', () => {
    const src = `<template><div transition:fade class="c">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('requestAnimationFrame')
    expect(out.code).toContain('class="c"')
  })

  it('registers an outro and if-blocks run it before remove', () => {
    const src = `<template>{#if on}<p transition:fade={{ duration: 40 }}>x</p>{/if}</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('__avedonOutro')
    expect(out.code).toContain('__runOutro')
  })

  it('keyed each outros leaving records', () => {
    const src = `<template>{#each items as item (item.id)}<li transition:fade={{ duration: 30 }}>{item.id}</li>{/each}</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain("__avedonComment(")
    expect(out.code).toContain("'each-keyed'")
    expect(out.code).toContain('__leaving')
    expect(out.code).toContain('__runOutro')
  })
})

describe('transition:fly', () => {
  it('client emits translate + opacity intro/outro', () => {
    const src = `<template><div transition:fly={{ y: 12, duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('translate(')
    expect(out.code).toContain('__avedonOutro')
    expect(out.code).toContain('12')
  })

  it('ssr ignores transition:fly', () => {
    const src = `<template><div transition:fly class="c">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('translate')
    expect(out.code).toContain('class="c"')
  })
})

describe('in:/out: transitions', () => {
  it('in:fade emits intro without outro assignment', () => {
    const src = `<template><div in:fade={{ duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('requestAnimationFrame')
    expect(out.code).not.toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('out:fly emits outro without intro rAF', () => {
    const src = `<template><div out:fly={{ y: 10 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toMatch(/__avedonOutro\s*=\s*\(/)
    expect(out.code).toContain('translate(')
    expect(out.code).not.toContain('requestAnimationFrame')
  })

  it('rejects unknown in: transitions', () => {
    expect(() =>
      compile(`<template><div in:crossfade>x</div></template>`, { filename: 'T.ave', generate: 'client' }),
    ).toThrow(/Unsupported transition/)
  })
})

describe('transition:slide', () => {
  it('client emits height intro/outro', () => {
    const src = `<template><div transition:slide={{ duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('scrollHeight')
    expect(out.code).toContain("style.height")
    expect(out.code).toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('in:slide emits intro without outro assignment', () => {
    const src = `<template><div in:slide>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('scrollHeight')
    expect(out.code).not.toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('ssr ignores transition:slide', () => {
    const src = `<template><div transition:slide class="c">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('scrollHeight')
    expect(out.code).toContain('class="c"')
  })
})

describe('transition:slideX', () => {
  it('client emits width intro/outro', () => {
    const src = `<template><div transition:slideX={{ duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('scrollWidth')
    expect(out.code).toContain('style.width')
    expect(out.code).toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('in:slideX emits intro without outro assignment', () => {
    const src = `<template><div in:slideX>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('scrollWidth')
    expect(out.code).not.toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('ssr ignores transition:slideX', () => {
    const src = `<template><div transition:slideX class="c">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('scrollWidth')
    expect(out.code).toContain('class="c"')
  })
})

describe('transition:scale', () => {
  it('client emits scale + opacity intro/outro', () => {
    const src = `<template><div transition:scale={{ start: 0.5, duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('scale(')
    expect(out.code).toContain('0.5')
    expect(out.code).toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('in:scale emits intro without outro assignment', () => {
    const src = `<template><div in:scale>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('scale(')
    expect(out.code).not.toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('ssr ignores transition:scale', () => {
    const src = `<template><div transition:scale class="c">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('scale(')
    expect(out.code).toContain('class="c"')
  })
})

describe('transition:spin', () => {
  it('client emits rotate + opacity intro/outro', () => {
    const src = `<template><div transition:spin={{ degrees: 180, duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('rotate(')
    expect(out.code).toContain('180')
    expect(out.code).toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('in:spin emits intro without outro assignment', () => {
    const src = `<template><div in:spin>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('rotate(')
    expect(out.code).not.toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('ssr ignores transition:spin', () => {
    const src = `<template><div transition:spin class="c">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('rotate(')
    expect(out.code).toContain('class="c"')
  })
})

describe('transition:pop', () => {
  it('client emits scale + translateY + opacity intro/outro', () => {
    const src = `<template><div transition:pop={{ start: 0.5, y: -12, duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('scale(')
    expect(out.code).toContain('translateY(')
    expect(out.code).toContain('0.5')
    expect(out.code).toContain('-12')
    expect(out.code).toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('in:pop emits intro without outro assignment', () => {
    const src = `<template><div in:pop>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('translateY(')
    expect(out.code).not.toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('ssr ignores transition:pop', () => {
    const src = `<template><div transition:pop class="c">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('translateY(')
    expect(out.code).toContain('class="c"')
  })
})

describe('transition:bounce', () => {
  it('client emits scale + opacity intro/outro with bounce easing', () => {
    const src = `<template><div transition:bounce={{ start: 0.4, duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('scale(')
    expect(out.code).toContain('0.4')
    expect(out.code).toContain('cubic-bezier(0.68, -0.55, 0.265, 1.55)')
    expect(out.code).not.toContain('translateY(')
    expect(out.code).toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('in:bounce emits intro without outro assignment', () => {
    const src = `<template><div in:bounce>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('scale(')
    expect(out.code).toContain('cubic-bezier(0.68, -0.55, 0.265, 1.55)')
    expect(out.code).not.toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('ssr ignores transition:bounce', () => {
    const src = `<template><div transition:bounce class="c">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('scale(')
    expect(out.code).toContain('class="c"')
  })
})

describe('transition:drop', () => {
  it('client emits scale + translateY + opacity intro/outro', () => {
    const src = `<template><div transition:drop={{ start: 0.85, y: -30, duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('scale(')
    expect(out.code).toContain('translateY(')
    expect(out.code).toContain('0.85')
    expect(out.code).toContain('-30')
    expect(out.code).toContain('cubic-bezier(0.22, 1, 0.36, 1)')
    expect(out.code).toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('in:drop emits intro without outro assignment', () => {
    const src = `<template><div in:drop>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('translateY(')
    expect(out.code).not.toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('ssr ignores transition:drop', () => {
    const src = `<template><div transition:drop class="c">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('translateY(')
    expect(out.code).toContain('class="c"')
  })
})

describe('transition:shake', () => {
  it('client emits translateX + opacity intro/outro', () => {
    const src = `<template><div transition:shake={{ x: 16, duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('translateX(')
    expect(out.code).toContain('16')
    expect(out.code).toContain('cubic-bezier(0.36, 0.07, 0.19, 0.97)')
    expect(out.code).toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('in:shake emits intro without outro assignment', () => {
    const src = `<template><div in:shake>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('translateX(')
    expect(out.code).not.toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('ssr ignores transition:shake', () => {
    const src = `<template><div transition:shake class="c">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('translateX(')
    expect(out.code).toContain('class="c"')
  })
})

describe('transition:flip', () => {
  it('client emits rotateY + opacity intro/outro', () => {
    const src = `<template><div transition:flip={{ degrees: 120, perspective: 800, duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('rotateY(')
    expect(out.code).toContain('perspective(')
    expect(out.code).toContain('120')
    expect(out.code).toContain('800')
    expect(out.code).toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('in:flip emits intro without outro assignment', () => {
    const src = `<template><div in:flip>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('rotateY(')
    expect(out.code).not.toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('ssr ignores transition:flip', () => {
    const src = `<template><div transition:flip class="c">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('rotateY(')
    expect(out.code).toContain('class="c"')
  })
})

describe('transition:pulse', () => {
  it('client emits overscale + opacity intro/outro', () => {
    const src = `<template><div transition:pulse={{ start: 1.35, duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('scale(')
    expect(out.code).toContain('1.35')
    expect(out.code).toContain('cubic-bezier(0.34, 1.56, 0.64, 1)')
    expect(out.code).toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('in:pulse emits intro without outro assignment', () => {
    const src = `<template><div in:pulse>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('scale(')
    expect(out.code).not.toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('ssr ignores transition:pulse', () => {
    const src = `<template><div transition:pulse class="c">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('scale(')
    expect(out.code).toContain('class="c"')
  })
})

describe('transition:wipe', () => {
  it('client emits clip-path intro/outro', () => {
    const src = `<template><div transition:wipe={{ axis: 'right', duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('clipPath')
    expect(out.code).toContain('inset(')
    expect(out.code).toContain('right')
    expect(out.code).toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('in:wipe emits intro without outro assignment', () => {
    const src = `<template><div in:wipe>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('clipPath')
    expect(out.code).not.toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('ssr ignores transition:wipe', () => {
    const src = `<template><div transition:wipe class="c">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('clipPath')
    expect(out.code).toContain('class="c"')
  })
})

describe('transition:skew', () => {
  it('client emits skewX/Y + opacity intro/outro', () => {
    const src = `<template><div transition:skew={{ x: 25, y: 5, duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('skewX(')
    expect(out.code).toContain('skewY(')
    expect(out.code).toContain('25')
    expect(out.code).toContain('5')
    expect(out.code).toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('in:skew emits intro without outro assignment', () => {
    const src = `<template><div in:skew>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('skewX(')
    expect(out.code).not.toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('ssr ignores transition:skew', () => {
    const src = `<template><div transition:skew class="c">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('skewX(')
    expect(out.code).toContain('class="c"')
  })
})

describe('transition:roll', () => {
  it('client emits rotateX + opacity intro/outro', () => {
    const src = `<template><div transition:roll={{ degrees: 120, perspective: 800, duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('rotateX(')
    expect(out.code).toContain('perspective(')
    expect(out.code).toContain('120')
    expect(out.code).toContain('800')
    expect(out.code).toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('in:roll emits intro without outro assignment', () => {
    const src = `<template><div in:roll>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('rotateX(')
    expect(out.code).not.toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('ssr ignores transition:roll', () => {
    const src = `<template><div transition:roll class="c">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('rotateX(')
    expect(out.code).toContain('class="c"')
  })
})

describe('transition:zoom', () => {
  it('client emits scale + opacity intro/outro with zoom easing', () => {
    const src = `<template><div transition:zoom={{ start: 0.4, duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('scale(')
    expect(out.code).toContain('0.4')
    expect(out.code).toContain('cubic-bezier(0.16, 1, 0.3, 1)')
    expect(out.code).toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('in:zoom emits intro without outro assignment', () => {
    const src = `<template><div in:zoom>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('scale(')
    expect(out.code).not.toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('ssr ignores transition:zoom', () => {
    const src = `<template><div transition:zoom class="c">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('scale(')
    expect(out.code).toContain('class="c"')
  })
})

describe('transition:blur', () => {
  it('client emits filter blur + opacity intro/outro', () => {
    const src = `<template><div transition:blur={{ amount: 8, duration: 40 }}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('blur(')
    expect(out.code).toContain('8')
    expect(out.code).toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('in:blur emits intro without outro assignment', () => {
    const src = `<template><div in:blur>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('blur(')
    expect(out.code).not.toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('ssr ignores transition:blur', () => {
    const src = `<template><div transition:blur class="c">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('blur(')
    expect(out.code).toContain('class="c"')
  })
})

describe('svg createElementNS', () => {
  it('client creates svg/path with createElementNS', () => {
    const src = `<template><svg viewBox="0 0 10 10"><path d="M0 0 L10 10" /></svg></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('__avedonEl')
    expect(out.code).toMatch(/www\.w3\.org/)
    expect(out.code).toMatch(/__avedonEl\([^,]+,\s*["']svg["']/)
    expect(out.code).toMatch(/__avedonEl\([^,]+,\s*["']path["']/)
    expect(out.code).not.toMatch(/__avedonEl\([^,]+,\s*["']path["'],\s*null\)/)
  })

  it('client keeps HTML tags on createElement', () => {
    const src = `<template><div><span>x</span></div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toMatch(/__avedonEl\([^,]+,\s*["']div["'],\s*null\)/)
    expect(out.code).not.toMatch(/www\.w3\.org\/2000\/svg/)
  })

  it('HTML <title> stays on createElement; SVG <title> uses NS', () => {
    const html = compile(`<template><title>Doc</title></template>`, {
      filename: 'T.ave',
      generate: 'client',
    })
    expect(html.code).toMatch(/__avedonEl\([^,]+,\s*["']title["'],\s*null\)/)
    expect(html.code).not.toMatch(/__avedonEl\([^,]+,\s*["']title["'],\s*["']http/)

    const svg = compile(`<template><svg><title>Tip</title></svg></template>`, {
      filename: 'T.ave',
      generate: 'client',
    })
    expect(svg.code).toMatch(/__avedonEl\([^,]+,\s*["']title["'],\s*["']http/)
  })
})

describe('transition:draw', () => {
  it('client emits stroke-dashoffset intro/outro', () => {
    const src = `<template><svg><path transition:draw={{ duration: 40 }} d="M0 0 L10 0" /></svg></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('getTotalLength')
    expect(out.code).toContain('strokeDashoffset')
    expect(out.code).toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('in:draw emits intro without outro assignment', () => {
    const src = `<template><svg><path in:draw d="M0 0 L10 0" /></svg></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('getTotalLength')
    expect(out.code).not.toMatch(/__avedonOutro\s*=\s*\(/)
  })

  it('ssr ignores transition:draw', () => {
    const src = `<template><svg><path transition:draw d="M0 0 L10 0" class="c" /></svg></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('getTotalLength')
    expect(out.code).toContain('class="c"')
  })
})

describe('spread attributes', () => {
  it('ssr emits escaped attrs from {...obj}', () => {
    const src = `<template><div {...attrs}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain('attrs')
    expect(out.code).toContain('Object.keys')
    expect(out.code).toContain('__escape')
  })

  it('client applies spread attrs reactively', () => {
    const src = `<template><div {...attrs}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('setAttribute')
    expect(out.code).toContain('removeAttribute')
    expect(out.code).toContain('__spreadKeys')
  })

  it('rejects event keys from spreading into HTML handlers at runtime filter', () => {
    const src = `<template><div {...attrs}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toMatch(/\^on/i)
  })

  it('ssr merges component {...props} via Object.assign', () => {
    const src = `<script>
  import Card from './Card.ave'
</script>
<template><Card label="x" {...extra} title={t} /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain('Object.assign')
    expect(out.code).toContain('extra')
    expect(out.code).toContain('"label"')
    expect(out.code).toContain('"title"')
  })

  it('client mounts component with spread props and updates them', () => {
    const src = `<script>
  import Card from './Card.ave'
</script>
<template><Card {...extra} /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('Card.mount(')
    expect(out.code).toContain('Object.assign')
    expect(out.code).toContain('.update(')
  })
})

describe('signal assignment syntax', () => {
  it('rewrites signal assignment in template event handlers', () => {
    const src = `<script lang="ts">
  import { signal } from '@avedon/runtime'
  const active = signal(false)
</script>
<template>
  <button type="button" class:primary={active} on:click={() => active = !active}>
    {active ? 'Active' : 'Inactive'}
  </button>
</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('active.set(!active.get())')
    expect(out.code).toContain('active.get() ?')
  })
})

describe('class: directive', () => {
  it('ssr toggles class names from expressions and merges with static class', () => {
    const src = `<template><div class="card" class:active={on} class:busy={busy}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain('"card"')
    expect(out.code).toContain('"active"')
    expect(out.code).toContain('"busy"')
    expect(out.code).toMatch(/filter\(Boolean\)\.join/)
  })

  it('supports class:name shorthand for a matching identifier', () => {
    const src = `<template><div class:active>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain('(active)')
    expect(out.code).toContain('"active"')
  })

  it('client toggles classes reactively via className effect', () => {
    const src = `<template><div class="base" class:on={flag}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.className =')
    expect(out.code).toContain('"on"')
    expect(out.code).toContain('"base"')
  })
})

describe('style: directive', () => {
  it('ssr merges style: properties with a static style attribute', () => {
    const src = `<template><div style="display:block" style:color={c} style:font-size={size}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain('"display:block"')
    expect(out.code).toContain('"color:"')
    expect(out.code).toContain('"font-size:"')
  })

  it('supports style:name shorthand for a matching identifier', () => {
    const src = `<template><div style:color>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain('(color)')
    expect(out.code).toContain('"color:"')
  })

  it('client updates style.cssText reactively', () => {
    const src = `<template><div style:opacity={op}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.style.cssText =')
    expect(out.code).toContain('"opacity:"')
  })

  it('supports CSS custom properties via style:--name', () => {
    const src = `<template><div style:--accent={c}>x</div></template>`
    const ssr = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(ssr.code).toContain('"--accent:"')
    const client = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(client.code).toContain('"--accent:"')
    expect(client.code).toContain('.style.cssText =')
  })
})

describe('{:else if}', () => {
  it('ssr nests else-if as chained ternaries', () => {
    const src = `<template>{#if a}A{:else if b}B{:else}C{/if}</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain('(a)')
    expect(out.code).toContain('(b)')
    expect(out.code).toMatch(/A/)
    expect(out.code).toMatch(/B/)
    expect(out.code).toMatch(/C/)
  })

  it('client flattens else-if into a single if / else if / else', () => {
    const src = `<template>{#if a}A{:else if b}B{:else}C{/if}</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('if (a)')
    expect(out.code).toContain('else if (b)')
    expect(out.code).toMatch(/else \{/)
    // One if-block comment — nested if tokens must not emit a second block.
    expect(out.code.match(/__avedonComment\([^,]+,\s*'if'\)/g)?.length).toBe(1)
  })
})

describe('{@const}', () => {
  it('SSR scopes a const over following siblings', () => {
    const src = `<template>{#each xs as x}{@const y = x * 2}<b>{y}</b>{/each}</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain('((y) =>')
    expect(out.code).toContain('x * 2')
    expect(out.code).toContain('__escape(y)')
  })

  it('client declares const before following siblings', () => {
    const src = `<template>{@const label = 'hi'}<span>{label}</span></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain("const label = ('hi')")
    expect(out.code).toMatch(/String\(label/)
  })
})

describe('snippets', () => {
  it('SSR inlines a parameterized snippet at each render site', () => {
    const src = `<template>{#snippet row(item)}<li>{item}</li>{/snippet}<ul>{@render row('a')}{@render row('b')}</ul></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain('((item) =>')
    expect(out.code).toContain("__escape(item)")
    expect(out.code).toContain("'a'")
    expect(out.code).toContain("'b'")
    expect(out.code).not.toContain('{#snippet')
  })

  it('client inlines snippet bodies with parameters', () => {
    const src = `<template>{#snippet row(item)}<li>{item}</li>{/snippet}<ul>{@render row(x)}</ul></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('((item) =>')
    expect(out.code).toMatch(/__avedonEl\([^,]+,\s*["']li["']/)
    expect(out.code).toMatch(/String\(item/)
  })

  it('rejects unknown snippet render', () => {
    expect(() =>
      compile(`<template>{@render missing()}</template>`, { filename: 'T.ave', generate: 'ssr' }),
    ).toThrow(/Unknown snippet/)
  })

  it('rejects nested snippet definitions', () => {
    expect(() =>
      compile(`<template>{#if ok}{#snippet inner}<i></i>{/snippet}{/if}</template>`, {
        filename: 'T.ave',
        generate: 'ssr',
      }),
    ).toThrow(/template root/)
  })

  it('rejects duplicate snippet names', () => {
    expect(() =>
      compile(
        `<template>{#snippet a}<a></a>{/snippet}{#snippet a}<b></b>{/snippet}</template>`,
        { filename: 'T.ave', generate: 'ssr' },
      ),
    ).toThrow(/Duplicate snippet/)
  })

  it('rejects render arity mismatch', () => {
    expect(() =>
      compile(`<template>{#snippet a(x)}<i>{x}</i>{/snippet}{@render a()}</template>`, {
        filename: 'T.ave',
        generate: 'ssr',
      }),
    ).toThrow(/expects 1 argument/)
  })
})

describe('event modifiers', () => {
  it('client emits preventDefault and stopPropagation', () => {
    const src = `<template><form on:submit|preventDefault|stopPropagation={save}>x</form></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('addEventListener("submit"')
    expect(out.code).toContain('event.preventDefault()')
    expect(out.code).toContain('event.stopPropagation()')
  })

  it('supports once and self', () => {
    const src = `<template><div on:click|once|self={fn}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('once: true')
    expect(out.code).toContain('event.target !== event.currentTarget')
  })

  it('allows modifier-only handlers', () => {
    const src = `<template><form on:submit|preventDefault>x</form></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('event.preventDefault()')
    expect(out.code).toContain('addEventListener("submit"')
  })

  it('emits stopImmediatePropagation and passive', () => {
    const src = `<template><div on:click|stopImmediatePropagation|passive={fn}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('event.stopImmediatePropagation()')
    expect(out.code).toContain('passive: true')
    expect(out.code).not.toContain('event.stopPropagation()')
  })

  it('emits nonpassive as passive: false', () => {
    const src = `<template><div on:wheel|nonpassive={fn}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('passive: false')
    expect(out.code).toContain('addEventListener("wheel"')
  })

  it('rejects passive and nonpassive together', () => {
    expect(() =>
      compile(`<template><div on:wheel|passive|nonpassive={fn}>x</div></template>`, {
        filename: 'T.ave',
        generate: 'client',
      }),
    ).toThrow(/passive.*nonpassive|nonpassive.*passive/)
  })

  it('rejects unknown modifiers', () => {
    expect(() =>
      compile(`<template><button on:click|nope={fn}>x</button></template>`, {
        filename: 'T.ave',
        generate: 'client',
      }),
    ).toThrow(/Unknown event modifier "nope"/)
  })
})

describe('HTML comments', () => {
  it('strips comments from SSR output', () => {
    const src = `<template><!-- greeting --><b>x</b><!-- end --></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('greeting')
    expect(out.code).not.toContain('<!--')
    expect(out.code).toContain('x')
  })

  it('strips comments from client build', () => {
    const src = `<template><!-- skip --><span>ok</span></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).not.toContain('skip')
    expect(out.code).toContain('ok')
    expect(out.code).toMatch(/__avedonEl\([^,]+,\s*["']span["']/)
  })

  it('rejects unclosed comments', () => {
    expect(() =>
      compile(`<template><!-- oops</template>`, { filename: 'T.ave', generate: 'ssr' }),
    ).toThrow(/Unclosed HTML comment/)
  })
})

describe('{#await} then/catch shorthand', () => {
  it('parses {#await p then v} as the then branch', () => {
    const src = `<template>{#await p then v}<b>{v}</b>{/await}</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('Promise.resolve(p).then((v)')
    expect(out.code).toContain('__escape') // via String(v) in client
    expect(out.code).toMatch(/String\(v/)
  })

  it('parses {#await p catch e} as the catch branch', () => {
    const src = `<template>{#await p catch e}<i>{e}</i>{/await}</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('Promise.resolve(p).then')
    expect(out.code).toMatch(/\(e\)\s*=>/)
    expect(out.code).toMatch(/String\(e/)
  })

  it('allows {:catch} after then-shorthand', () => {
    const src = `<template>{#await p then v}<b>{v}</b>{:catch e}<i>{e}</i>{/await}</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.then((v)')
    expect(out.code).toMatch(/\(e\)\s*=>/)
  })
})

describe('boolean attributes', () => {
  it('SSR omits falsy disabled', () => {
    const src = `<template><button disabled={on}>x</button></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain("? ' disabled'")
    expect(out.code).toContain('(on)')
    expect(out.code).not.toMatch(/disabled="\` \+ __escape\(on\)/)
  })

  it('client toggles the disabled property', () => {
    const src = `<template><button disabled={on}>x</button></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.disabled = ')
    expect(out.code).toContain('!!(on)')
  })

  it('still stringifies non-boolean attrs', () => {
    const src = `<template><div title={t}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain('__escape(t)')
  })
})

describe('select bind:value', () => {
  it('SSR marks the matching option selected', () => {
    const src = `<template><select bind:value={choice}><option value="a">A</option><option value="b">B</option></select></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain('Object.is(choice')
    expect(out.code).toMatch(/\? ' selected'/)
  })

  it('client listens to change on select', () => {
    const src = `<template><select bind:value={choice}><option value="a">A</option></select></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('addEventListener("change"')
    expect(out.code).not.toMatch(/createElement\("select"\)[\s\S]*addEventListener\("input"/)
  })

  it('input still uses the input event', () => {
    const src = `<template><input bind:value={name} /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('addEventListener("input"')
  })
})

describe('numeric bind:value', () => {
  it('number input writes valueAsNumber (undefined when empty)', () => {
    const src = `<template><input type="number" bind:value={n} /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('valueAsNumber')
    expect(out.code).toContain('Number.isNaN')
    expect(out.code).toContain('undefined')
  })

  it('range input also uses numeric binding', () => {
    const src = `<template><input type="range" min="0" max="10" bind:value={n} /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('valueAsNumber')
  })

  it('plain text input still assigns string .value', () => {
    const src = `<template><input bind:value={name} /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).not.toContain('valueAsNumber')
    expect(out.code).toContain('__b.update')
  })
})

describe('multi-select bind:value', () => {
  it('SSR selects options via Array.includes / Object.is', () => {
    const src = `<template><select multiple bind:value={picked}><option value="a">A</option><option value="b">B</option></select></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain('Array.isArray(picked)')
    expect(out.code).toContain('Object.is')
    expect(out.code).toMatch(/\? ' selected'/)
  })

  it('client syncs selectedOptions to an array on change', () => {
    const src = `<template><select multiple bind:value={picked}><option value="a">A</option></select></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('selectedOptions')
    expect(out.code).toContain('addEventListener("change"')
    expect(out.code).toContain('.selected =')
  })
})

describe('bind:files', () => {
  it('client assigns input.files on change', () => {
    const src = `<template><input type="file" bind:files={picked} /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain("addEventListener('change'")
    expect(out.code).toContain('.files')
    expect(out.code).toContain('picked')
  })

  it('ssr ignores bind:files', () => {
    const src = `<template><input type="file" bind:files={picked} class="f" /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('picked')
    expect(out.code).toContain('class="f"')
  })
})

describe('dimension bindings', () => {
  it('client uses ResizeObserver for clientWidth', () => {
    const src = `<template><div bind:clientWidth={w}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('ResizeObserver')
    expect(out.code).toContain('.clientWidth')
    expect(out.code).toContain('(w)')
    expect(out.code).toMatch(/\.set\(|\.update\(/)
  })

  it('supports offsetHeight', () => {
    const src = `<template><div bind:offsetHeight={h}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.offsetHeight')
    expect(out.code).toContain('ResizeObserver')
  })

  it('ssr ignores dimension binds', () => {
    const src = `<template><div bind:clientWidth={w} class="box">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('clientWidth')
    expect(out.code).not.toContain('ResizeObserver')
    expect(out.code).toContain('class="box"')
  })
})

describe('scroll bindings', () => {
  it('client syncs scrollTop both ways', () => {
    const src = `<template><div bind:scrollTop={y}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.scrollTop')
    expect(out.code).toContain("addEventListener('scroll'")
    expect(out.code).toContain('passive: true')
  })

  it('supports scrollLeft', () => {
    const src = `<template><div bind:scrollLeft={x}>x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.scrollLeft')
  })

  it('ssr ignores scroll binds', () => {
    const src = `<template><div bind:scrollTop={y} class="sc">x</div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('scrollTop')
    expect(out.code).toContain('class="sc"')
  })
})

describe('selection bindings', () => {
  it('client syncs selectionStart both ways', () => {
    const src = `<template><input bind:selectionStart={s} /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.selectionStart')
    expect(out.code).toContain("addEventListener('select'")
    expect(out.code).toContain("addEventListener('keyup'")
  })

  it('supports selectionEnd', () => {
    const src = `<template><textarea bind:selectionEnd={e}></textarea></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.selectionEnd')
  })

  it('ssr ignores selection binds', () => {
    const src = `<template><input bind:selectionStart={s} class="t" /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('selectionStart')
    expect(out.code).toContain('class="t"')
  })
})

describe('bind:indeterminate', () => {
  it('client sets the indeterminate property', () => {
    const src = `<template><input type="checkbox" bind:indeterminate={mid} /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.indeterminate = !!')
    expect(out.code).toContain('(mid)')
  })

  it('ssr ignores bind:indeterminate', () => {
    const src = `<template><input type="checkbox" bind:indeterminate={mid} class="c" /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('indeterminate')
    expect(out.code).not.toContain('mid')
    expect(out.code).toContain('class="c"')
  })
})

describe('bind:open', () => {
  it('ssr emits open when truthy', () => {
    const src = `<template><details bind:open={show}><summary>x</summary></details></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain("' open'")
    expect(out.code).toContain('(show)')
  })

  it('client syncs open via toggle', () => {
    const src = `<template><details bind:open={show}><summary>x</summary></details></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.open = !!')
    expect(out.code).toContain('(show)')
    expect(out.code).toContain("addEventListener('toggle'")
  })
})

describe('media bindings', () => {
  it('client syncs muted via volumechange', () => {
    const src = `<template><audio bind:muted={m}></audio></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.muted = !!')
    expect(out.code).toContain('(m)')
    expect(out.code).toContain("addEventListener('volumechange'")
  })

  it('client syncs paused via play/pause', () => {
    const src = `<template><video bind:paused={p}></video></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.pause()')
    expect(out.code).toContain('.play()')
    expect(out.code).toContain("addEventListener('play'")
    expect(out.code).toContain("addEventListener('pause'")
  })

  it('client syncs volume and currentTime', () => {
    const src = `<template><audio bind:volume={vol} bind:currentTime={t}></audio></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.volume')
    expect(out.code).toContain('.currentTime')
    expect(out.code).toContain("addEventListener('timeupdate'")
  })

  it('client syncs playbackRate and duration', () => {
    const src = `<template><audio bind:playbackRate={rate} bind:duration={dur}></audio></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.playbackRate')
    expect(out.code).toContain("addEventListener('ratechange'")
    expect(out.code).toContain('.duration')
    expect(out.code).toContain("addEventListener('durationchange'")
  })

  it('client syncs ended and seeking from media events', () => {
    const src = `<template><audio bind:ended={done} bind:seeking={seek}></audio></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.ended')
    expect(out.code).toContain("addEventListener('ended'")
    expect(out.code).toContain('.seeking')
    expect(out.code).toContain("addEventListener('seeking'")
    expect(out.code).toContain("addEventListener('seeked'")
  })

  it('client syncs played and buffered from media TimeRanges', () => {
    const src = `<template><audio bind:played={p} bind:buffered={b}></audio></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.played')
    expect(out.code).toContain('.buffered')
    expect(out.code).toContain("addEventListener('timeupdate'")
    expect(out.code).toContain("addEventListener('progress'")
  })

  it('client syncs seekable from media TimeRanges', () => {
    const src = `<template><audio bind:seekable={s}></audio></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.seekable')
    expect(out.code).toContain("addEventListener('progress'")
    expect(out.code).toContain("addEventListener('durationchange'")
  })

  it('client syncs readyState from media events', () => {
    const src = `<template><audio bind:readyState={rs}></audio></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.readyState')
    expect(out.code).toContain("addEventListener('canplay'")
    expect(out.code).toContain("addEventListener('emptied'")
  })

  it('client syncs networkState from media events', () => {
    const src = `<template><audio bind:networkState={ns}></audio></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.networkState')
    expect(out.code).toContain("addEventListener('progress'")
    expect(out.code).toContain("addEventListener('stalled'")
  })

  it('ssr ignores muted/paused', () => {
    const src = `<template><audio bind:muted={m} bind:paused={p} class="a"></audio></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('muted')
    expect(out.code).not.toContain('paused')
    expect(out.code).toContain('class="a"')
  })

  it('ssr ignores ended/seeking', () => {
    const src = `<template><audio bind:ended={e} bind:seeking={s} class="a"></audio></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('ended')
    expect(out.code).not.toContain('seeking')
    expect(out.code).toContain('class="a"')
  })

  it('ssr ignores played/buffered', () => {
    const src = `<template><audio bind:played={p} bind:buffered={b} class="a"></audio></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('played')
    expect(out.code).not.toContain('buffered')
    expect(out.code).toContain('class="a"')
  })

  it('ssr ignores seekable', () => {
    const src = `<template><audio bind:seekable={s} class="a"></audio></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('seekable')
    expect(out.code).toContain('class="a"')
  })

  it('ssr ignores readyState', () => {
    const src = `<template><audio bind:readyState={rs} class="a"></audio></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('readyState')
    expect(out.code).toContain('class="a"')
  })

  it('ssr ignores networkState', () => {
    const src = `<template><audio bind:networkState={ns} class="a"></audio></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('networkState')
    expect(out.code).toContain('class="a"')
  })

  it('client syncs videoWidth and videoHeight', () => {
    const src = `<template><video bind:videoWidth={w} bind:videoHeight={h}></video></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.videoWidth')
    expect(out.code).toContain('.videoHeight')
    expect(out.code).toContain("addEventListener('loadedmetadata'")
    expect(out.code).toContain("addEventListener('resize'")
  })

  it('ssr ignores videoWidth/videoHeight', () => {
    const src = `<template><video bind:videoWidth={w} bind:videoHeight={h} class="v"></video></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('videoWidth')
    expect(out.code).not.toContain('videoHeight')
    expect(out.code).toContain('class="v"')
  })

  it('client syncs naturalWidth and naturalHeight on images', () => {
    const src = `<template><img bind:naturalWidth={w} bind:naturalHeight={h} /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.naturalWidth')
    expect(out.code).toContain('.naturalHeight')
    expect(out.code).toContain("addEventListener('load'")
  })

  it('ssr ignores naturalWidth/naturalHeight', () => {
    const src = `<template><img bind:naturalWidth={w} bind:naturalHeight={h} class="i" /></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('naturalWidth')
    expect(out.code).not.toContain('naturalHeight')
    expect(out.code).toContain('class="i"')
  })
})

describe('bind:textContent', () => {
  it('client syncs textContent on input', () => {
    const src = `<template><div contenteditable="true" bind:textContent={text}></div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.textContent')
    expect(out.code).toContain("addEventListener('input'")
  })

  it('ssr ignores bind:textContent', () => {
    const src = `<template><div contenteditable="true" bind:textContent={text} class="e"></div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('textContent')
    expect(out.code).toContain('class="e"')
  })
})

describe('bind:innerText', () => {
  it('client syncs innerText on input', () => {
    const src = `<template><div contenteditable="true" bind:innerText={text}></div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('.innerText')
    expect(out.code).toContain("addEventListener('input'")
  })

  it('ssr ignores bind:innerText', () => {
    const src = `<template><div contenteditable="true" bind:innerText={text} class="e"></div></template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).not.toContain('innerText')
    expect(out.code).toContain('class="e"')
  })
})

describe('{#each} {:else}', () => {
  it('SSR renders else when the list is empty', () => {
    const src = `<template>{#each items as item}<b>{item}</b>{:else}<i>empty</i>{/each}</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain('__list.length')
    expect(out.code).toContain('empty')
    expect(out.code).toContain('.map(')
  })

  it('client rebuilds else branch when the list is empty', () => {
    const src = `<template>{#each items as item}<b>{item}</b>{:else}<i>empty</i>{/each}</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('__list.length')
    expect(out.code).toContain('empty')
    expect(out.code).toContain("__avedonComment(")
    expect(out.code).toContain("'each'")
    expect(out.code).not.toContain("'each-keyed'")
  })

  it('works with keyed each', () => {
    const src = `<template>{#each items as item (item.id)}<b>{item.name}</b>{:else}<i>none</i>{/each}</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain("__avedonComment(")
    expect(out.code).toContain("'each-keyed'")
    expect(out.code).toContain('__list.length')
    expect(out.code).toContain('none')
  })
})

describe('{#key}', () => {
  it('SSR renders the body (key is client-only remount)', () => {
    const src = `<template>{#key id}<b>{label}</b>{/key}</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain('__escape(label)')
    expect(out.code).toContain('<!--key-->')
    expect(out.code).not.toMatch(/Unsupported \{#key\}/)
  })

  it('client remounts when the key expression changes', () => {
    const src = `<template>{#key id}<span>{label}</span>{/key}</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain("__avedonComment(")
    expect(out.code).toContain("'key'")
    expect(out.code).toContain('Object.is(__k, __prevKey)')
    expect(out.code).toMatch(/const __k = \(id\)/)
  })
})

describe('SSR claim anchors', () => {
  it('emits if / each / each-keyed / await comment anchors', () => {
    const ifSsr = compile(`<template>{#if on}<span>y</span>{/if}</template>`, {
      filename: 'T.ave',
      generate: 'ssr',
    })
    expect(ifSsr.code).toContain('<!--if-->')

    const eachSsr = compile(`<template>{#each items as item}<b>{item}</b>{/each}</template>`, {
      filename: 'T.ave',
      generate: 'ssr',
    })
    expect(eachSsr.code).toContain('<!--each-->')

    const keyed = compile(
      `<template>{#each items as item (item.id)}<b>{item.name}</b>{/each}</template>`,
      { filename: 'T.ave', generate: 'ssr' },
    )
    expect(keyed.code).toContain('<!--each-keyed-->')

    const awaitSsr = compile(
      `<template>{#await p}<i>wait</i>{:then v}<b>{v}</b>{/await}</template>`,
      { filename: 'T.ave', generate: 'ssr' },
    )
    expect(awaitSsr.code).toContain('<!--await-->')
  })

  it('BUG-301: separates adjacent text/expr so HTML parse keeps distinct text nodes', () => {
    const src = `<template>Hello {name}!</template>`
    const ssr = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(ssr.code).toContain('<!---->')
    expect(ssr.code).toMatch(/Hello[\s\S]*<!---->[\s\S]*__escape/)

    const client = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(client.code).toContain("__avedonComment(")
    expect(client.code).toMatch(/__avedonComment\([^,]+,\s*""\)/)
  })

  it('BUG-301: stream path also emits text separators', () => {
    const src = `<template>Hi {n}</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    // stream is on CompiledTemplate via generate ssr which includes both; check ssr expr has sep
    expect(out.code).toContain('<!---->')
  })

  it('BUG-305: escapes &, <, > in static SSR text for claim parity', () => {
    const out = compile(`<template><p>Hello &copy; a < b</p></template>`, {
      filename: 'T.ave',
      generate: 'ssr',
    })
    expect(out.code).toContain('&amp;copy;')
    expect(out.code).toContain('&lt;')
  })

  it('BUG-307: rejects attribute names that break out of quotes', () => {
    expect(() =>
      compile(`<template><div foo"bar="{x}></div></template>`, { filename: 'T.ave', generate: 'ssr' }),
    ).toThrow(/Invalid attribute name/)
  })
})

describe('keyed {#each}', () => {
  it('unwraps signal lists in client keyed each', () => {
    const src = `<script lang="ts">
  import { signal } from '@avedon/runtime'
  const items = signal([{ id: 1, name: 'a' }])
</script>
<template>{#each items as item (item.id)}<b>{item.name}</b>{/each}</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('const __list = ((items.get()) || [])')
  })

  it('SSR renders keyed each like a normal each block', () => {
    const src = `<template>{#each items as item (item.id)}<b>{item.name}</b>{/each}</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'ssr' })
    expect(out.code).toContain('.map((item) =>')
    expect(out.code).toContain('__escape(item.name)')
  })

  it('client reconciles records by key instead of rebuilding the whole list', () => {
    const src = `<template>{#each items as item, i (item.id)}<span>{i}:{item.name}</span>{/each}</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    expect(out.code).toContain('const __key = (item.id)')
    expect(out.code).toContain('new Map(__records.map')
    expect(out.code).toContain('__oldByKey.get(__key)')
    expect(out.code).toContain('insertBefore(n, __cursor)')
  })

  it('claim init trims each-item whitespace text tokens', () => {
    const src = `<template>{#each items as item (item.id)}
        <li>{item.name}</li>
      {/each}</template>`
    const out = compile(src, { filename: 'T.ave', generate: 'client' })
    const claimLoop = out.code.match(/if \(__skipOnce\) \{[\s\S]*?__records\.push/)?.[0] ?? ''
    expect(claimLoop).toContain('__list.forEach((item, __i) => {')
    expect(claimLoop).toContain('__avedonEl(__root')
    expect(claimLoop).not.toContain('__avedonText(__root')
  })
})

describe('named slots', () => {
  it('SSR passes named slot content via slots and keeps default children', () => {
    const src = `<script>
  import Card from './Card.ave'
</script>
<template>
  <Card>
    <h1 slot="header">Title</h1>
    <p>Body</p>
  </Card>
</template>`
    const out = compile(src, { filename: 'Home.ave', generate: 'ssr' })
    expect(out.code).toContain('slots:')
    expect(out.code).toContain('"header"')
    expect(out.code).toContain('Title')
    expect(out.code).toContain('children:')
    expect(out.code).toContain('Body')
  })

  it('SSR named <slot> reads slots[name] with fallback', () => {
    const src = `<template><slot name="footer">fallback</slot></template>`
    const out = compile(src, { filename: 'Card.ave', generate: 'ssr' })
    expect(out.code).toContain('__props.slots')
    expect(out.code).toContain('fallback')
  })

  it('client mounts named slots into the slots prop bag', () => {
    const src = `<script>
  import Card from './Card.ave'
</script>
<template>
  <Card>
    <span slot="header">H</span>
  </Card>
</template>`
    const out = compile(src, { filename: 'Home.ave', generate: 'client' })
    expect(out.code).toContain('slots:')
    expect(out.code).toContain('"header"')
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

  it('does not scope selectors inside @keyframes', () => {
    const out = scopeCss(
      '.spinner { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }',
      'avedon-z',
    )
    expect(out).toContain('.spinner[avedon-z]')
    expect(out).toContain('@keyframes spin')
    expect(out).toContain('to { transform: rotate(360deg); }')
    expect(out).not.toContain('to[avedon-z]')
  })

  it('does not scope selectors inside @font-face', () => {
    const out = scopeCss(
      '@font-face { font-family: X; src: url(x.woff2); } .t { color: red; }',
      'avedon-f',
    )
    expect(out).toContain('@font-face { font-family: X; src: url(x.woff2); }')
    expect(out).toContain('.t[avedon-f]')
  })

  it('keeps :is() commas intact and scopes before ::pseudo-elements', () => {
    const out = scopeCss('.x:is(.a, .b)::before { content: ""; }', 'avedon-p')
    expect(out).toContain('.x:is(.a, .b)[avedon-p]::before')
    expect(out).not.toContain('.a[avedon-p]')
  })

  it('leaves :global(...) selectors unscoped', () => {
    const out = scopeCss(':global(.external) { color: red; } .local { color: blue; }', 'avedon-g')
    expect(out).toContain('.external {')
    expect(out).not.toContain('.external[avedon-g]')
    expect(out).toContain('.local[avedon-g]')
  })
})

describe('audit regressions 2026-07-29', () => {
  it('SSR unwraps signal text and boolean conditions', () => {
    const src = `<script lang="ts">
  import { signal } from '@avedon/runtime'
  const n = signal(1)
  const show = signal(false)
</script>
<template>{#if show}<p>{n}</p>{/if}</template>`
    const out = compileSsr(src, { filename: 'SigSsr.ave' })
    expect(out.code).toContain('show.get()')
    expect(out.code).toContain('n.get()')
  })

  it('parses object literals inside mustache expressions', () => {
    const src = `<template><pre>{JSON.stringify({ a: 1 })}</pre></template>`
    const out = compile(src, { filename: 'Obj.ave', generate: 'client' })
    expect(out.code).toContain('JSON.stringify({ a: 1 })')
  })

  it('rejects unsafe SSR spread attribute names', () => {
    const src = `<template><div {...attrs}></div></template>`
    const out = compileSsr(src, { filename: 'Sp.ave' })
    expect(out.code).toContain('/^[a-zA-Z_:]')
  })

  it('if-blocks track branch identity and nest child effects', () => {
    const src = `<template>{#if show}<span>{label}</span>{/if}</template>`
    const out = compile(src, { filename: 'If.ave', generate: 'client' })
    expect(out.code).toContain('__next === __branch')
    expect(out.code).toContain('__effect(__fn)')
  })

  it('await blocks cancel settled callbacks after teardown', () => {
    const src = `<template>{#await p then v}{v}{/await}</template>`
    const out = compile(src, { filename: 'Aw.ave', generate: 'client' })
    expect(out.code).toContain('__awaitGen')
    expect(out.code).toContain('__g !== __awaitGen')
  })

  it('hydrate falls back to soft remount destroy on mismatch', () => {
    const out = compile(`<template><p>x</p></template>`, { filename: 'H.ave', generate: 'client' })
    expect(out.code).toContain('__claimPush(target)')
    expect(out.code).toContain('__HydrateMismatchError')
    expect(out.code).toContain('soft.destroy()')
    expect(out.code).toContain('target.textContent')
    expect(out.code).toContain('__lifecycleAbort')
    expect(out.code).toContain('__updateHooksAbort')
    expect(out.code).toContain('if (__inst) { try { __inst.destroy(); } catch {} }')
  })

  it('BUG-302: mount aborts lifecycle/context cleanups when claim throws mid-init', () => {
    const out = compile(`<template><p>{x}</p></template>`, { filename: 'H.ave', generate: 'client' })
    expect(out.code).toContain('catch (__mountErr)')
    expect(out.code).toContain('__lifecycleAbort()')
    expect(out.code).toContain('__updateHooksAbort()')
  })

  it('BUG-306: destroy removes owned nodes only (not target.textContent)', () => {
    const out = compile(`<template><p>x</p></template>`, { filename: 'H.ave', generate: 'client' })
    expect(out.code).toContain('const __owned = []')
    expect(out.code).toContain('__owned.push(target.childNodes[__oi])')
    expect(out.code).toContain('for (const __n of __owned) { try { __n.remove(); } catch {} }')
    // Soft-remount hydrate wrapper may still clear target; mount.destroy must not.
    const mountDestroy = out.code.match(/return \{\s*destroy\(\) \{[\s\S]*?\},\s*update\(/)
    expect(mountDestroy?.[0] ?? '').toContain('__n.remove()')
    expect(mountDestroy?.[0] ?? '').not.toContain("target.textContent = ''")
  })
})
