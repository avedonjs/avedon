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

function advance(cursor: ClaimCursor): ChildNode {
  skipWhitespace(cursor)
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
  skipWhitespace(cursor)
  if (childAt(cursor)) {
    throw new HydrateMismatchError('unexpected trailing nodes after claim')
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
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Create or claim an element; when claiming, pushes a child cursor for nested emit. */
export function avedonEl(parent: ParentNode, tag: string, ns?: string | null): Element {
  if (claimStack.length) {
    const el = claimElement(claimCurrent(), tag)
    claimPush(el)
    return el
  }
  const el = ns ? document.createElementNS(ns, tag) : document.createElement(tag)
  parent.appendChild(el)
  return el
}

/** Pop child claim cursor after element children are emitted. */
export function avedonElEnd(): void {
  if (!claimStack.length) return
  assertClaimExhausted(claimCurrent())
  claimPop()
}

export function avedonText(parent: ParentNode, data: string): Text {
  if (claimStack.length) {
    return claimText(claimCurrent(), data)
  }
  const t = document.createTextNode(data)
  parent.appendChild(t)
  return t
}

export function avedonTextEmpty(parent: ParentNode): Text {
  if (claimStack.length) {
    return claimText(claimCurrent())
  }
  const t = document.createTextNode('')
  parent.appendChild(t)
  return t
}

export function avedonComment(parent: ParentNode, data: string): Comment {
  if (claimStack.length) {
    return claimComment(claimCurrent(), data)
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
