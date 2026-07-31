import { describe, expect, it } from 'vitest'
import {
  assertClaimExhausted,
  claimComment,
  claimElement,
  claimText,
  createClaimCursor,
  HydrateMismatchError,
  skipWhitespace,
} from './claim.js'

function parentOf(...nodes: Array<{ nodeType: number; data?: string; tagName?: string }>) {
  return {
    childNodes: nodes as unknown as NodeListOf<ChildNode>,
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
})
