import { describe, expect, it } from 'vitest'
import { snap } from './index.js'

function fakeEl(initial: Record<string, string> = {}) {
  const style: Record<string, string> = { ...initial }
  const children: Array<{ style: Record<string, string> }> = [
    { style: { scrollSnapAlign: '' } },
    { style: { scrollSnapAlign: '' } },
  ]
  return {
    style,
    children,
  }
}

describe('snap', () => {
  it('applies scroll-snap styles to node and children', () => {
    const node = fakeEl()
    const action = snap(node as never, { axis: 'x', align: 'center', type: 'mandatory' })
    expect(node.style.overflowX).toBe('auto')
    expect(node.style.scrollSnapType).toBe('x mandatory')
    expect(node.children[0]!.style.scrollSnapAlign).toBe('center')
    expect(node.children[1]!.style.scrollSnapAlign).toBe('center')
    action.destroy()
    expect(node.style.scrollSnapType).toBe('')
    expect(node.children[0]!.style.scrollSnapAlign).toBe('')
  })

  it('disables and restores on update(false)', () => {
    const node = fakeEl({ overflowX: 'scroll', scrollSnapType: '' })
    const action = snap(node as never, true)
    expect(node.style.scrollSnapType).toBe('x mandatory')
    action.update(false)
    expect(node.style.overflowX).toBe('scroll')
    expect(node.style.scrollSnapType).toBe('')
  })
})
