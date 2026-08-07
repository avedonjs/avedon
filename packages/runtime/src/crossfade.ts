type Pending = { rect: DOMRect; done: () => void }

const pending = new Map<string, Pending>()

/** Outro side of crossfade — stash rect and wait for a matching receive (or timeout). */
export function crossfadeSend(key: string, el: Element, done: () => void): void {
  const k = String(key)
  pending.set(k, { rect: el.getBoundingClientRect(), done })
  setTimeout(() => {
    const cur = pending.get(k)
    if (cur && cur.done === done) {
      pending.delete(k)
      done()
    }
  }, 480)
}

/** Intro side of crossfade — animate from the sender’s rect when present. */
export function crossfadeReceive(key: string, el: HTMLElement, ms: number): void {
  const k = String(key)
  const p = pending.get(k)
  if (!p) return
  pending.delete(k)
  const to = el.getBoundingClientRect()
  const dx = p.rect.left - to.left
  const dy = p.rect.top - to.top
  const prevTransition = el.style.transition
  const prevTransform = el.style.transform
  el.style.transition = 'none'
  el.style.transform = `translate(${dx}px, ${dy}px)`
  requestAnimationFrame(() => {
    el.style.transition = `transform ${ms}ms ease`
    el.style.transform = ''
    const finish = () => {
      el.style.transition = prevTransition
      el.style.transform = prevTransform
      p.done()
    }
    el.addEventListener('transitionend', finish, { once: true })
    setTimeout(finish, ms + 50)
  })
}

/** Test helper */
export function __resetCrossfade(): void {
  pending.clear()
}
