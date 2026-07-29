import { afterEach, describe, expect, it, vi } from 'vitest'
import { portal } from './index.js'

describe('portal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('moves the node into a host and supports update/destroy', () => {
    const node = { parentNode: null as unknown, remove: vi.fn() }
    const aChildren: unknown[] = []
    const bChildren: unknown[] = []
    const hostA = {
      appendChild(n: unknown) {
        aChildren.push(n)
        ;(n as { parentNode: unknown }).parentNode = hostA
      },
    }
    const hostB = {
      appendChild(n: unknown) {
        bChildren.push(n)
        ;(n as { parentNode: unknown }).parentNode = hostB
      },
    }
    const action = portal(node as never, hostA as never)
    expect(aChildren).toEqual([node])
    expect(node.parentNode).toBe(hostA)

    action.update(hostB as never)
    expect(bChildren).toEqual([node])
    expect(node.parentNode).toBe(hostB)

    action.destroy()
    expect(node.remove).toHaveBeenCalled()
  })

  it('resolves string targets via document.querySelector', () => {
    const node = { parentNode: null as unknown, remove: vi.fn() }
    const host = {
      appendChild(n: unknown) {
        ;(n as { parentNode: unknown }).parentNode = host
      },
    }
    vi.stubGlobal('document', {
      querySelector(sel: string) {
        expect(sel).toBe('#host')
        return host
      },
    })
    portal(node as never, '#host')
    expect(node.parentNode).toBe(host)
  })

  it('resolves selectors inside a detached mount tree', () => {
    const host = {
      id: 'portal-host',
      appendChild(n: unknown) {
        ;(n as { parentNode: unknown }).parentNode = host
      },
    }
    const main = {
      parentNode: null as unknown,
      children: { length: 0 },
      querySelector(sel: string) {
        return sel === '#portal-host' ? host : null
      },
    }
    const node = {
      parentNode: main as unknown,
      remove: vi.fn(),
    }
    // Walk: node -> main (detached root with querySelector)
    portal(node as never, '#portal-host')
    expect(node.parentNode).toBe(host)
  })
})
