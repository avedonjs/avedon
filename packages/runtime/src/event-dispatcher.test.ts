import { describe, expect, it, vi } from 'vitest'
import { createEventDispatcher } from './index.js'

describe('createEventDispatcher', () => {
  it('calls on{type} props with { type, detail }', () => {
    const onsave = vi.fn()
    const dispatch = createEventDispatcher({ onsave })
    dispatch('save', { id: 7 })
    expect(onsave).toHaveBeenCalledTimes(1)
    expect(onsave).toHaveBeenCalledWith({ type: 'save', detail: { id: 7 } })
  })

  it('is a no-op when the handler is missing or not a function', () => {
    const dispatch = createEventDispatcher({ onsave: 'nope' })
    expect(() => dispatch('save')).not.toThrow()
    expect(() => dispatch('other')).not.toThrow()
  })

  it('reads handlers from the live props object (update-friendly)', () => {
    const props: Record<string, unknown> = {}
    const dispatch = createEventDispatcher(props)
    const first = vi.fn()
    const second = vi.fn()
    props.onclick = first
    dispatch('click')
    expect(first).toHaveBeenCalledTimes(1)
    props.onclick = second
    dispatch('click')
    expect(second).toHaveBeenCalledTimes(1)
  })
})
