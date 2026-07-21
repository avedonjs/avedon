import { describe, expect, it } from 'vitest'
import { syncVexCss } from './index.js'

type StyleNode = {
  name: 'style'
  attrs: Record<string, string>
  text: string
}

function makeTarget(initial: string | null) {
  const nodes: StyleNode[] = []
  if (initial != null) {
    nodes.push({ name: 'style', attrs: { 'data-vex-css': '' }, text: initial })
  }

  const api = {
    head: {
      appendChild(el: StyleNode) {
        nodes.push(el)
      },
    },
    querySelector(sel: string) {
      if (sel !== 'style[data-vex-css]') return null
      const found = nodes.find((n) => n.name === 'style' && 'data-vex-css' in n.attrs)
      if (!found) return null
      return {
        get textContent() {
          return found.text
        },
        set textContent(v: string) {
          found.text = v
        },
        remove() {
          const i = nodes.indexOf(found)
          if (i >= 0) nodes.splice(i, 1)
        },
      }
    },
    createElement(tag: string) {
      if (tag !== 'style') throw new Error('unexpected tag')
      const node: StyleNode = { name: 'style', attrs: {}, text: '' }
      return {
        setAttribute(k: string, v: string) {
          node.attrs[k] = v
        },
        get textContent() {
          return node.text
        },
        set textContent(v: string) {
          node.text = v
        },
        // syncVexCss appends this object; unwrap via Symbol
        [Symbol.for('node')]: node,
      }
    },
    _nodes: nodes,
  }

  // Make appendChild accept the createElement wrapper
  const append = api.head.appendChild.bind(api.head)
  api.head.appendChild = (el: { [k: symbol]: StyleNode } | StyleNode) => {
    const node = (el as { [k: symbol]: StyleNode })[Symbol.for('node')] ?? (el as StyleNode)
    append(node)
  }

  return api
}

describe('syncVexCss', () => {
  it('updates existing data-vex-css during client nav', () => {
    const to = makeTarget('old { color: red }')
    const from = { querySelector: () => ({ textContent: 'body { margin: 0 }' }) }
    syncVexCss(from as never, to as never)
    expect(to.querySelector('style[data-vex-css]')?.textContent).toBe('body { margin: 0 }')
  })

  it('inserts data-vex-css when missing', () => {
    const to = makeTarget(null)
    const from = { querySelector: () => ({ textContent: 'body { margin: 0 }' }) }
    syncVexCss(from as never, to as never)
    expect(to._nodes).toHaveLength(1)
    expect(to._nodes[0].text).toBe('body { margin: 0 }')
    expect(to._nodes[0].attrs['data-vex-css']).toBe('')
  })

  it('removes data-vex-css when next page has none', () => {
    const to = makeTarget('body { margin: 0 }')
    const from = { querySelector: () => null }
    syncVexCss(from as never, to as never)
    expect(to.querySelector('style[data-vex-css]')).toBeNull()
  })
})
