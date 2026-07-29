import { describe, expect, it } from 'vitest'
import { moveChildNodes } from './document.js'

describe('moveChildNodes', () => {
  it('moves child nodes via replaceChildren without reading innerHTML', () => {
    const a = { id: 'a' }
    const b = { id: 'b' }
    const from = {
      childNodes: [a, b] as unknown as NodeListOf<ChildNode>,
      get innerHTML(): string {
        throw new Error('innerHTML must not be read')
      },
    }
    let replaced: unknown[] = []
    const to = {
      get innerHTML(): string {
        throw new Error('innerHTML must not be read')
      },
      set innerHTML(_v: string) {
        throw new Error('innerHTML must not be written')
      },
      replaceChildren(...nodes: unknown[]) {
        replaced = nodes
      },
    }

    moveChildNodes(to as never, from as never)
    expect(replaced).toEqual([a, b])
  })
})
