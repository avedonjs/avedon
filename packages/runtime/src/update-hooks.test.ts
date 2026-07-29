import { describe, expect, it, vi } from 'vitest'
import {
  __updateHooksBegin,
  __updateHooksEnd,
  afterUpdate,
  beforeUpdate,
} from './index.js'

describe('beforeUpdate / afterUpdate', () => {
  it('registers hooks during begin/end and is a no-op outside', () => {
    const before: Array<() => void> = []
    const after: Array<() => void> = []
    const b = vi.fn()
    const a = vi.fn()
    beforeUpdate(b)
    afterUpdate(a)
    expect(before).toHaveLength(0)
    expect(after).toHaveLength(0)

    __updateHooksBegin(before, after)
    beforeUpdate(b)
    afterUpdate(a)
    __updateHooksEnd()
    expect(before).toEqual([b])
    expect(after).toEqual([a])

    beforeUpdate(b)
    afterUpdate(a)
    expect(before).toHaveLength(1)
    expect(after).toHaveLength(1)
  })
})
