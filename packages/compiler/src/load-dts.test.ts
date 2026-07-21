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
      { filename: 'Post.vex' },
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
      { filename: 'Home.vex' },
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
      { filename: 'Throw.vex' },
    )
    expect(dts).toMatch(/post:\s*Post/)
    expect(dts).not.toMatch(/data\?:\s*unknown\b/)
  })
})
