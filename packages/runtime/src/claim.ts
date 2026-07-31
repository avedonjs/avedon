export class HydrateMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HydrateMismatchError'
  }
}

export type ClaimCursor = { parent: ParentNode; index: number }

export function createClaimCursor(parent: ParentNode): ClaimCursor {
  return { parent, index: 0 }
}

function childAt(cursor: ClaimCursor): ChildNode | null {
  return cursor.parent.childNodes[cursor.index] ?? null
}

export function skipWhitespace(cursor: ClaimCursor): void {
  while (true) {
    const n = childAt(cursor)
    if (!n || n.nodeType !== 3) return
    if ((n as Text).data.trim() !== '') return
    cursor.index++
  }
}

/** Skip empty `<!---->` text-separator comments (not whitespace text nodes). */
function skipEmptyComments(cursor: ClaimCursor): void {
  while (true) {
    const n = childAt(cursor)
    if (!n || n.nodeType !== 8) return
    const c = n as Comment
    if (c.data !== '') return
    c.remove()
  }
}

/** Skip whitespace-only text and remove empty `<!---->` text-separator comments left from SSR. */
export function skipClaimNoise(cursor: ClaimCursor): void {
  while (true) {
    skipWhitespace(cursor)
    const n = childAt(cursor)
    if (!n || n.nodeType !== 8) return
    const c = n as Comment
    if (c.data !== '') return
    c.remove()
  }
}

function advance(cursor: ClaimCursor): ChildNode {
  skipClaimNoise(cursor)
  const n = childAt(cursor)
  if (!n) throw new HydrateMismatchError('unexpected end of children')
  cursor.index++
  return n
}

export function claimElement(cursor: ClaimCursor, tag: string): Element {
  const n = advance(cursor)
  if (n.nodeType !== 1) {
    throw new HydrateMismatchError(`expected <${tag}>, got nodeType ${n.nodeType}`)
  }
  const el = n as Element
  if (el.tagName.toLowerCase() !== tag.toLowerCase()) {
    throw new HydrateMismatchError(`expected <${tag}>, got <${el.tagName.toLowerCase()}>`)
  }
  return el
}

export function claimText(cursor: ClaimCursor, expected?: string): Text {
  skipEmptyComments(cursor)
  const n = childAt(cursor)
  if (!n || n.nodeType !== 3) {
    throw new HydrateMismatchError('expected text node')
  }
  cursor.index++
  const t = n as Text
  if (expected != null && t.data !== expected) {
    throw new HydrateMismatchError(
      `expected text ${JSON.stringify(expected)}, got ${JSON.stringify(t.data)}`,
    )
  }
  return t
}

export function claimComment(cursor: ClaimCursor, data: string): Comment {
  const n = advance(cursor)
  if (n.nodeType !== 8) {
    throw new HydrateMismatchError(`expected comment ${JSON.stringify(data)}`)
  }
  const c = n as Comment
  if (c.data !== data) {
    throw new HydrateMismatchError(
      `expected comment ${JSON.stringify(data)}, got ${JSON.stringify(c.data)}`,
    )
  }
  return c
}

export function assertClaimExhausted(cursor: ClaimCursor): void {
  skipClaimNoise(cursor)
  if (childAt(cursor)) {
    throw new HydrateMismatchError('unexpected trailing nodes after claim')
  }
}

export function claimAdvancePastSiblings(cursor: ClaimCursor): void {
  while (true) {
    skipClaimNoise(cursor)
    const n = childAt(cursor)
    if (!n) return
    if (n.nodeType === 8 && /^(if|each|each-keyed|key|await)$/.test((n as Comment).data)) return
    cursor.index++
  }
}

const claimStack: ClaimCursor[] = []

export function claimPush(parent: ParentNode): ClaimCursor {
  const c = createClaimCursor(parent)
  claimStack.push(c)
  return c
}

export function claimPop(): void {
  claimStack.pop()
}

export function claimCurrent(): ClaimCursor {
  const c = claimStack[claimStack.length - 1]
  if (!c) throw new HydrateMismatchError('claim cursor stack empty')
  return c
}

export function claimStackActive(): boolean {
  return claimStack.length > 0
}

export function claimStackDepth(): number {
  return claimStack.length
}

/** Test helper — clear claim stack between tests. */
export function __resetClaimStack(): void {
  claimStack.length = 0
  elClaimOpened.length = 0
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** True when emit helpers should claim from the active cursor (not create fresh nodes). */
function shouldClaim(parent: ParentNode): boolean {
  return claimStack.length > 0 && parent.nodeType !== 11 && claimCurrent().parent === parent
}

/** Tracks whether the matching avedonElEnd should pop a nested claim cursor. */
const elClaimOpened: boolean[] = []

/** Create or claim an element; when claiming, pushes a child cursor for nested emit. */
export function avedonEl(parent: ParentNode, tag: string, ns?: string | null): Element {
  if (shouldClaim(parent)) {
    const el = claimElement(claimCurrent(), tag)
    claimPush(el)
    elClaimOpened.push(true)
    return el
  }
  const el = ns ? document.createElementNS(ns, tag) : document.createElement(tag)
  parent.appendChild(el)
  elClaimOpened.push(false)
  return el
}

/** Pop child claim cursor after element children are emitted. */
export function avedonElEnd(): void {
  const opened = elClaimOpened.pop()
  if (!opened || !claimStack.length) return
  assertClaimExhausted(claimCurrent())
  claimPop()
}

export function avedonText(parent: ParentNode, data: string): Text {
  if (shouldClaim(parent)) {
    const cursor = claimCurrent()
    skipEmptyComments(cursor)
    const n = childAt(cursor)
    if (n && n.nodeType === 3) {
      cursor.index++
      return n as Text
    }
    // SSR/layout may omit insignificant whitespace-only text nodes between elements.
    if (data.trim() === '') {
      const t = document.createTextNode(data)
      if (n) cursor.parent.insertBefore(t, n)
      else cursor.parent.appendChild(t)
      return t
    }
    throw new HydrateMismatchError('expected text node')
  }
  const t = document.createTextNode(data)
  parent.appendChild(t)
  return t
}

export function avedonTextEmpty(parent: ParentNode): Text {
  if (shouldClaim(parent)) {
    const cursor = claimCurrent()
    skipEmptyComments(cursor)
    const n = childAt(cursor)
    if (n && n.nodeType === 3) {
      cursor.index++
      return n as Text
    }
    // SSR often omits text nodes for empty expressions; create one for effects.
    const t = document.createTextNode('')
    parent.appendChild(t)
    return t
  }
  const t = document.createTextNode('')
  parent.appendChild(t)
  return t
}

export function avedonComment(parent: ParentNode, data: string): Comment {
  if (shouldClaim(parent)) {
    const cursor = claimCurrent()
    // Text-separator `<!---->` nodes are stripped during claim (see skipClaimNoise).
    if (data === '') {
      skipEmptyComments(cursor)
      return document.createComment('')
    }
    return claimComment(cursor, data)
  }
  const c = document.createComment(data)
  parent.appendChild(c)
  return c
}

export function avedonAppend(parent: ParentNode, node: Node): void {
  if (claimStack.length) return
  parent.appendChild(node)
}

/**
 * True while the active claim cursor's parent is `target`
 * (hydrate root or nested component mount into a claimed parent).
 */
export function avedonClaimingInto(target: ParentNode): boolean {
  return claimStack.length > 0 && claimCurrent().parent === target
}

export { SVG_NS as AVEDON_SVG_NS }
