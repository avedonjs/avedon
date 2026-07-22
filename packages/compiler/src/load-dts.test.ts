import { describe, expect, it } from 'vitest'
import { compile } from './index.js'

describe('load → Props.data dts', () => {
  it('writes concrete data type from annotated load return (not unknown)', () => {
    const { dts } = compile(
      `
<script>
  export let data
</script>
<script server>
  type Post = { id: string; title: string; body: string; likes: number }
  export async function load(): Promise<{ data: { post: Post } }> {
    return { data: { post: { id: '1', title: 'Hi', body: '', likes: 0 } } }
  }
</script>
<template><h1>{data.post.title}</h1></template>
`,
      { filename: 'Post.ave' },
    )
    expect(dts).toMatch(/data\?:/)
    expect(dts).not.toMatch(/data\?:\s*unknown\b/)
    expect(dts).toMatch(/post:\s*Post/)
  })

  it('omits data prop when there is no load export', () => {
    const { dts } = compile(
      `
<script>
  export let title
</script>
<template><p>{title}</p></template>
`,
      { filename: 'Home.ave' },
    )
    expect(dts).not.toMatch(/\bdata\?:/)
    expect(dts).toMatch(/title\?:/)
  })

  it('throw notFound does not poison inferred return (annotation wins)', () => {
    const { dts } = compile(
      `
<script>
  export let data
</script>
<script server>
  declare function notFound(): never
  type Post = { id: string }
  export async function load(): Promise<{ data: { post: Post } }> {
    if (Math.random() > 1) throw notFound()
    return { data: { post: { id: '1' } } }
  }
</script>
<template><p>{data.post.id}</p></template>
`,
      { filename: 'Throw.ave' },
    )
    expect(dts).toMatch(/post:\s*Post/)
    expect(dts).not.toMatch(/data\?:\s*unknown\b/)
  })

  it('types load params from LoadEvent path annotation', () => {
    const { dts } = compile(
      `
<script>
  export let data
</script>
<script server>
  import type { LoadEvent } from '@avedon/server'
  type Post = { id: string }
  export async function load({
    params,
  }: LoadEvent<'/posts/:id'>): Promise<{ data: { post: Post } }> {
    return { data: { post: { id: params.id } } }
  }
</script>
<template><p>{data.post.id}</p></template>
`,
      { filename: 'PostParams.ave' },
    )
    expect(dts).toContain("ExtractParams<'/posts/:id'>")
    expect(dts).toContain("LoadContext<")
    expect(dts).not.toMatch(/load\?: \(event: unknown\)/)
  })

  it('types load params from LoadContext object annotation', () => {
    const { dts } = compile(
      `
<script>
  export let data
</script>
<script server>
  import type { LoadContext } from '@avedon/shared'
  export async function load(e: LoadContext<{ id: string }>): Promise<{ data: { id: string } }> {
    return { data: { id: e.params.id } }
  }
</script>
<template><p>{data.id}</p></template>
`,
      { filename: 'Ctx.ave' },
    )
    expect(dts).toMatch(/LoadContext<\{\s*id:\s*string\s*\}>/)
  })

  it('uses Props on mount/render and ActionHandler for actions', () => {
    const { dts } = compile(
      `
<script>
  export let data
</script>
<script server>
  import type { LoadEvent } from '@avedon/server'
  export async function load({
    params,
  }: LoadEvent<'/posts/:id'>): Promise<{ data: { id: string } }> {
    return { data: { id: params.id } }
  }
  export const actions = {
    async like({ params }: LoadEvent<'/posts/:id'>) {
      return { data: { id: params.id } }
    },
  }
</script>
<template><p>{data.id}</p></template>
`,
      { filename: 'Actions.ave' },
    )
    expect(dts).toMatch(/export function mount\(target: Element, props\?: Props\)/)
    expect(dts).toMatch(/export function render\(props\?: Props\)/)
    expect(dts).not.toMatch(/mount\(target: Element, props\?: Record<string, unknown>\)/)
    expect(dts).toContain('ActionHandler<')
    expect(dts).toMatch(/actions\?: \{\s*like\?:/)
  })
})
