/**
 * Move children from `from` into `to` without an HTML serialize/parse round-trip.
 * Used by client navigation so `#app` swaps match soft-hydrate's replaceChildren path.
 */
export function moveChildNodes(to: ParentNode, from: ParentNode): void {
  to.replaceChildren(...Array.from(from.childNodes))
}

export type FocusSnapshot = {
  path: number[]
  selectionStart: number | null
  selectionEnd: number | null
}

function isElement(node: unknown): node is Element {
  return (
    !!node &&
    typeof node === 'object' &&
    'children' in node &&
    'parentElement' in node &&
    typeof (node as Element).children?.item === 'function'
  )
}

function isHtmlElement(node: unknown): node is HTMLElement {
  return isElement(node) && typeof (node as HTMLElement).focus === 'function'
}

/** Child-index path from `root` down to `el`. */
export function elementPath(root: ParentNode, el: Element): number[] | null {
  const path: number[] = []
  let cur: Element | null = el
  while (cur && cur !== root) {
    const parent: Element | null = cur.parentElement
    if (!parent) return null
    path.push(Array.prototype.indexOf.call(parent.children, cur))
    cur = parent
  }
  if (cur !== root) return null
  path.reverse()
  return path
}

export function elementFromPath(root: ParentNode, path: number[]): Element | null {
  if (!isElement(root)) return null
  let cur: Element = root
  for (const i of path) {
    const next = cur.children.item(i)
    if (!next) return null
    cur = next
  }
  return cur
}

/** Snapshot focused control inside `root` (for soft-hydrate restore). */
export function captureFocus(root: ParentNode): FocusSnapshot | null {
  const doc = (globalThis as { document?: Document }).document
  if (!doc) return null
  const active = doc.activeElement
  if (!isHtmlElement(active)) return null
  if (!(root instanceof Node) || !root.contains(active)) return null
  const path = elementPath(root, active)
  if (!path) return null
  const input = active as HTMLInputElement
  const selectionStart = typeof input.selectionStart === 'number' ? input.selectionStart : null
  const selectionEnd = typeof input.selectionEnd === 'number' ? input.selectionEnd : null
  return { path, selectionStart, selectionEnd }
}

/** Restore focus + text selection after soft-hydrate `replaceChildren`. */
export function restoreFocus(root: ParentNode, snap: FocusSnapshot | null): void {
  if (!snap) return
  const el = elementFromPath(root, snap.path)
  if (!isHtmlElement(el)) return
  try {
    el.focus()
  } catch {
    return
  }
  if (
    snap.selectionStart != null &&
    snap.selectionEnd != null &&
    typeof (el as HTMLInputElement).setSelectionRange === 'function'
  ) {
    try {
      ;(el as HTMLInputElement).setSelectionRange(snap.selectionStart, snap.selectionEnd)
    } catch {
      /* not a text control */
    }
  }
}

export type FormFieldSnapshot =
  | { path: number[]; kind: 'value'; value: string }
  | { path: number[]; kind: 'checked'; checked: boolean }
  | { path: number[]; kind: 'selected'; selected: string[] }

export type FormSnapshot = FormFieldSnapshot[]

function formControls(root: ParentNode): Element[] {
  if (!isElement(root) || typeof root.querySelectorAll !== 'function') return []
  return Array.from(root.querySelectorAll('input, textarea, select'))
}

/** Snapshot user-editable form control state inside `root`. */
export function captureFormState(root: ParentNode): FormSnapshot {
  const out: FormSnapshot = []
  for (const el of formControls(root)) {
    const path = elementPath(root, el)
    if (!path) continue
    const tag = el.tagName
    if (tag === 'SELECT') {
      const select = el as HTMLSelectElement
      const selected = Array.from(select.selectedOptions).map((o) => o.value)
      out.push({ path, kind: 'selected', selected })
      continue
    }
    const input = el as HTMLInputElement
    const type = (input.type || 'text').toLowerCase()
    if (type === 'checkbox' || type === 'radio') {
      out.push({ path, kind: 'checked', checked: !!input.checked })
      continue
    }
    if (type === 'file') continue
    out.push({ path, kind: 'value', value: input.value })
  }
  return out
}

/** Restore form control state after soft-hydrate remount. */
export function restoreFormState(root: ParentNode, snap: FormSnapshot): void {
  for (const field of snap) {
    const el = elementFromPath(root, field.path)
    if (!el) continue
    if (field.kind === 'value') {
      ;(el as HTMLInputElement).value = field.value
    } else if (field.kind === 'checked') {
      ;(el as HTMLInputElement).checked = field.checked
    } else if (field.kind === 'selected' && el.tagName === 'SELECT') {
      const select = el as HTMLSelectElement
      const set = new Set(field.selected)
      for (const opt of Array.from(select.options)) {
        opt.selected = set.has(opt.value)
      }
    }
  }
}

export type ScrollFieldSnapshot = {
  path: number[]
  scrollTop: number
  scrollLeft: number
}

export type WindowScrollSnapshot = {
  scrollX: number
  scrollY: number
}

export type ScrollSnapshot = {
  window: WindowScrollSnapshot | null
  elements: ScrollFieldSnapshot[]
}

function isScrollableElement(
  node: unknown,
): node is Element & { scrollTop: number; scrollLeft: number } {
  return (
    isElement(node) &&
    typeof (node as HTMLElement).scrollTop === 'number' &&
    typeof (node as HTMLElement).scrollLeft === 'number'
  )
}

function allElements(root: ParentNode): Element[] {
  if (!isElement(root) || typeof root.querySelectorAll !== 'function') return []
  return [root, ...Array.from(root.querySelectorAll('*'))]
}

/** Snapshot scroll offsets for `root` subtree + window (soft-hydrate restore). */
export function captureScrollState(root: ParentNode): ScrollSnapshot {
  const elements: ScrollFieldSnapshot[] = []
  for (const el of allElements(root)) {
    if (!isScrollableElement(el)) continue
    const scrollTop = el.scrollTop || 0
    const scrollLeft = el.scrollLeft || 0
    if (scrollTop === 0 && scrollLeft === 0) continue
    const path = elementPath(root, el)
    if (!path) continue
    elements.push({ path, scrollTop, scrollLeft })
  }
  let win: WindowScrollSnapshot | null = null
  const w = (globalThis as { window?: Window }).window
  if (w && typeof w.scrollX === 'number' && typeof w.scrollY === 'number') {
    win = { scrollX: w.scrollX, scrollY: w.scrollY }
  }
  return { window: win, elements }
}

/** Restore element + window scroll after soft-hydrate remount. */
export function restoreScrollState(root: ParentNode, snap: ScrollSnapshot): void {
  for (const field of snap.elements) {
    const el = elementFromPath(root, field.path)
    if (!isScrollableElement(el)) continue
    el.scrollTop = field.scrollTop
    el.scrollLeft = field.scrollLeft
  }
  if (!snap.window) return
  const w = (globalThis as { window?: Window }).window
  if (w && typeof w.scrollTo === 'function') {
    w.scrollTo(snap.window.scrollX, snap.window.scrollY)
  }
}

export type OpenFieldSnapshot = {
  path: number[]
  open: boolean
}

export type OpenSnapshot = OpenFieldSnapshot[]

function openControls(root: ParentNode): Element[] {
  if (!isElement(root) || typeof root.querySelectorAll !== 'function') return []
  return Array.from(root.querySelectorAll('details, dialog'))
}

/** Snapshot `<details>` / `<dialog>` open IDL for soft-hydrate restore. */
export function captureOpenState(root: ParentNode): OpenSnapshot {
  const out: OpenSnapshot = []
  for (const el of openControls(root)) {
    const path = elementPath(root, el)
    if (!path) continue
    out.push({ path, open: !!(el as HTMLDetailsElement).open })
  }
  return out
}

/** Restore details/dialog open after soft-hydrate remount. */
export function restoreOpenState(root: ParentNode, snap: OpenSnapshot): void {
  for (const field of snap) {
    const el = elementFromPath(root, field.path)
    if (!el || !('open' in el)) continue
    ;(el as HTMLDetailsElement).open = field.open
  }
}
