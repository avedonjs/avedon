export type Subscriber<T> = (value: T) => void

export interface Readable<T> {
  subscribe(fn: Subscriber<T>): () => void
}

export interface Writable<T> extends Readable<T> {
  set(value: T): void
  update(fn: (value: T) => T): void
}

/** Fine-grained reactive primitive (Solid/Preact Signals style). */
export interface Signal<T> {
  get(): T
  set(value: T): void
  update(fn: (value: T) => T): void
  subscribe(fn: Subscriber<T>): () => void
  /** Auto-unwrap in templates when read via toString / valueOf */
  toString(): string
  valueOf(): T
}

type EffectFn = () => void | (() => void)

let activeEffect: EffectFn | null = null
const effectDeps = new WeakMap<object, Set<EffectFn>>()

function track(sig: object) {
  if (!activeEffect) return
  let deps = effectDeps.get(sig)
  if (!deps) {
    deps = new Set()
    effectDeps.set(sig, deps)
  }
  deps.add(activeEffect)
}

function trigger(sig: object) {
  const deps = effectDeps.get(sig)
  if (!deps) return
  for (const fn of [...deps]) fn()
}

export function signal<T>(value: T): Signal<T> {
  const sig: Signal<T> = {
    get() {
      track(sig)
      return value
    },
    set(next) {
      if (Object.is(value, next)) return
      value = next
      trigger(sig)
    },
    update(fn) {
      this.set(fn(value))
    },
    subscribe(fn) {
      const wrap: EffectFn = () => fn(value)
      let deps = effectDeps.get(sig)
      if (!deps) {
        deps = new Set()
        effectDeps.set(sig, deps)
      }
      deps.add(wrap)
      fn(value)
      return () => deps!.delete(wrap)
    },
    toString() {
      return String(this.get())
    },
    valueOf() {
      return this.get()
    },
  }
  return sig
}

export function computed<T>(fn: () => T): Signal<T> {
  const s = signal(fn())
  effect(() => {
    s.set(fn())
  })
  return {
    get: () => s.get(),
    set() {
      throw new Error('computed is read-only')
    },
    update() {
      throw new Error('computed is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

export function effect(fn: EffectFn): () => void {
  let cleanup: void | (() => void)
  const run: EffectFn = () => {
    if (typeof cleanup === 'function') cleanup()
    activeEffect = run
    try {
      cleanup = fn()
    } finally {
      activeEffect = null
    }
  }
  run()
  return () => {
    if (typeof cleanup === 'function') cleanup()
  }
}

/** @deprecated Prefer signal() — kept for compatibility. */
export function writable<T>(value: T): Writable<T> {
  const s = signal(value)
  return {
    subscribe: (fn) => s.subscribe(fn),
    set: (v) => s.set(v),
    update: (fn) => s.update(fn),
  }
}

/** @deprecated Prefer computed() / signal(). */
export function readable<T>(
  value: T,
  start?: (set: (v: T) => void) => void | (() => void),
): Readable<T> {
  const store = writable(value)
  let stop: void | (() => void)
  let subscriberCount = 0
  return {
    subscribe(fn) {
      if (subscriberCount === 0 && start) {
        stop = start((v) => store.set(v))
      }
      subscriberCount++
      const unsub = store.subscribe(fn)
      return () => {
        unsub()
        subscriberCount--
        if (subscriberCount === 0 && typeof stop === 'function') {
          stop()
          stop = undefined
        }
      }
    },
  }
}

export function get<T>(store: Readable<T> | Signal<T>): T {
  if ('get' in store && typeof store.get === 'function') return store.get()
  let value!: T
  const unsub = store.subscribe((v) => {
    value = v
  })
  unsub()
  return value
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface MountResult {
  destroy(): void
  update(props: Record<string, unknown>): void
}

export type NavigateOptions = {
  replace?: boolean
}

export type GuardEvent = {
  params: Record<string, string>
  url: URL
  request?: Request
}

export type GuardDecision =
  | { type: 'allow' }
  | { type: 'deny'; status: number; message: string }

/**
 * Evaluate route.guard / route.canActivate on the client.
 */
export async function evaluateCanActivate(
  canActivate: ((event: GuardEvent) => unknown) | undefined,
  event: GuardEvent,
): Promise<GuardDecision> {
  if (!canActivate) return { type: 'allow' }
  const g = await canActivate(event)
  if (g === false) return { type: 'deny', status: 403, message: 'Forbidden' }
  if (typeof Response !== 'undefined' && g instanceof Response) {
    return { type: 'deny', status: g.status, message: g.statusText || 'Forbidden' }
  }
  return { type: 'allow' }
}

export const evaluateGuard = evaluateCanActivate

type BootFn = (pathname: string) => Promise<void> | void

export type ClientBootOptions = {
  abandon?: () => void
}

let bootHandler: BootFn | null = null
let abandonHandler: (() => void) | null = null

export function setClientBoot(fn: BootFn, opts: ClientBootOptions = {}) {
  bootHandler = fn
  abandonHandler = opts.abandon ?? null
}

export async function navigate(href: string, opts: NavigateOptions = {}): Promise<void> {
  const url = new URL(href, location.origin)
  if (url.origin !== location.origin) {
    location.href = href
    return
  }
  const res = await fetch(url.pathname + url.search, {
    headers: { accept: 'text/html' },
  })
  const html = await res.text()
  abandonHandler?.()
  applyDocument(html)
  if (opts.replace) history.replaceState({}, '', url.pathname + url.search + url.hash)
  else history.pushState({}, '', url.pathname + url.search + url.hash)
  await bootHandler?.(url.pathname)
}

function applyDocument(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const nextApp = doc.getElementById('app')
  const nextData = doc.getElementById('__VEX_DATA__')
  const app = document.getElementById('app')
  const dataEl = document.getElementById('__VEX_DATA__')
  if (app && nextApp) app.innerHTML = nextApp.innerHTML
  if (dataEl && nextData) dataEl.textContent = nextData.textContent
  const nextTitle = doc.querySelector('title')
  if (nextTitle) document.title = nextTitle.textContent ?? document.title
  syncVexCss(doc)
}

export function syncVexCss(from: ParentNode, toDoc: Document = document) {
  const nextCss = from.querySelector('style[data-vex-css]')
  let cssEl = toDoc.querySelector('style[data-vex-css]') as HTMLStyleElement | null
  if (nextCss) {
    if (!cssEl) {
      cssEl = toDoc.createElement('style')
      cssEl.setAttribute('data-vex-css', '')
      toDoc.head.appendChild(cssEl)
    }
    cssEl.textContent = nextCss.textContent
  } else if (cssEl) {
    cssEl.remove()
  }
}

export function enhance(form: HTMLFormElement): () => void {
  const onSubmit = async (event: Event) => {
    event.preventDefault()
    const method = (form.getAttribute('method') || 'GET').toUpperCase()
    // Resolve against the current page (not origin alone) so `?_action=like` stays on /posts/1
    const action = form.getAttribute('action')
    const url = new URL(action == null || action === '' ? location.href : action, location.href)
    if (method === 'GET') {
      const fd = new FormData(form)
      for (const [k, v] of fd.entries()) {
        if (typeof v === 'string') url.searchParams.set(k, v)
      }
      await navigate(url.pathname + url.search)
      return
    }
    const res = await fetch(url.pathname + url.search, {
      method,
      body: new FormData(form),
      headers: { accept: 'text/html' },
    })
    const html = await res.text()
    abandonHandler?.()
    applyDocument(html)
    history.pushState({}, '', url.pathname + url.search)
    await bootHandler?.(url.pathname)
  }
  form.addEventListener('submit', onSubmit)
  return () => form.removeEventListener('submit', onSubmit)
}

export function installClientRouter(root: ParentNode = document): () => void {
  const onClick = (event: Event) => {
    const e = event as MouseEvent
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!a) return
    const href = a.getAttribute('href')
    if (!href || href.startsWith('#') || a.target === '_blank' || a.hasAttribute('download')) return
    const url = new URL(href, location.href)
    if (url.origin !== location.origin) return
    e.preventDefault()
    void navigate(url.pathname + url.search + url.hash)
  }

  const enhanced = new WeakSet<HTMLFormElement>()
  const scanForms = () => {
    root.querySelectorAll('form').forEach((form) => {
      if (enhanced.has(form)) return
      enhanced.add(form)
      enhance(form)
    })
  }

  const onPop = () => {
    void navigate(location.pathname + location.search, { replace: true })
  }

  document.addEventListener('click', onClick)
  window.addEventListener('popstate', onPop)
  scanForms()
  const mo = new MutationObserver(scanForms)
  mo.observe(document.documentElement, { childList: true, subtree: true })

  return () => {
    document.removeEventListener('click', onClick)
    window.removeEventListener('popstate', onPop)
    mo.disconnect()
  }
}
