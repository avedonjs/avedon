import { describe, expect, it } from 'vitest'
import {
  assertClaimExhausted,
  avedonText,
  avedonTextEmpty,
  avedonComment,
  claimAdvanceUntilComment,
  claimComment,
  claimCurrent,
  claimElement,
  claimPush,
  claimText,
  createClaimCursor,
  HydrateMismatchError,
  skipClaimNoise,
  skipWhitespace,
  __resetClaimStack,
} from './claim.js'

function parentOf(...nodes: Array<{ nodeType: number; data?: string; tagName?: string; remove?: () => void }>) {
  const list = [...nodes]
  for (const n of list) {
    if (!n.remove) {
      n.remove = () => {
        const i = list.indexOf(n)
        if (i >= 0) list.splice(i, 1)
      }
    }
  }
  return {
    childNodes: list as unknown as NodeListOf<ChildNode>,
  } as ParentNode
}

describe('claim helpers', () => {
  it('claims matching element and advances', () => {
    const el = { nodeType: 1, tagName: 'SPAN' }
    const c = createClaimCursor(parentOf(el))
    expect(claimElement(c, 'span')).toBe(el)
    assertClaimExhausted(c)
  })

  it('skips whitespace text before claim', () => {
    const el = { nodeType: 1, tagName: 'B' }
    const c = createClaimCursor(parentOf({ nodeType: 3, data: '  \n' }, el))
    skipWhitespace(c)
    expect(claimElement(c, 'b')).toBe(el)
  })

  it('throws HydrateMismatchError on tag mismatch', () => {
    const c = createClaimCursor(parentOf({ nodeType: 1, tagName: 'DIV' }))
    expect(() => claimElement(c, 'span')).toThrow(HydrateMismatchError)
  })

  it('claims comment by data', () => {
    const com = { nodeType: 8, data: 'if' }
    const c = createClaimCursor(parentOf(com))
    expect(claimComment(c, 'if')).toBe(com)
  })

  it('claims static text when expected matches', () => {
    const t = { nodeType: 3, data: 'hi' }
    const c = createClaimCursor(parentOf(t))
    expect(claimText(c, 'hi')).toBe(t)
  })

  it('throws when expected text differs', () => {
    const c = createClaimCursor(parentOf({ nodeType: 3, data: 'a' }))
    expect(() => claimText(c, 'b')).toThrow(HydrateMismatchError)
  })

  it('avedonText claims static text without strict whitespace equality', () => {
    const parent = parentOf({ nodeType: 3, data: '\n        ' })
    __resetClaimStack()
    claimPush(parent)
    expect(avedonText(parent, '\n    ').data).toBe('\n        ')
  })

  it('skipClaimNoise removes empty comment separators', () => {
    const empty = { nodeType: 8, data: '' }
    const el = { nodeType: 1, tagName: 'SPAN' }
    const c = createClaimCursor(parentOf(empty, el))
    skipClaimNoise(c)
    expect(claimElement(c, 'span')).toBe(el)
  })

  it('avedonComment with empty data consumes text separator during claim', () => {
    const nodes = [
      { nodeType: 3, data: 'Likes: ' },
      { nodeType: 8, data: '' },
      { nodeType: 3, data: '3' },
    ]
    for (const n of nodes) {
      n.remove = () => {
        const i = nodes.indexOf(n)
        if (i >= 0) nodes.splice(i, 1)
      }
    }
    const parent = { childNodes: nodes as unknown as NodeListOf<ChildNode> } as ParentNode
    const prevDoc = globalThis.document
    globalThis.document = {
      createComment() {
        return { nodeType: 8, data: '' }
      },
    } as Document
    try {
      __resetClaimStack()
      claimPush(parent)
      avedonText(parent, 'Likes: ')
      avedonComment(parent, '')
      expect(avedonTextEmpty(parent).data).toBe('3')
      expect(claimCurrent().index).toBe(2)
    } finally {
      globalThis.document = prevDoc
    }
  })

  it('avedonText into detached element creates without claiming from cursor', () => {
    const anchor = { nodeType: 8, data: 'await' }
    const parent = parentOf(anchor)
    const p = {
      nodeType: 1,
      childNodes: [] as Array<{ nodeType: number; data: string }>,
      appendChild(node: { nodeType: number; data: string }) {
        p.childNodes.push(node)
        return node
      },
    } as unknown as ParentNode
    const prevDoc = globalThis.document
    globalThis.document = {
      createTextNode(data: string) {
        return { nodeType: 3, data }
      },
    } as Document
    try {
      __resetClaimStack()
      claimPush(parent)
      const t = avedonText(p, 'loading')
      expect(t.data).toBe('loading')
      expect(p.childNodes).toHaveLength(1)
      expect(claimCurrent().index).toBe(0)
      expect(claimComment(claimCurrent(), 'await')).toBe(anchor)
    } finally {
      globalThis.document = prevDoc
    }
  })

  it('claimAdvanceUntilComment consumes end marker and leaves following sibling', () => {
    const end = { nodeType: 8, data: '/html' }
    const after = { nodeType: 1, tagName: 'P' }
    const c = createClaimCursor(
      parentOf({ nodeType: 1, tagName: 'SPAN' }, { nodeType: 3, data: 'x' }, end, after),
    )
    claimAdvanceUntilComment(c, '/html')
    expect(claimElement(c, 'p')).toBe(after)
  })

  it('claimAdvanceUntilComment does not strip empty comments inside the island', () => {
    const empty = { nodeType: 8, data: '' }
    const end = { nodeType: 8, data: '/html' }
    const c = createClaimCursor(parentOf(empty, end))
    claimAdvanceUntilComment(c, '/html')
    assertClaimExhausted(c)
    // empty comment was advanced over, not removed
    expect(empty.nodeType).toBe(8)
  })
})
