import { describe, expect, it, vi } from 'vitest'
import {
  captureFormState,
  captureOpenState,
  captureScrollState,
  elementFromPath,
  elementPath,
  restoreFocus,
  restoreFormState,
  restoreOpenState,
  restoreScrollState,
} from './document.js'

function el(children: unknown[] = [], extras: Record<string, unknown> = {}) {
  const node = {
    tagName: 'DIV',
    children: {
      length: children.length,
      item(i: number) {
        return children[i] ?? null
      },
      [Symbol.iterator]: function* () {
        yield* children
      },
      ...Object.fromEntries(children.map((c, i) => [i, c])),
    },
    parentElement: null as unknown,
    focus: vi.fn(),
    querySelectorAll(sel: string) {
      const out: unknown[] = []
      const walk = (n: {
        tagName?: string
        children?: { length: number; item: (i: number) => unknown }
      }) => {
        const tag = (n.tagName || '').toUpperCase()
        if (sel === '*') out.push(n)
        if (sel.includes('input') && tag === 'INPUT') out.push(n)
        if (sel.includes('textarea') && tag === 'TEXTAREA') out.push(n)
        if (sel.includes('select') && tag === 'SELECT') out.push(n)
        if (sel.includes('details') && tag === 'DETAILS') out.push(n)
        if (sel.includes('dialog') && tag === 'DIALOG') out.push(n)
        const ch = n.children
        if (!ch) return
        for (let i = 0; i < ch.length; i++) walk(ch.item(i) as never)
      }
      // querySelectorAll('*') excludes the root itself
      const ch = this.children
      if (ch) {
        for (let i = 0; i < ch.length; i++) walk(ch.item(i) as never)
      }
      return out
    },
    ...extras,
  }
  for (const c of children) {
    ;(c as { parentElement: unknown }).parentElement = node
  }
  return node
}

describe('focus path helpers', () => {
  it('elementPath / elementFromPath round-trip', () => {
    const leaf = el()
    const mid = el([leaf])
    const root = el([mid])
    const path = elementPath(root as never, leaf as never)
    expect(path).toEqual([0, 0])
    expect(elementFromPath(root as never, path!)).toBe(leaf)
  })
})

describe('restoreFocus', () => {
  it('restores focus and selection onto the path target', () => {
    const setSelectionRange = vi.fn()
    const leaf = el([], { setSelectionRange, selectionStart: 1, selectionEnd: 3 })
    const root = el([leaf])
    restoreFocus(root as never, { path: [0], selectionStart: 1, selectionEnd: 3 })
    expect(leaf.focus).toHaveBeenCalled()
    expect(setSelectionRange).toHaveBeenCalledWith(1, 3)
  })
})

describe('form state capture/restore', () => {
  it('round-trips text and checkbox values', () => {
    const text = el([], { tagName: 'INPUT', type: 'text', value: 'hello' })
    const box = el([], { tagName: 'INPUT', type: 'checkbox', checked: true })
    const root = el([text, box])
    const snap = captureFormState(root as never)
    expect(snap).toEqual([
      { path: [0], kind: 'value', value: 'hello' },
      { path: [1], kind: 'checked', checked: true },
    ])
    text.value = ''
    box.checked = false
    restoreFormState(root as never, snap)
    expect(text.value).toBe('hello')
    expect(box.checked).toBe(true)
  })
})

describe('scroll state capture/restore', () => {
  it('round-trips element scroll offsets', () => {
    const pane = el([], { scrollTop: 120, scrollLeft: 40 })
    const root = el([pane], { scrollTop: 0, scrollLeft: 0 })
    const snap = captureScrollState(root as never)
    expect(snap.elements).toEqual([{ path: [0], scrollTop: 120, scrollLeft: 40 }])
    pane.scrollTop = 0
    pane.scrollLeft = 0
    restoreScrollState(root as never, snap)
    expect(pane.scrollTop).toBe(120)
    expect(pane.scrollLeft).toBe(40)
  })

  it('restores window scroll when present', () => {
    const scrollTo = vi.fn()
    const prev = (globalThis as { window?: unknown }).window
    ;(globalThis as { window: unknown }).window = {
      scrollX: 10,
      scrollY: 80,
      scrollTo,
    }
    try {
      const root = el([], { scrollTop: 0, scrollLeft: 0 })
      const snap = captureScrollState(root as never)
      expect(snap.window).toEqual({ scrollX: 10, scrollY: 80 })
      restoreScrollState(root as never, snap)
      expect(scrollTo).toHaveBeenCalledWith(10, 80)
    } finally {
      ;(globalThis as { window?: unknown }).window = prev
    }
  })
})

describe('open state capture/restore', () => {
  it('round-trips details and dialog open', () => {
    const details = el([], { tagName: 'DETAILS', open: true })
    const dialog = el([], { tagName: 'DIALOG', open: false })
    const root = el([details, dialog])
    const snap = captureOpenState(root as never)
    expect(snap).toEqual([
      { path: [0], open: true },
      { path: [1], open: false },
    ])
    details.open = false
    dialog.open = true
    restoreOpenState(root as never, snap)
    expect(details.open).toBe(true)
    expect(dialog.open).toBe(false)
  })
})
