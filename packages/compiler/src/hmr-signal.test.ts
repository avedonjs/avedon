import { describe, expect, it } from 'vitest'
import { compile } from './index.js'

describe('HMR signal key injection', () => {
  it('adds hmr key when hmr: true', () => {
    const { code } = compile(
      `
<script>
  import { signal } from '@avedon/runtime'
  export let data
  const likes = signal(data.post.likes)
</script>
<template><p>{likes}</p></template>
`,
      { filename: 'Sig.ave', hmr: true },
    )
    expect(code).toContain('signal(data.post.likes, "likes")')
    expect(code).toContain('getHmrState')
    expect(code).toContain('__hmrBeginSignalBag')
  })

  it('omits HMR helpers when hmr is off (prod)', () => {
    const { code } = compile(
      `
<script>
  import { signal } from '@avedon/runtime'
  const likes = signal(0)
</script>
<template><p>{likes}</p></template>
`,
      { filename: 'Sig.ave', hmr: false },
    )
    expect(code).not.toContain('getHmrState')
    expect(code).not.toContain('__hmrBeginSignalBag')
    expect(code).not.toContain(', "likes")')
  })
})
