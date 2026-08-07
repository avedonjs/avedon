import { describe, expect, it } from 'vitest'
import { loadRouteChain } from './load-chain.js'
import type { AvedonComponentModule, LoadEvent } from './types.js'

const event = {
  params: {},
  request: new Request('http://local/'),
  url: new URL('http://local/'),
  cookies: { get: () => undefined, set: () => {}, delete: () => {} },
} as unknown as LoadEvent

describe('loadRouteChain', () => {
  it('merges outer layout then leaf (leaf wins)', async () => {
    const outer: AvedonComponentModule = {
      render: () => '',
      load: async () => ({ shell: 1, title: 'outer' }),
    }
    const inner: AvedonComponentModule = {
      render: () => '',
      load: async () => ({ panel: true }),
    }
    const leaf: AvedonComponentModule = {
      render: () => '',
      load: async () => ({ title: 'page' }),
    }
    // innermost-first (pipeline order)
    const data = await loadRouteChain([inner, outer], leaf, event)
    expect(data).toEqual({ shell: 1, panel: true, title: 'page' })
  })
})
