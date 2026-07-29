export {
  createRenderStream,
  oooInjectScript,
  settleAvedonStream,
  streamToString,
} from './stream.js'
export type {
  BoundaryRender,
  EnqueueHtml,
  RenderStreamController,
} from './stream.js'

import { settleAvedonStream } from './stream.js'
import { moveChildNodes } from './document.js'

export {
  moveChildNodes,
  captureFocus,
  restoreFocus,
  captureFormState,
  restoreFormState,
  captureScrollState,
  restoreScrollState,
  captureOpenState,
  restoreOpenState,
  elementPath,
  elementFromPath,
} from './document.js'
export type {
  FocusSnapshot,
  FormSnapshot,
  FormFieldSnapshot,
  ScrollSnapshot,
  ScrollFieldSnapshot,
  WindowScrollSnapshot,
  OpenSnapshot,
  OpenFieldSnapshot,
} from './document.js'

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
/** Reverse map so dispose / rerun can drop an effect from every signal it tracked. */
const effectSources = new WeakMap<EffectFn, Set<object>>()
let batchDepth = 0
let pendingTriggers: Set<object> | null = null

function clearEffectSources(run: EffectFn) {
  const sources = effectSources.get(run)
  if (!sources) return
  for (const sig of sources) {
    effectDeps.get(sig)?.delete(run)
  }
  sources.clear()
}

function track(sig: object) {
  if (!activeEffect) return
  let deps = effectDeps.get(sig)
  if (!deps) {
    deps = new Set()
    effectDeps.set(sig, deps)
  }
  deps.add(activeEffect)
  let sources = effectSources.get(activeEffect)
  if (!sources) {
    sources = new Set()
    effectSources.set(activeEffect, sources)
  }
  sources.add(sig)
}

function flushTriggers(sigs: Set<object>) {
  const effects = new Set<EffectFn>()
  for (const sig of sigs) {
    const deps = effectDeps.get(sig)
    if (!deps) continue
    for (const fn of deps) effects.add(fn)
  }
  for (const fn of effects) fn()
}

function trigger(sig: object) {
  if (batchDepth > 0) {
    if (!pendingTriggers) pendingTriggers = new Set()
    pendingTriggers.add(sig)
    return
  }
  const deps = effectDeps.get(sig)
  if (!deps) return
  for (const fn of [...deps]) fn()
}

/**
 * Run `fn` while coalescing signal notifications. Effects that depend on
 * written signals re-run once when the outermost `batch` ends.
 */
export function batch(fn: () => void): void {
  batchDepth++
  try {
    fn()
  } finally {
    batchDepth--
    if (batchDepth === 0 && pendingTriggers) {
      const queued = pendingTriggers
      pendingTriggers = null
      flushTriggers(queued)
    }
  }
}

export function signal<T>(value: T, hmrKey?: string): Signal<T> {
  let initial = value
  if (hmrKey && pendingHmrSignals && hmrKey in pendingHmrSignals) {
    initial = pendingHmrSignals[hmrKey] as T
  }
  let current = initial
  const sig: Signal<T> = {
    get() {
      track(sig)
      return current
    },
    set(next) {
      if (Object.is(current, next)) return
      current = next
      trigger(sig)
    },
    update(fn) {
      this.set(fn(current))
    },
    subscribe(fn) {
      const wrap: EffectFn = () => fn(current)
      let deps = effectDeps.get(sig)
      if (!deps) {
        deps = new Set()
        effectDeps.set(sig, deps)
      }
      deps.add(wrap)
      fn(current)
      return () => deps!.delete(wrap)
    },
    toString() {
      return String(this.get())
    },
    valueOf() {
      return this.get()
    },
  }
  if (hmrKey && activeSignalBag) {
    activeSignalBag[hmrKey] = sig
  }
  return sig
}

/**
 * Expose a signal without `set` / `update`. Underlying writes still notify readers.
 */
export function readonly<T>(source: Signal<T>): Signal<T> {
  return {
    get: () => source.get(),
    set() {
      throw new Error('readonly signal cannot be set')
    },
    update() {
      throw new Error('readonly signal cannot be updated')
    },
    subscribe: (fn) => source.subscribe(fn),
    toString: () => String(source.get()),
    valueOf: () => source.get(),
  }
}

export type TweenedOptions = {
  /** Milliseconds; clamped by `transitionMs` (0 under reduced motion). Default `400`. */
  duration?: number
  /** Progress `0..1` → eased `0..1`. Default linear. */
  easing?: (t: number) => number
}

export type Tweened = Omit<Signal<number>, 'set' | 'update'> & {
  set(value: number, opts?: TweenedOptions): void
  update(fn: (value: number) => number, opts?: TweenedOptions): void
}

const tweenLinear = (t: number) => t

/**
 * Number signal that interpolates toward `set` targets with `requestAnimationFrame`.
 * Call during component init so in-flight frames are cancelled on destroy.
 */
export function tweened(initial: number, defaults: TweenedOptions = {}): Tweened {
  const s = signal(initial)
  let displayed = initial
  let raf = 0
  let from = initial
  let to = initial
  let start = 0
  let duration = 0
  let easing = defaults.easing ?? tweenLinear

  const cancel = () => {
    if (raf && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(raf)
    }
    raf = 0
  }

  const write = (value: number) => {
    displayed = value
    s.set(value)
  }

  const tick = (now: number) => {
    const elapsed = now - start
    if (duration <= 0 || elapsed >= duration) {
      raf = 0
      write(to)
      return
    }
    const t = easing(Math.min(1, Math.max(0, elapsed / duration)))
    write(from + (to - from) * t)
    raf = requestAnimationFrame(tick)
  }

  const set = (value: number, opts?: TweenedOptions) => {
    cancel()
    to = value
    easing = opts?.easing ?? defaults.easing ?? tweenLinear
    duration = transitionMs(opts?.duration ?? defaults.duration ?? 400)
    if (duration <= 0 || typeof requestAnimationFrame !== 'function') {
      write(value)
      return
    }
    from = displayed
    start =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
    raf = requestAnimationFrame(tick)
  }

  if (lifecycleStack) lifecycleStack.cleanups.push(cancel)

  return {
    get: () => s.get(),
    set,
    update(fn, opts) {
      set(fn(displayed), opts)
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

export type SpringOptions = {
  /** 0..1 pull toward target per frame. Default `0.15`. */
  stiffness?: number
  /** 0..1 velocity retention per frame. Default `0.8`. */
  damping?: number
  /** Settle when |velocity| and |error| are below this. Default `0.01`. */
  precision?: number
  /** Jump immediately (also used under reduced motion). */
  hard?: boolean
}

export type Spring = Omit<Signal<number>, 'set' | 'update'> & {
  set(value: number, opts?: SpringOptions): void
  update(fn: (value: number) => number, opts?: SpringOptions): void
}

/**
 * Number signal that springs toward `set` targets with `requestAnimationFrame`.
 * Call during component init so in-flight frames are cancelled on destroy.
 */
export function spring(initial: number, defaults: SpringOptions = {}): Spring {
  const s = signal(initial)
  let displayed = initial
  let velocity = 0
  let to = initial
  let raf = 0
  let stiffness = defaults.stiffness ?? 0.15
  let damping = defaults.damping ?? 0.8
  let precision = defaults.precision ?? 0.01

  const cancel = () => {
    if (raf && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(raf)
    }
    raf = 0
  }

  const write = (value: number) => {
    displayed = value
    s.set(value)
  }

  const reducedMotion = () => {
    try {
      const g = globalThis as { matchMedia?: (q: string) => MediaQueryList }
      return (
        typeof g.matchMedia === 'function' &&
        g.matchMedia('(prefers-reduced-motion: reduce)').matches
      )
    } catch {
      return false
    }
  }

  const tick = () => {
    const error = to - displayed
    velocity += error * stiffness
    velocity *= damping
    const next = displayed + velocity
    if (Math.abs(velocity) < precision && Math.abs(error) < precision) {
      raf = 0
      velocity = 0
      write(to)
      return
    }
    write(next)
    raf = requestAnimationFrame(tick)
  }

  const set = (value: number, opts?: SpringOptions) => {
    cancel()
    to = value
    stiffness = opts?.stiffness ?? defaults.stiffness ?? 0.15
    damping = opts?.damping ?? defaults.damping ?? 0.8
    precision = opts?.precision ?? defaults.precision ?? 0.01
    const hard = opts?.hard === true || reducedMotion()
    if (hard || typeof requestAnimationFrame !== 'function') {
      velocity = 0
      write(value)
      return
    }
    raf = requestAnimationFrame(tick)
  }

  if (lifecycleStack) lifecycleStack.cleanups.push(cancel)

  return {
    get: () => s.get(),
    set,
    update(fn, opts) {
      set(fn(displayed), opts)
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal synced to `window.matchMedia(query)`.
 * Call during component init so the listener is removed on destroy.
 * SSR / non-DOM environments start as `false`.
 */
export function mediaQuery(query: string): Signal<boolean> {
  const canUse =
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { matchMedia?: (q: string) => MediaQueryList }).matchMedia ===
      'function'
  const mql = canUse
    ? (globalThis as { matchMedia: (q: string) => MediaQueryList }).matchMedia(query)
    : null
  const s = signal(mql ? mql.matches : false)
  if (mql) {
    const onChange = () => {
      s.set(mql.matches)
    }
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange)
    } else {
      ;(mql as MediaQueryList & { addListener: (cb: () => void) => void }).addListener(onChange)
    }
    const stop = () => {
      if (typeof mql.removeEventListener === 'function') {
        mql.removeEventListener('change', onChange)
      } else {
        ;(mql as MediaQueryList & { removeListener: (cb: () => void) => void }).removeListener(
          onChange,
        )
      }
    }
    if (lifecycleStack) lifecycleStack.cleanups.push(stop)
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('mediaQuery is read-only')
    },
    update() {
      throw new Error('mediaQuery is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/** Read-only signal for `(prefers-reduced-motion: reduce)`. Convenience over `mediaQuery`. */
export function prefersReducedMotion(): Signal<boolean> {
  return mediaQuery('(prefers-reduced-motion: reduce)')
}

export type ColorSchemePreference = 'light' | 'dark'

/**
 * Read-only signal for the user's color-scheme preference (`light` / `dark`).
 * Based on `(prefers-color-scheme: dark)`. Call during component init so the
 * listener is removed on destroy. SSR / non-DOM environments start as `'light'`.
 */
export function prefersColorScheme(): Signal<ColorSchemePreference> {
  const dark = mediaQuery('(prefers-color-scheme: dark)')
  return {
    get: () => (dark.get() ? 'dark' : 'light'),
    set() {
      throw new Error('prefersColorScheme is read-only')
    },
    update() {
      throw new Error('prefersColorScheme is read-only')
    },
    subscribe: (fn) =>
      dark.subscribe((matches) => {
        fn(matches ? 'dark' : 'light')
      }),
    toString: () => (dark.get() ? 'dark' : 'light'),
    valueOf: () => (dark.get() ? 'dark' : 'light'),
  }
}

/** Read-only signal for `(prefers-contrast: more)`. Convenience over `mediaQuery`. */
export function prefersContrast(): Signal<boolean> {
  return mediaQuery('(prefers-contrast: more)')
}

/** Read-only signal for `(prefers-reduced-transparency: reduce)`. Convenience over `mediaQuery`. */
export function prefersReducedTransparency(): Signal<boolean> {
  return mediaQuery('(prefers-reduced-transparency: reduce)')
}

/** Read-only signal for `(prefers-reduced-data: reduce)`. Convenience over `mediaQuery`. */
export function prefersReducedData(): Signal<boolean> {
  return mediaQuery('(prefers-reduced-data: reduce)')
}

type NetworkInformationLike = {
  saveData?: boolean
  effectiveType?: string
  downlink?: number
  rtt?: number
  addEventListener?: (type: string, listener: () => void) => void
  removeEventListener?: (type: string, listener: () => void) => void
}

function readSaveData(): boolean {
  try {
    const nav = (globalThis as { navigator?: Navigator & { connection?: NetworkInformationLike } })
      .navigator
    const conn = nav?.connection
    return !!conn?.saveData
  } catch {
    return false
  }
}

function readEffectiveType(): string {
  try {
    const nav = (globalThis as { navigator?: Navigator & { connection?: NetworkInformationLike } })
      .navigator
    const type = nav?.connection?.effectiveType
    return typeof type === 'string' ? type : ''
  } catch {
    return ''
  }
}

function readDownlink(): number {
  try {
    const nav = (globalThis as { navigator?: Navigator & { connection?: NetworkInformationLike } })
      .navigator
    const downlink = nav?.connection?.downlink
    return typeof downlink === 'number' && Number.isFinite(downlink) ? downlink : 0
  } catch {
    return 0
  }
}

function readRtt(): number {
  try {
    const nav = (globalThis as { navigator?: Navigator & { connection?: NetworkInformationLike } })
      .navigator
    const rtt = nav?.connection?.rtt
    return typeof rtt === 'number' && Number.isFinite(rtt) ? rtt : 0
  } catch {
    return 0
  }
}

function subscribeConnection(sync: () => void): void {
  try {
    const nav = (globalThis as { navigator?: Navigator & { connection?: NetworkInformationLike } })
      .navigator
    const conn = nav?.connection
    if (conn && typeof conn.addEventListener === 'function') {
      conn.addEventListener('change', sync)
      if (lifecycleStack) {
        lifecycleStack.cleanups.push(() => conn.removeEventListener?.('change', sync))
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * Read-only signal for `navigator.connection.saveData` (Network Information API).
 * Updates on the connection `change` event when available.
 * SSR / unsupported environments start as `false`.
 * Register during component init so the listener is removed on destroy.
 */
export function saveDataSignal(): Signal<boolean> {
  const s = signal(readSaveData())
  subscribeConnection(() => {
    s.set(readSaveData())
  })
  return {
    get: () => s.get(),
    set() {
      throw new Error('saveDataSignal is read-only')
    },
    update() {
      throw new Error('saveDataSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.connection.effectiveType` (`'4g'` / `'3g'` / `'2g'` / `'slow-2g'`).
 * Updates on the connection `change` event when available.
 * SSR / unsupported environments start as `''`.
 * Register during component init so the listener is removed on destroy.
 */
export function connectionEffectiveType(): Signal<string> {
  const s = signal(readEffectiveType())
  subscribeConnection(() => {
    s.set(readEffectiveType())
  })
  return {
    get: () => s.get(),
    set() {
      throw new Error('connectionEffectiveType is read-only')
    },
    update() {
      throw new Error('connectionEffectiveType is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.connection.downlink` (Mbps estimate).
 * Updates on the connection `change` event when available.
 * SSR / unsupported environments start as `0`.
 * Register during component init so the listener is removed on destroy.
 */
export function connectionDownlink(): Signal<number> {
  const s = signal(readDownlink())
  subscribeConnection(() => {
    s.set(readDownlink())
  })
  return {
    get: () => s.get(),
    set() {
      throw new Error('connectionDownlink is read-only')
    },
    update() {
      throw new Error('connectionDownlink is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.connection.rtt` (estimated round-trip time in ms).
 * Updates on the connection `change` event when available.
 * SSR / unsupported environments start as `0`.
 * Register during component init so the listener is removed on destroy.
 */
export function connectionRtt(): Signal<number> {
  const s = signal(readRtt())
  subscribeConnection(() => {
    s.set(readRtt())
  })
  return {
    get: () => s.get(),
    set() {
      throw new Error('connectionRtt is read-only')
    },
    update() {
      throw new Error('connectionRtt is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/** Read-only signal for `(forced-colors: active)`. Convenience over `mediaQuery`. */
export function forcedColors(): Signal<boolean> {
  return mediaQuery('(forced-colors: active)')
}

/** Read-only signal for `(inverted-colors: inverted)`. Convenience over `mediaQuery`. */
export function invertedColors(): Signal<boolean> {
  return mediaQuery('(inverted-colors: inverted)')
}

/** Clamp transition timing; returns `0` when the user prefers reduced motion. */
export function transitionMs(ms: number): number {
  try {
    const g = globalThis as { matchMedia?: (q: string) => MediaQueryList }
    if (typeof g.matchMedia === 'function' && g.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 0
    }
  } catch {
    /* ignore */
  }
  const n = Number(ms)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export type WindowSize = { width: number; height: number }

function readWindowSize(): WindowSize {
  const w = (globalThis as { window?: Window }).window
  if (!w || typeof w.innerWidth !== 'number') return { width: 0, height: 0 }
  return { width: w.innerWidth, height: w.innerHeight }
}

/**
 * Read-only signal of `window.innerWidth` / `innerHeight`.
 * Call during component init so the resize listener is removed on destroy.
 * SSR / non-DOM environments start as `{ width: 0, height: 0 }`.
 */
export function windowSize(): Signal<WindowSize> {
  const s = signal(readWindowSize())
  const w = (globalThis as { window?: Window }).window
  if (w && typeof w.addEventListener === 'function') {
    const sync = () => {
      const next = readWindowSize()
      s.update((cur) =>
        cur.width === next.width && cur.height === next.height ? cur : next,
      )
    }
    w.addEventListener('resize', sync)
    const stop = () => w.removeEventListener('resize', sync)
    if (lifecycleStack) lifecycleStack.cleanups.push(stop)
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('windowSize is read-only')
    },
    update() {
      throw new Error('windowSize is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => {
      const v = s.get()
      return `${v.width}x${v.height}`
    },
    valueOf: () => s.get(),
  }
}

export type PageScroll = { x: number; y: number }

function readPageScroll(): PageScroll {
  const w = (globalThis as { window?: Window }).window
  if (!w || typeof w.scrollX !== 'number') return { x: 0, y: 0 }
  return { x: w.scrollX, y: w.scrollY }
}

/**
 * Read-only signal of `window.scrollX` / `scrollY`.
 * Call during component init so the scroll listener is removed on destroy.
 * SSR / non-DOM environments start as `{ x: 0, y: 0 }`.
 */
export function pageScroll(): Signal<PageScroll> {
  const s = signal(readPageScroll())
  const w = (globalThis as { window?: Window }).window
  if (w && typeof w.addEventListener === 'function') {
    const sync = () => {
      const next = readPageScroll()
      s.update((cur) => (cur.x === next.x && cur.y === next.y ? cur : next))
    }
    w.addEventListener('scroll', sync, { passive: true })
    const stop = () => w.removeEventListener('scroll', sync)
    if (lifecycleStack) lifecycleStack.cleanups.push(stop)
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('pageScroll is read-only')
    },
    update() {
      throw new Error('pageScroll is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => {
      const v = s.get()
      return `${v.x},${v.y}`
    },
    valueOf: () => s.get(),
  }
}

function readDevicePixelRatio(): number {
  const w = (globalThis as { window?: Window }).window
  if (!w || typeof w.devicePixelRatio !== 'number') return 1
  return w.devicePixelRatio
}

/**
 * Read-only signal of `window.devicePixelRatio`.
 * Call during component init so the resize listener is removed on destroy.
 * SSR / non-DOM environments start as `1`.
 */
export function devicePixelRatio(): Signal<number> {
  const s = signal(readDevicePixelRatio())
  const w = (globalThis as { window?: Window }).window
  if (w && typeof w.addEventListener === 'function') {
    const sync = () => {
      const next = readDevicePixelRatio()
      s.update((cur) => (cur === next ? cur : next))
    }
    // DPR changes are uncommon; resize covers zoom / monitor moves in many browsers.
    w.addEventListener('resize', sync)
    const stop = () => w.removeEventListener('resize', sync)
    if (lifecycleStack) lifecycleStack.cleanups.push(stop)
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('devicePixelRatio is read-only')
    },
    update() {
      throw new Error('devicePixelRatio is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

function getWebStorage(kind: 'local' | 'session'): Storage | undefined {
  try {
    const g = globalThis as { localStorage?: Storage; sessionStorage?: Storage }
    return kind === 'session' ? g.sessionStorage : g.localStorage
  } catch {
    return undefined
  }
}

function readWebStorage<T>(kind: 'local' | 'session', key: string, fallback: T): T {
  try {
    const store = getWebStorage(kind)
    if (!store) return fallback
    const raw = store.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeWebStorage(kind: 'local' | 'session', key: string, value: unknown): void {
  try {
    const store = getWebStorage(kind)
    if (!store) return
    store.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / private mode */
  }
}

export type PersistedSignalOptions = {
  /** Default `'local'`. Use `'session'` for `sessionStorage` (tab-scoped). */
  storage?: 'local' | 'session'
}

/**
 * Signal persisted under `key` as JSON (`localStorage` by default, or `sessionStorage`).
 * SSR / missing storage uses `fallback`. Cross-tab `storage` events sync for `local` storage
 * when available; register during component init so the listener is removed on destroy.
 */
export function persistedSignal<T>(
  key: string,
  fallback: T,
  opts?: PersistedSignalOptions,
): Signal<T> {
  const kind = opts?.storage === 'session' ? 'session' : 'local'
  const s = signal(readWebStorage(kind, key, fallback))
  const persist = (value: T) => {
    s.set(value)
    writeWebStorage(kind, key, value)
  }
  if (
    kind === 'local' &&
    typeof window !== 'undefined' &&
    typeof window.addEventListener === 'function'
  ) {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || event.storageArea !== window.localStorage) return
      if (event.newValue == null) {
        s.set(fallback)
        return
      }
      try {
        s.set(JSON.parse(event.newValue) as T)
      } catch {
        s.set(fallback)
      }
    }
    window.addEventListener('storage', onStorage)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => window.removeEventListener('storage', onStorage))
    }
  }
  return {
    get: () => s.get(),
    set: persist,
    update(fn) {
      persist(fn(s.get()))
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.onLine`, updated on `online` / `offline`.
 * SSR / non-DOM defaults to `true`. Register during component init for cleanup.
 */
export function onlineSignal(): Signal<boolean> {
  const nav = (globalThis as { navigator?: Navigator }).navigator
  const initial = typeof nav?.onLine === 'boolean' ? nav.onLine : true
  const s = signal(initial)
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      s.set(typeof navigator.onLine === 'boolean' ? navigator.onLine : true)
    }
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        window.removeEventListener('online', sync)
        window.removeEventListener('offline', sync)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('onlineSignal is read-only')
    },
    update() {
      throw new Error('onlineSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

export type NowSignalOptions = {
  /** Tick interval in milliseconds. Default `1000`. */
  interval?: number
}

/**
 * Read-only signal of `Date.now()`, updated on an interval (default 1s).
 * SSR / non-DOM starts with the current epoch ms once.
 * Register during component init so the timer is cleared on destroy.
 */
export function nowSignal(opts?: NowSignalOptions): Signal<number> {
  const interval =
    opts?.interval != null && Number.isFinite(Number(opts.interval)) && Number(opts.interval) > 0
      ? Number(opts.interval)
      : 1000
  const s = signal(Date.now())
  if (typeof setInterval === 'function') {
    const id = setInterval(() => {
      s.set(Date.now())
    }, interval)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => clearInterval(id))
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('nowSignal is read-only')
    },
    update() {
      throw new Error('nowSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

export type IdleSignalOptions = {
  /** Milliseconds without activity before idle. Default `60_000`. */
  timeout?: number
  /** Activity event names on `window`. */
  events?: string[]
}

const defaultIdleEvents = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
] as const

/**
 * Read-only signal that becomes `true` after `timeout` ms without user activity.
 * SSR / non-DOM starts as `false`. Register during component init so listeners/timers are cleared on destroy.
 */
export function idleSignal(opts?: IdleSignalOptions): Signal<boolean> {
  const timeout =
    opts?.timeout != null && Number.isFinite(Number(opts.timeout)) && Number(opts.timeout) > 0
      ? Number(opts.timeout)
      : 60_000
  const events = opts?.events?.length ? opts.events : [...defaultIdleEvents]
  const s = signal(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  const arm = () => {
    if (timer != null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      s.set(true)
    }, timeout)
  }

  const onActivity = () => {
    if (s.get()) s.set(false)
    arm()
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    for (const type of events) {
      window.addEventListener(type, onActivity, { passive: true })
    }
    arm()
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        for (const type of events) {
          window.removeEventListener(type, onActivity)
        }
        if (timer != null) clearTimeout(timer)
      })
    }
  }

  return {
    get: () => s.get(),
    set() {
      throw new Error('idleSignal is read-only')
    },
    update() {
      throw new Error('idleSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.language`, updated on `languagechange`.
 * SSR / non-DOM starts as `''`. Register during component init so the listener is removed on destroy.
 */
export function localeSignal(): Signal<string> {
  const read = () => {
    try {
      const lang = (globalThis as { navigator?: Navigator }).navigator?.language
      return typeof lang === 'string' ? lang : ''
    } catch {
      return ''
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      s.set(read())
    }
    window.addEventListener('languagechange', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => window.removeEventListener('languagechange', sync))
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('localeSignal is read-only')
    },
    update() {
      throw new Error('localeSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.languages` (preferred locales, most preferred first).
 * Updated on `languagechange`. SSR / non-DOM starts as `[]`.
 * Register during component init so the listener is removed on destroy.
 */
export function localesSignal(): Signal<readonly string[]> {
  const read = (): readonly string[] => {
    try {
      const langs = (globalThis as { navigator?: Navigator }).navigator?.languages
      if (!langs || typeof langs.length !== 'number') return []
      return Array.from(langs)
    } catch {
      return []
    }
  }
  const s = signal<readonly string[]>(read())
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      s.set(read())
    }
    window.addEventListener('languagechange', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => window.removeEventListener('languagechange', sync))
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('localesSignal is read-only')
    },
    update() {
      throw new Error('localesSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for the host IANA time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
 * Re-reads on `visibilitychange` / `focus` (no dedicated timezonechange event).
 * SSR / non-DOM starts as `''`. Register during component init so listeners are removed on destroy.
 */
export function timeZoneSignal(): Signal<string> {
  const read = () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      return typeof tz === 'string' ? tz : ''
    } catch {
      return ''
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      s.set(read())
    }
    window.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        window.removeEventListener('visibilitychange', sync)
        window.removeEventListener('focus', sync)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('timeZoneSignal is read-only')
    },
    update() {
      throw new Error('timeZoneSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.hardwareConcurrency` (logical CPU cores).
 * Re-reads on `visibilitychange` / `focus` (no dedicated change event).
 * SSR / non-DOM starts as `0`. Register during component init so listeners are removed on destroy.
 */
export function hardwareConcurrencySignal(): Signal<number> {
  const read = () => {
    try {
      const n = (globalThis as { navigator?: Navigator }).navigator?.hardwareConcurrency
      return typeof n === 'number' && Number.isFinite(n) ? n : 0
    } catch {
      return 0
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      const next = read()
      s.update((cur) => (cur === next ? cur : next))
    }
    window.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        window.removeEventListener('visibilitychange', sync)
        window.removeEventListener('focus', sync)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('hardwareConcurrencySignal is read-only')
    },
    update() {
      throw new Error('hardwareConcurrencySignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.deviceMemory` (approximate device RAM in GiB).
 * Re-reads on `visibilitychange` / `focus` (no dedicated change event).
 * SSR / unsupported hosts start as `0`. Register during component init so listeners are removed on destroy.
 */
export function deviceMemorySignal(): Signal<number> {
  const read = () => {
    try {
      const n = (globalThis as { navigator?: Navigator & { deviceMemory?: number } }).navigator
        ?.deviceMemory
      return typeof n === 'number' && Number.isFinite(n) ? n : 0
    } catch {
      return 0
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      const next = read()
      s.update((cur) => (cur === next ? cur : next))
    }
    window.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        window.removeEventListener('visibilitychange', sync)
        window.removeEventListener('focus', sync)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('deviceMemorySignal is read-only')
    },
    update() {
      throw new Error('deviceMemorySignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.userAgent`.
 * Re-reads on `visibilitychange` / `focus` (no dedicated change event).
 * SSR / non-DOM starts as `''`. Register during component init so listeners are removed on destroy.
 */
export function userAgentSignal(): Signal<string> {
  const read = () => {
    try {
      const ua = (globalThis as { navigator?: Navigator }).navigator?.userAgent
      return typeof ua === 'string' ? ua : ''
    } catch {
      return ''
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      const next = read()
      s.update((cur) => (cur === next ? cur : next))
    }
    window.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        window.removeEventListener('visibilitychange', sync)
        window.removeEventListener('focus', sync)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('userAgentSignal is read-only')
    },
    update() {
      throw new Error('userAgentSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.doNotTrack`, normalized to `'1' | '0' | 'unspecified'`.
 * Re-reads on `visibilitychange` / `focus` (no dedicated change event).
 * SSR / non-DOM starts as `'unspecified'`. Register during component init so listeners are removed on destroy.
 */
export function doNotTrackSignal(): Signal<'1' | '0' | 'unspecified'> {
  const read = (): '1' | '0' | 'unspecified' => {
    try {
      const raw = (globalThis as { navigator?: Navigator }).navigator?.doNotTrack
      if (raw === '1' || raw === 'yes') return '1'
      if (raw === '0' || raw === 'no') return '0'
      return 'unspecified'
    } catch {
      return 'unspecified'
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      const next = read()
      s.update((cur) => (cur === next ? cur : next))
    }
    window.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        window.removeEventListener('visibilitychange', sync)
        window.removeEventListener('focus', sync)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('doNotTrackSignal is read-only')
    },
    update() {
      throw new Error('doNotTrackSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.vendor`.
 * Re-reads on `visibilitychange` / `focus` (no dedicated change event).
 * SSR / non-DOM starts as `''`. Register during component init so listeners are removed on destroy.
 */
export function vendorSignal(): Signal<string> {
  const read = () => {
    try {
      const v = (globalThis as { navigator?: Navigator }).navigator?.vendor
      return typeof v === 'string' ? v : ''
    } catch {
      return ''
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      const next = read()
      s.update((cur) => (cur === next ? cur : next))
    }
    window.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        window.removeEventListener('visibilitychange', sync)
        window.removeEventListener('focus', sync)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('vendorSignal is read-only')
    },
    update() {
      throw new Error('vendorSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.appVersion`.
 * Re-reads on `visibilitychange` / `focus` (no dedicated change event).
 * SSR / non-DOM starts as `''`. Register during component init so listeners are removed on destroy.
 */
export function appVersionSignal(): Signal<string> {
  const read = () => {
    try {
      const v = (globalThis as { navigator?: Navigator }).navigator?.appVersion
      return typeof v === 'string' ? v : ''
    } catch {
      return ''
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      const next = read()
      s.update((cur) => (cur === next ? cur : next))
    }
    window.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        window.removeEventListener('visibilitychange', sync)
        window.removeEventListener('focus', sync)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('appVersionSignal is read-only')
    },
    update() {
      throw new Error('appVersionSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.product`.
 * Re-reads on `visibilitychange` / `focus` (no dedicated change event).
 * SSR / non-DOM starts as `''`. Register during component init so listeners are removed on destroy.
 */
export function productSignal(): Signal<string> {
  const read = () => {
    try {
      const v = (globalThis as { navigator?: Navigator }).navigator?.product
      return typeof v === 'string' ? v : ''
    } catch {
      return ''
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      const next = read()
      s.update((cur) => (cur === next ? cur : next))
    }
    window.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        window.removeEventListener('visibilitychange', sync)
        window.removeEventListener('focus', sync)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('productSignal is read-only')
    },
    update() {
      throw new Error('productSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.appName`.
 * Re-reads on `visibilitychange` / `focus` (no dedicated change event).
 * SSR / non-DOM starts as `''`. Register during component init so listeners are removed on destroy.
 */
export function appNameSignal(): Signal<string> {
  const read = () => {
    try {
      const v = (globalThis as { navigator?: Navigator }).navigator?.appName
      return typeof v === 'string' ? v : ''
    } catch {
      return ''
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      const next = read()
      s.update((cur) => (cur === next ? cur : next))
    }
    window.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        window.removeEventListener('visibilitychange', sync)
        window.removeEventListener('focus', sync)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('appNameSignal is read-only')
    },
    update() {
      throw new Error('appNameSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.platform`.
 * Re-reads on `visibilitychange` / `focus` (no dedicated change event).
 * SSR / non-DOM starts as `''`. Register during component init so listeners are removed on destroy.
 */
export function platformSignal(): Signal<string> {
  const read = () => {
    try {
      const v = (globalThis as { navigator?: Navigator }).navigator?.platform
      return typeof v === 'string' ? v : ''
    } catch {
      return ''
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      const next = read()
      s.update((cur) => (cur === next ? cur : next))
    }
    window.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        window.removeEventListener('visibilitychange', sync)
        window.removeEventListener('focus', sync)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('platformSignal is read-only')
    },
    update() {
      throw new Error('platformSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.appCodeName`.
 * Re-reads on `visibilitychange` / `focus` (no dedicated change event).
 * SSR / non-DOM starts as `''`. Register during component init so listeners are removed on destroy.
 */
export function appCodeNameSignal(): Signal<string> {
  const read = () => {
    try {
      const v = (globalThis as { navigator?: Navigator }).navigator?.appCodeName
      return typeof v === 'string' ? v : ''
    } catch {
      return ''
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      const next = read()
      s.update((cur) => (cur === next ? cur : next))
    }
    window.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        window.removeEventListener('visibilitychange', sync)
        window.removeEventListener('focus', sync)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('appCodeNameSignal is read-only')
    },
    update() {
      throw new Error('appCodeNameSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.maxTouchPoints`.
 * Re-reads on `visibilitychange` / `focus` (no dedicated change event).
 * SSR / non-DOM starts as `0`. Register during component init so listeners are removed on destroy.
 */
export function maxTouchPointsSignal(): Signal<number> {
  const read = () => {
    try {
      const n = (globalThis as { navigator?: Navigator }).navigator?.maxTouchPoints
      return typeof n === 'number' && Number.isFinite(n) ? n : 0
    } catch {
      return 0
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      const next = read()
      s.update((cur) => (cur === next ? cur : next))
    }
    window.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        window.removeEventListener('visibilitychange', sync)
        window.removeEventListener('focus', sync)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('maxTouchPointsSignal is read-only')
    },
    update() {
      throw new Error('maxTouchPointsSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.cookieEnabled`.
 * Re-reads on `visibilitychange` / `focus` (no dedicated change event).
 * SSR / non-DOM starts as `false`. Register during component init so listeners are removed on destroy.
 */
export function cookieEnabledSignal(): Signal<boolean> {
  const read = () => {
    try {
      return Boolean((globalThis as { navigator?: Navigator }).navigator?.cookieEnabled)
    } catch {
      return false
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      const next = read()
      s.update((cur) => (cur === next ? cur : next))
    }
    window.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        window.removeEventListener('visibilitychange', sync)
        window.removeEventListener('focus', sync)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('cookieEnabledSignal is read-only')
    },
    update() {
      throw new Error('cookieEnabledSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.pdfViewerEnabled`.
 * Re-reads on `visibilitychange` / `focus` (no dedicated change event).
 * SSR / missing API starts as `false`. Register during component init so listeners are removed on destroy.
 */
export function pdfViewerEnabledSignal(): Signal<boolean> {
  const read = () => {
    try {
      const nav = (globalThis as { navigator?: Navigator & { pdfViewerEnabled?: boolean } }).navigator
      return Boolean(nav?.pdfViewerEnabled)
    } catch {
      return false
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      const next = read()
      s.update((cur) => (cur === next ? cur : next))
    }
    window.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        window.removeEventListener('visibilitychange', sync)
        window.removeEventListener('focus', sync)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('pdfViewerEnabledSignal is read-only')
    },
    update() {
      throw new Error('pdfViewerEnabledSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.webdriver` (automation / controlled browser).
 * Re-reads on `visibilitychange` / `focus` (no dedicated change event).
 * SSR / non-DOM starts as `false`. Register during component init so listeners are removed on destroy.
 */
export function webdriverSignal(): Signal<boolean> {
  const read = () => {
    try {
      return Boolean((globalThis as { navigator?: Navigator }).navigator?.webdriver)
    } catch {
      return false
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      const next = read()
      s.update((cur) => (cur === next ? cur : next))
    }
    window.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        window.removeEventListener('visibilitychange', sync)
        window.removeEventListener('focus', sync)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('webdriverSignal is read-only')
    },
    update() {
      throw new Error('webdriverSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

export type StorageEstimate = {
  usage: number
  quota: number
}

/**
 * Read-only signal for `navigator.storage.estimate()` (`usage` / `quota` bytes).
 * Starts as `null` until the promise resolves; refreshes on `visibilitychange` / `focus`.
 * SSR / missing API stays `null`. Register during component init so listeners are removed on destroy.
 */
export function storageEstimateSignal(): Signal<StorageEstimate | null> {
  const s = signal<StorageEstimate | null>(null)
  let generation = 0

  const refresh = () => {
    try {
      const storage = (globalThis as { navigator?: Navigator }).navigator?.storage as
        | { estimate?: () => Promise<{ usage?: number; quota?: number }> }
        | undefined
      if (!storage || typeof storage.estimate !== 'function') return
      const gen = ++generation
      storage
        .estimate()
        .then((est) => {
          if (gen !== generation) return
          s.set({
            usage: typeof est.usage === 'number' && Number.isFinite(est.usage) ? est.usage : 0,
            quota: typeof est.quota === 'number' && Number.isFinite(est.quota) ? est.quota : 0,
          })
        })
        .catch(() => {})
    } catch {
      /* ignore */
    }
  }

  refresh()
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        generation++
        window.removeEventListener('visibilitychange', refresh)
        window.removeEventListener('focus', refresh)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('storageEstimateSignal is read-only')
    },
    update() {
      throw new Error('storageEstimateSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `navigator.storage.persisted()`.
 * Starts as `null` until the promise resolves; refreshes on `visibilitychange` / `focus`.
 * SSR / missing API stays `null`. Register during component init so listeners are removed on destroy.
 */
export function storagePersistedSignal(): Signal<boolean | null> {
  const s = signal<boolean | null>(null)
  let generation = 0

  const refresh = () => {
    try {
      const storage = (globalThis as { navigator?: Navigator }).navigator?.storage as
        | { persisted?: () => Promise<boolean> }
        | undefined
      if (!storage || typeof storage.persisted !== 'function') return
      const gen = ++generation
      storage
        .persisted()
        .then((value) => {
          if (gen !== generation) return
          s.set(Boolean(value))
        })
        .catch(() => {})
    } catch {
      /* ignore */
    }
  }

  refresh()
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        generation++
        window.removeEventListener('visibilitychange', refresh)
        window.removeEventListener('focus', refresh)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('storagePersistedSignal is read-only')
    },
    update() {
      throw new Error('storagePersistedSignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Signal synced with `location.hash` (including the leading `#`, or `''`).
 * Writes update `location.hash`. SSR / non-DOM starts as `''`.
 * Register during component init so the `hashchange` listener is removed on destroy.
 */
export function hashSignal(): Signal<string> {
  const read = () => {
    try {
      const hash = (globalThis as { location?: Location }).location?.hash
      return typeof hash === 'string' ? hash : ''
    } catch {
      return ''
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const sync = () => {
      s.set(read())
    }
    window.addEventListener('hashchange', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => window.removeEventListener('hashchange', sync))
    }
  }
  return {
    get: () => s.get(),
    set(next) {
      const value = String(next ?? '')
      s.set(value)
      try {
        if (typeof window !== 'undefined' && window.location && window.location.hash !== value) {
          window.location.hash = value
        }
      } catch {
        /* ignore */
      }
    },
    update(fn) {
      this.set(fn(s.get()))
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Signal synced with `location.search` (including the leading `?`, or `''`).
 * Writes use `history.replaceState` (no reload). SSR / non-DOM starts as `''`.
 * Register during component init so history listeners are removed on destroy.
 */
export function searchParamsSignal(): Signal<string> {
  const read = () => {
    try {
      const search = (globalThis as { location?: Location }).location?.search
      return typeof search === 'string' ? search : ''
    } catch {
      return ''
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined') {
    const stop = subscribeHistory(() => {
      s.set(read())
    })
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(stop)
    }
  }
  return {
    get: () => s.get(),
    set(next) {
      let value = String(next ?? '')
      if (value && !value.startsWith('?')) value = `?${value}`
      s.set(value)
      try {
        if (typeof window === 'undefined' || !window.location || !window.history?.replaceState) return
        if (window.location.search === value) return
        const url = new URL(window.location.href)
        url.search = value
        window.history.replaceState(window.history.state, '', url)
      } catch {
        /* ignore */
      }
    },
    update(fn) {
      this.set(fn(s.get()))
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

type HistoryListener = () => void
const historyListeners = new Set<HistoryListener>()
let historyPatched = false

function ensureHistoryPatch() {
  if (historyPatched) return
  if (typeof window === 'undefined' || !window.history) return
  historyPatched = true
  const hist = window.history
  const notify = () => {
    for (const listener of historyListeners) listener()
  }
  const origPush = hist.pushState.bind(hist)
  const origReplace = hist.replaceState.bind(hist)
  hist.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
    const result = origPush(data, unused, url)
    notify()
    return result
  }) as History['pushState']
  hist.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
    const result = origReplace(data, unused, url)
    notify()
    return result
  }) as History['replaceState']
  window.addEventListener('popstate', notify)
}

function subscribeHistory(listener: HistoryListener): () => void {
  ensureHistoryPatch()
  historyListeners.add(listener)
  return () => {
    historyListeners.delete(listener)
  }
}

/**
 * Signal synced with `location.pathname`.
 * Writes use `history.pushState` (SPA-friendly). SSR / non-DOM starts as `'/'`.
 * Register during component init so history listeners are removed on destroy.
 */
export function pathnameSignal(): Signal<string> {
  const read = () => {
    try {
      const pathname = (globalThis as { location?: Location }).location?.pathname
      return typeof pathname === 'string' && pathname ? pathname : '/'
    } catch {
      return '/'
    }
  }
  const s = signal(read())
  if (typeof window !== 'undefined') {
    const stop = subscribeHistory(() => {
      s.set(read())
    })
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(stop)
    }
  }
  return {
    get: () => s.get(),
    set(next) {
      let value = String(next ?? '/')
      if (!value.startsWith('/')) value = `/${value}`
      s.set(value)
      try {
        if (typeof window === 'undefined' || !window.location || !window.history?.pushState) return
        if (window.location.pathname === value) return
        const url = new URL(window.location.href)
        url.pathname = value
        window.history.pushState(window.history.state, '', url)
      } catch {
        /* ignore */
      }
    },
    update(fn) {
      this.set(fn(s.get()))
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Signal synced with `document.title`.
 * Writes update `document.title`. SSR / non-DOM starts as `''`.
 * Register during component init so the title observer is removed on destroy.
 */
export function documentTitleSignal(): Signal<string> {
  const read = () => {
    try {
      const title = (globalThis as { document?: Document }).document?.title
      return typeof title === 'string' ? title : ''
    } catch {
      return ''
    }
  }
  const s = signal(read())
  const doc = (globalThis as { document?: Document }).document
  if (doc && typeof MutationObserver === 'function') {
    const sync = () => {
      s.set(read())
    }
    const observer = new MutationObserver(sync)
    const titleEl = doc.querySelector('title')
    if (titleEl) {
      observer.observe(titleEl, { childList: true, characterData: true, subtree: true })
    } else if (doc.head) {
      observer.observe(doc.head, { childList: true, subtree: true })
    }
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => observer.disconnect())
    }
  }
  return {
    get: () => s.get(),
    set(next) {
      const value = String(next ?? '')
      s.set(value)
      try {
        const d = (globalThis as { document?: Document }).document
        if (d && d.title !== value) d.title = value
      } catch {
        /* ignore */
      }
    },
    update(fn) {
      this.set(fn(s.get()))
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Signal synced with `document.documentElement.lang`.
 * Writes update the `<html lang>` attribute. SSR / non-DOM starts as `''`.
 * Register during component init so the attribute observer is removed on destroy.
 */
export function htmlLangSignal(): Signal<string> {
  const read = () => {
    try {
      const lang = (globalThis as { document?: Document }).document?.documentElement?.lang
      return typeof lang === 'string' ? lang : ''
    } catch {
      return ''
    }
  }
  const s = signal(read())
  const doc = (globalThis as { document?: Document }).document
  const root = doc?.documentElement
  if (root && typeof MutationObserver === 'function') {
    const sync = () => {
      s.set(read())
    }
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['lang'] })
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => observer.disconnect())
    }
  }
  return {
    get: () => s.get(),
    set(next) {
      const value = String(next ?? '')
      s.set(value)
      try {
        const el = (globalThis as { document?: Document }).document?.documentElement
        if (el && el.lang !== value) el.lang = value
      } catch {
        /* ignore */
      }
    },
    update(fn) {
      this.set(fn(s.get()))
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Signal synced with `document.documentElement.dir`.
 * Writes update the `<html dir>` attribute (`'ltr'` / `'rtl'` / `''`).
 * SSR / non-DOM starts as `''`.
 * Register during component init so the attribute observer is removed on destroy.
 */
export function htmlDirSignal(): Signal<string> {
  const read = () => {
    try {
      const dir = (globalThis as { document?: Document }).document?.documentElement?.dir
      return typeof dir === 'string' ? dir : ''
    } catch {
      return ''
    }
  }
  const s = signal(read())
  const doc = (globalThis as { document?: Document }).document
  const root = doc?.documentElement
  if (root && typeof MutationObserver === 'function') {
    const sync = () => {
      s.set(read())
    }
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['dir'] })
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => observer.disconnect())
    }
  }
  return {
    get: () => s.get(),
    set(next) {
      const value = String(next ?? '')
      s.set(value)
      try {
        const el = (globalThis as { document?: Document }).document?.documentElement
        if (el && el.dir !== value) el.dir = value
      } catch {
        /* ignore */
      }
    },
    update(fn) {
      this.set(fn(s.get()))
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `document.visibilityState`, updated on `visibilitychange`.
 * SSR / non-DOM defaults to `'visible'`. Register during component init for cleanup.
 */
export function visibilitySignal(): Signal<DocumentVisibilityState> {
  const doc = (globalThis as { document?: Document }).document
  const initial: DocumentVisibilityState =
    doc && typeof doc.visibilityState === 'string' ? doc.visibilityState : 'visible'
  const s = signal(initial)
  if (doc && typeof doc.addEventListener === 'function') {
    const sync = () => {
      s.set(doc.visibilityState)
    }
    doc.addEventListener('visibilitychange', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => doc.removeEventListener('visibilitychange', sync))
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('visibilitySignal is read-only')
    },
    update() {
      throw new Error('visibilitySignal is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/**
 * Read-only signal for `document.activeElement`, updated on `focusin` / `focusout`.
 * SSR / non-DOM defaults to `null`. Register during component init for cleanup.
 */
export function activeElement(): Signal<Element | null> {
  const doc = (globalThis as { document?: Document }).document
  const read = (): Element | null => {
    const el = doc?.activeElement
    return el && (el as Node).nodeType === 1 ? (el as Element) : null
  }
  const s = signal<Element | null>(read())
  if (doc && typeof doc.addEventListener === 'function') {
    const sync = () => {
      s.set(read())
    }
    doc.addEventListener('focusin', sync)
    doc.addEventListener('focusout', sync)
    if (lifecycleStack) {
      lifecycleStack.cleanups.push(() => {
        doc.removeEventListener('focusin', sync)
        doc.removeEventListener('focusout', sync)
      })
    }
  }
  return {
    get: () => s.get(),
    set() {
      throw new Error('activeElement is read-only')
    },
    update() {
      throw new Error('activeElement is read-only')
    },
    subscribe: (fn) => s.subscribe(fn),
    toString: () => String(s.get()),
    valueOf: () => s.get(),
  }
}

/** Event object passed to `on:name` handlers from `createEventDispatcher`. */
export type ComponentEvent<T = unknown> = {
  type: string
  detail: T
}

/**
 * Dispatch component events to parent `on:name` handlers (compiled as `onname` props).
 * Prefer the zero-arg form `createEventDispatcher()` in `.ave` scripts — the compiler
 * rewrites it to `createEventDispatcher(__props)` so updates keep working.
 */
export function createEventDispatcher(
  props: Record<string, unknown>,
): <T = unknown>(type: string, detail?: T) => void {
  return function dispatch<T = unknown>(type: string, detail?: T) {
    const handler = props[`on${type}`]
    if (typeof handler === 'function') {
      ;(handler as (event: ComponentEvent<T | undefined>) => void)({ type, detail })
    }
  }
}

type MountHook = () => void | (() => void)

type LifecycleFrame = {
  mounts: MountHook[]
  cleanups: Array<() => void>
}

let lifecycleStack: LifecycleFrame | null = null

/** Compiler: call at the start of `mount()` with the component `__cleanups` array. */
export function __lifecycleBegin(cleanups: Array<() => void>) {
  lifecycleStack = { mounts: [], cleanups }
}

/** Compiler: call after init; schedules `onMount` callbacks on a microtask. */
export function __lifecycleEnd() {
  const frame = lifecycleStack
  lifecycleStack = null
  if (!frame) return
  queueMicrotask(() => {
    for (const fn of frame.mounts) {
      const cleanup = fn()
      if (typeof cleanup === 'function') frame.cleanups.push(cleanup)
    }
  })
}

/**
 * Run after the component mounts (microtask). May return a cleanup called on destroy.
 * Only schedules work during client `mount()` init; no-op during SSR.
 */
export function onMount(fn: MountHook) {
  if (!lifecycleStack) return
  lifecycleStack.mounts.push(fn)
}

/**
 * Register a callback for component destroy.
 * Only registers during client `mount()` init; no-op during SSR.
 */
export function onDestroy(fn: () => void) {
  if (!lifecycleStack) return
  lifecycleStack.cleanups.push(fn)
}

/**
 * Set `document.title` during client mount init; restore the previous title on destroy.
 * Pass a string, or a getter (tracked via `effect` when it reads signals). No-op during SSR.
 */
export function pageTitle(title: string | (() => string)) {
  if (!lifecycleStack) return
  const doc = (globalThis as { document?: Document }).document
  if (!doc) return
  const prev = doc.title
  if (typeof title === 'function') {
    const stop = effect(() => {
      doc.title = title()
    })
    lifecycleStack.cleanups.push(() => {
      stop()
      doc.title = prev
    })
  } else {
    doc.title = title
    lifecycleStack.cleanups.push(() => {
      doc.title = prev
    })
  }
}

type UpdateHooksFrame = {
  before: Array<() => void>
  after: Array<() => void>
}

let updateHooksFrame: UpdateHooksFrame | null = null

/** Bind beforeUpdate/afterUpdate registration to the current mount's hook lists. */
export function __updateHooksBegin(before: Array<() => void>, after: Array<() => void>) {
  updateHooksFrame = { before, after }
}

export function __updateHooksEnd() {
  updateHooksFrame = null
}

/**
 * Run before the DOM is updated (not before the initial render).
 * No-op during SSR / outside mount init.
 */
export function beforeUpdate(fn: () => void) {
  if (!updateHooksFrame) return
  updateHooksFrame.before.push(fn)
}

/**
 * Run after the DOM is updated (including once after the initial render).
 * No-op during SSR / outside mount init.
 */
export function afterUpdate(fn: () => void) {
  if (!updateHooksFrame) return
  updateHooksFrame.after.push(fn)
}

type ContextMap = Map<unknown, unknown>
const contextStack: ContextMap[] = []

/**
 * Push a context frame for the current component instance.
 * Returns an end function (also register it on mount cleanups).
 */
export function __contextBegin(): () => void {
  const map: ContextMap = new Map()
  contextStack.push(map)
  return () => {
    const i = contextStack.lastIndexOf(map)
    if (i !== -1) contextStack.splice(i, 1)
  }
}

/** Set a context value for child components (init / SSR render only). */
export function setContext<T>(key: unknown, value: T): void {
  const map = contextStack[contextStack.length - 1]
  if (!map) {
    throw new Error('setContext(...) can only be called during component initialization')
  }
  map.set(key, value)
}

/** Read a context value from this component or an ancestor. */
export function getContext<T>(key: unknown): T {
  for (let i = contextStack.length - 1; i >= 0; i--) {
    const map = contextStack[i]!
    if (map.has(key)) return map.get(key) as T
  }
  throw new Error('Context not found')
}

/** Whether `key` is present on this component or an ancestor. */
export function hasContext(key: unknown): boolean {
  for (let i = contextStack.length - 1; i >= 0; i--) {
    if (contextStack[i]!.has(key)) return true
  }
  return false
}

/**
 * Snapshot of all context key/value pairs from ancestors and this component.
 * Later (child) entries overwrite earlier ones for the same key.
 * Only valid during component initialization.
 */
export function getAllContexts(): Map<unknown, unknown> {
  if (!contextStack.length) {
    throw new Error('getAllContexts(...) can only be called during component initialization')
  }
  const out = new Map<unknown, unknown>()
  for (const map of contextStack) {
    for (const [k, v] of map) out.set(k, v)
  }
  return out
}

/**
 * Resolve after pending component DOM updates.
 * Compiled event handlers schedule `__invalidate` on a microtask; `tick` waits one
 * extra microtask so `await tick()` sees the flushed DOM even when called before
 * the listener's trailing `__invalidate()`.
 */
export function tick(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(() => {
      queueMicrotask(resolve)
    })
  })
}

export type PortalTarget = ParentNode | string | null | undefined

function resolvePortalTarget(target: PortalTarget, node?: Element): ParentNode | null {
  if (target == null) return null
  if (typeof target !== 'string') return target
  // Prefer the current mount tree (soft-hydrate builds into a detached holder first).
  if (node) {
    let root: Node = node
    while (root.parentNode) root = root.parentNode
    if (typeof (root as ParentNode).querySelector === 'function') {
      const found = (root as ParentNode).querySelector(target)
      if (found) return found
    }
  }
  const doc = (globalThis as { document?: Document }).document
  if (!doc || typeof doc.querySelector !== 'function') return null
  return doc.querySelector(target)
}

/**
 * `use:` action that moves `node` into `target` (Element, or a CSS selector string).
 * Default target is `'body'`. Call during client mount; SSR ignores `use:`.
 */
export function portal(node: Element, target: PortalTarget = 'body') {
  const move = (next: PortalTarget) => {
    const host = resolvePortalTarget(next, node)
    if (!host || node.parentNode === host) return
    host.appendChild(node)
  }
  move(target)
  return {
    update(next: PortalTarget) {
      move(next)
    },
    destroy() {
      node.remove()
    },
  }
}

export type ClickOutsideHandler = (event: Event) => void

/**
 * `use:` action that calls `handler` on pointerdown outside `node` (capture phase).
 * Pass `null`/`undefined` to disable without destroying the listener.
 */
export function clickOutside(node: Element, handler?: ClickOutsideHandler | null) {
  const doc = (globalThis as { document?: Document }).document
  if (!doc || typeof doc.addEventListener !== 'function') {
    return {
      update(_next?: ClickOutsideHandler | null) {},
      destroy() {},
    }
  }
  let current: ClickOutsideHandler | null | undefined = handler
  const onPointerDown = (event: Event) => {
    if (!current) return
    const t = event.target as { nodeType?: number } | null
    if (!t || typeof t.nodeType !== 'number') return
    if (node.contains(t as Node)) return
    current(event)
  }
  doc.addEventListener('pointerdown', onPointerDown, true)
  return {
    update(next?: ClickOutsideHandler | null) {
      current = next
    },
    destroy() {
      doc.removeEventListener('pointerdown', onPointerDown, true)
    },
  }
}

export type LongPressHandler = (event: PointerEvent) => void

export type LongPressOptions = {
  handler: LongPressHandler
  /** Hold duration in milliseconds. Default `500`. */
  duration?: number
}

function normalizeLongPress(
  param?: LongPressHandler | LongPressOptions | null,
): { handler: LongPressHandler | null; duration: number } {
  if (param == null) return { handler: null, duration: 500 }
  if (typeof param === 'function') return { handler: param, duration: 500 }
  const dur = Number(param.duration)
  return {
    handler: param.handler ?? null,
    duration: Number.isFinite(dur) && dur > 0 ? dur : 500,
  }
}

/**
 * `use:` action that calls `handler` after the pointer is held on `node`.
 * Accepts a handler or `{ handler, duration }` (default 500ms). Pass `null` to disable.
 */
export function longPress(node: Element, param?: LongPressHandler | LongPressOptions | null) {
  let opts = normalizeLongPress(param)
  let timer: ReturnType<typeof setTimeout> | null = null
  let startEvent: PointerEvent | null = null

  const clear = () => {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
    startEvent = null
  }

  const onDown = (event: Event) => {
    clear()
    if (!opts.handler) return
    const e = event as PointerEvent
    if (typeof e.button === 'number' && e.button !== 0) return
    startEvent = e
    timer = setTimeout(() => {
      timer = null
      const handler = opts.handler
      const started = startEvent
      startEvent = null
      if (handler && started) handler(started)
    }, opts.duration)
  }

  const onCancel = () => {
    clear()
  }

  node.addEventListener('pointerdown', onDown)
  node.addEventListener('pointerup', onCancel)
  node.addEventListener('pointerleave', onCancel)
  node.addEventListener('pointercancel', onCancel)

  return {
    update(next?: LongPressHandler | LongPressOptions | null) {
      opts = normalizeLongPress(next)
      if (!opts.handler) clear()
    },
    destroy() {
      clear()
      node.removeEventListener('pointerdown', onDown)
      node.removeEventListener('pointerup', onCancel)
      node.removeEventListener('pointerleave', onCancel)
      node.removeEventListener('pointercancel', onCancel)
    },
  }
}

export type HoldRepeatHandler = () => void
export type HoldRepeatOptions = {
  handler?: HoldRepeatHandler | null
  /** Ms before the first repeat after the initial fire. Default `400`. */
  delay?: number
  /** Ms between subsequent repeats. Default `100`. */
  interval?: number
  /** Fire once immediately on pointerdown. Default `true`. */
  immediate?: boolean
}

function normalizeHoldRepeat(param?: HoldRepeatHandler | HoldRepeatOptions | null): {
  handler: HoldRepeatHandler | null | undefined
  delay: number
  interval: number
  immediate: boolean
} {
  if (param == null) {
    return { handler: null, delay: 400, interval: 100, immediate: true }
  }
  if (typeof param === 'function') {
    return { handler: param, delay: 400, interval: 100, immediate: true }
  }
  return {
    handler: param.handler,
    delay: param.delay != null ? Number(param.delay) : 400,
    interval: param.interval != null ? Number(param.interval) : 100,
    immediate: param.immediate !== false,
  }
}

/**
 * `use:` action that fires a handler on pointerdown and repeats while held
 * (stepper / nudge controls). Pass a handler, `{ handler, delay, interval, immediate }`,
 * or `null` to disable.
 */
export function holdRepeat(node: Element, param?: HoldRepeatHandler | HoldRepeatOptions | null) {
  let opts = normalizeHoldRepeat(param)
  let delayId: ReturnType<typeof setTimeout> | null = null
  let intervalId: ReturnType<typeof setInterval> | null = null

  const stop = () => {
    if (delayId != null) {
      clearTimeout(delayId)
      delayId = null
    }
    if (intervalId != null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  const fire = () => {
    opts.handler?.()
  }

  const onDown = (event: Event) => {
    if (!opts.handler) return
    if ((event as PointerEvent).button != null && (event as PointerEvent).button !== 0) return
    stop()
    if (opts.immediate) fire()
    delayId = setTimeout(() => {
      delayId = null
      fire()
      intervalId = setInterval(fire, Math.max(16, opts.interval))
    }, Math.max(0, opts.delay))
  }

  const onUp = () => stop()

  node.addEventListener('pointerdown', onDown)
  node.addEventListener('pointerup', onUp)
  node.addEventListener('pointerleave', onUp)
  node.addEventListener('pointercancel', onUp)

  return {
    update(next?: HoldRepeatHandler | HoldRepeatOptions | null) {
      opts = normalizeHoldRepeat(next)
      if (!opts.handler) stop()
    },
    destroy() {
      stop()
      node.removeEventListener('pointerdown', onDown)
      node.removeEventListener('pointerup', onUp)
      node.removeEventListener('pointerleave', onUp)
      node.removeEventListener('pointercancel', onUp)
    },
  }
}

/**
 * `use:` action that focuses `node` after mount (microtask).
 * Pass `false` to skip; re-enabling via `update` focuses again.
 */
export function autofocus(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const run = () => {
    if (!active) return
    const el = node as HTMLElement
    if (typeof el.focus !== 'function') return
    try {
      el.focus()
    } catch {
      /* ignore */
    }
  }
  const schedule = () => {
    if (typeof queueMicrotask === 'function') queueMicrotask(run)
    else Promise.resolve().then(run)
  }
  schedule()
  return {
    update(next?: boolean | null) {
      const want = next !== false && next != null
      const was = active
      active = want
      if (want && !was) schedule()
    },
    destroy() {},
  }
}

/**
 * `use:` action that selects the control's contents on focus
 * (inputs, textareas, and other elements with `select()`).
 * Pass `false`/`null` to disable.
 */
export function selectOnFocus(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onFocus = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.select !== 'function') return
    try {
      el.select()
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('focus', onFocus)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('focus', onFocus)
    },
  }
}

/**
 * `use:` action that trims leading/trailing whitespace from an input/textarea value on blur.
 * Pass `false`/`null` to disable.
 */
export function trim(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = el.value.trim()
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

/**
 * `use:` action that trims leading whitespace from an input/textarea value on blur.
 * Pass `false`/`null` to disable.
 */
export function trimStart(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = el.value.trimStart()
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

/**
 * `use:` action that trims trailing whitespace from an input/textarea value on blur.
 * Pass `false`/`null` to disable.
 */
export function trimEnd(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = el.value.trimEnd()
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

function toInitials(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * `use:` action that converts an input/textarea value to initials on blur.
 * Pass `false`/`null` to disable.
 */
export function initials(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toInitials(el.value)
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

function collapseWhitespaceValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/**
 * `use:` action that collapses runs of whitespace to a single space and trims on blur.
 * Pass `false`/`null` to disable.
 */
export function collapseWhitespace(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = collapseWhitespaceValue(el.value)
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

/**
 * `use:` action that removes all whitespace from an input/textarea value on blur.
 * Pass `false`/`null` to disable.
 */
export function removeWhitespace(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = el.value.replace(/\s+/g, '')
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

/**
 * `use:` action that lowercases an input/textarea value on blur.
 * Pass `false`/`null` to disable.
 */
export function lowercase(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = el.value.toLowerCase()
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

/**
 * `use:` action that uppercases an input/textarea value on blur.
 * Pass `false`/`null` to disable.
 */
export function uppercase(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = el.value.toUpperCase()
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

/**
 * `use:` action that keeps only digit characters (`0-9`) in an input/textarea value as the user types.
 * Pass `false`/`null` to disable.
 */
export function numeric(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = el.value.replace(/\D+/g, '')
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toDecimal(value: string): string {
  let out = ''
  let seenDot = false
  for (const ch of value) {
    if (ch >= '0' && ch <= '9') out += ch
    else if (ch === '.' && !seenDot) {
      out += '.'
      seenDot = true
    }
  }
  return out
}

/**
 * `use:` action that keeps only a decimal number (digits + at most one `.`) as the user types.
 * Pass `false`/`null` to disable.
 */
export function decimal(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toDecimal(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toHex(value: string): string {
  let out = ''
  let seenHash = false
  for (const ch of value) {
    if (ch === '#' && !seenHash && out.length === 0) {
      out += '#'
      seenHash = true
      continue
    }
    const lower = ch.toLowerCase()
    if ((lower >= '0' && lower <= '9') || (lower >= 'a' && lower <= 'f')) {
      out += lower
    }
  }
  return out
}

/**
 * `use:` action that keeps a hex color/value while typing (optional leading `#`, then `0-9a-f`).
 * Pass `false`/`null` to disable.
 */
export function hex(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toHex(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toInteger(value: string): string {
  let out = ''
  let seenSign = false
  for (const ch of value) {
    if (ch === '-' && !seenSign && out.length === 0) {
      out += '-'
      seenSign = true
      continue
    }
    if (ch >= '0' && ch <= '9') out += ch
  }
  return out
}

/**
 * `use:` action that keeps an optional leading `-` and digits as the user types.
 * Pass `false`/`null` to disable.
 */
export function integer(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toInteger(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toSignedDecimal(value: string): string {
  let out = ''
  let seenSign = false
  let seenDot = false
  for (const ch of value) {
    if (ch === '-' && !seenSign && out.length === 0) {
      out += '-'
      seenSign = true
      continue
    }
    if (ch >= '0' && ch <= '9') {
      out += ch
      continue
    }
    if (ch === '.' && !seenDot) {
      out += '.'
      seenDot = true
    }
  }
  return out
}

/**
 * `use:` action that keeps an optional leading `-`, digits, and at most one `.` as the user types.
 * Pass `false`/`null` to disable.
 */
export function signedDecimal(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toSignedDecimal(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toPhone(value: string): string {
  return value.replace(/[^\d+\-().\s]/g, '')
}

/**
 * `use:` action that keeps phone-friendly characters (digits, `+`, `-`, `(`, `)`, `.`, spaces) as the user types.
 * Pass `false`/`null` to disable.
 */
export function phone(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toPhone(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toEmail(value: string): string {
  return value.replace(/[^A-Za-z0-9@._+\-]/g, '').toLowerCase()
}

/**
 * `use:` action that keeps email-friendly characters (`a-z`, `0-9`, `@`, `.`, `_`, `+`, `-`) as the user types.
 * Pass `false`/`null` to disable.
 */
export function email(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toEmail(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toUrl(value: string): string {
  return value.replace(/[^A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]/g, '')
}

/**
 * `use:` action that keeps URL-friendly characters (RFC 3986-ish) as the user types.
 * Pass `false`/`null` to disable.
 */
export function url(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toUrl(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toUsername(value: string): string {
  return value.replace(/[^A-Za-z0-9_\-]/g, '').toLowerCase()
}

/**
 * `use:` action that keeps username-friendly characters (`a-z`, `0-9`, `_`, `-`) and lowercases as the user types.
 * Pass `false`/`null` to disable.
 */
export function username(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toUsername(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toCreditCard(value: string): string {
  return value.replace(/[^\d\s\-]/g, '')
}

/**
 * `use:` action that keeps credit-card-friendly characters (digits, spaces, hyphens) as the user types.
 * Pass `false`/`null` to disable.
 */
export function creditCard(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toCreditCard(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toPostalCode(value: string): string {
  return value.replace(/[^A-Za-z0-9\s\-]/g, '').toUpperCase()
}

/**
 * `use:` action that keeps postal-code-friendly characters (letters, digits, spaces, hyphens) and uppercases as the user types.
 * Pass `false`/`null` to disable.
 */
export function postalCode(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toPostalCode(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toIban(value: string): string {
  return value.replace(/[^A-Za-z0-9\s]/g, '').toUpperCase()
}

/**
 * `use:` action that keeps IBAN-friendly characters (letters, digits, spaces) and uppercases as the user types.
 * Pass `false`/`null` to disable.
 */
export function iban(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toIban(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toCvv(value: string): string {
  return value.replace(/\D+/g, '').slice(0, 4)
}

/**
 * `use:` action that keeps up to 4 digits (card CVV/CVC) as the user types.
 * Pass `false`/`null` to disable.
 */
export function cvv(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toCvv(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toExpiry(value: string): string {
  const digits = value.replace(/\D+/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

/**
 * `use:` action that formats card expiry as `MM/YY` while typing (up to 4 digits).
 * Pass `false`/`null` to disable.
 */
export function expiry(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toExpiry(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toOtp(value: string): string {
  return value.replace(/\D+/g, '').slice(0, 6)
}

/**
 * `use:` action that keeps up to 6 digits (one-time passcode) as the user types.
 * Pass `false`/`null` to disable.
 */
export function otp(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toOtp(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

/**
 * `use:` action that keeps only letters (`A-Z`, `a-z`) as the user types.
 * Pass `false`/`null` to disable.
 */
export function letters(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = el.value.replace(/[^A-Za-z]+/g, '')
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toPin(value: string): string {
  return value.replace(/\D+/g, '').slice(0, 4)
}

/**
 * `use:` action that keeps up to 4 digits (PIN) as the user types.
 * Pass `false`/`null` to disable.
 */
export function pin(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toPin(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toAscii(value: string): string {
  let out = ''
  for (const ch of value) {
    const code = ch.charCodeAt(0)
    if (code >= 32 && code <= 126) out += ch
  }
  return out
}

/**
 * `use:` action that keeps printable ASCII characters (U+0020–U+007E) as the user types.
 * Pass `false`/`null` to disable.
 */
export function ascii(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toAscii(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toRemovePunct(value: string): string {
  // Keep ASCII letters, digits, and whitespace; strip punctuation.
  return value.replace(/[^A-Za-z0-9\s]+/g, '')
}

/**
 * `use:` action that removes punctuation from an input/textarea value while typing.
 * Keeps letters (`A-Z`, `a-z`), digits (`0-9`) and whitespace.
 * Pass `false`/`null` to disable.
 */
export function removePunct(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toRemovePunct(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toRemoveDiacritics(value: string): string {
  // Decompose into base char + combining marks, then drop combining marks.
  // Example: "é" -> "e".
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * `use:` action that removes diacritic marks (accents) from an input/textarea value while typing.
 * Pass `false`/`null` to disable.
 */
export function removeDiacritics(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toRemoveDiacritics(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toCurrency(value: string): string {
  let out = ''
  let seenDollar = false
  let seenDot = false
  for (const ch of value) {
    if (ch === '$' && !seenDollar && out.length === 0) {
      out += '$'
      seenDollar = true
      continue
    }
    if (ch >= '0' && ch <= '9') {
      out += ch
      continue
    }
    if (ch === '.' && !seenDot) {
      out += '.'
      seenDot = true
    }
  }
  return out
}

/**
 * `use:` action that keeps an optional leading `$`, digits, and at most one `.` as the user types.
 * Pass `false`/`null` to disable.
 */
export function currency(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toCurrency(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toPercent(value: string): string {
  const wantsPercent = value.includes('%')
  let out = ''
  let seenDot = false
  for (const ch of value) {
    if (ch === '%') continue
    if (ch >= '0' && ch <= '9') {
      out += ch
      continue
    }
    if (ch === '.' && !seenDot) {
      out += '.'
      seenDot = true
    }
  }
  if (wantsPercent) out += '%'
  return out
}

/**
 * `use:` action that keeps digits, at most one `.`, and an optional trailing `%` as the user types.
 * Pass `false`/`null` to disable.
 */
export function percent(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toPercent(el.value)
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

/**
 * `use:` action that keeps only alphanumeric characters (`A-Z`, `a-z`, `0-9`) as the user types.
 * Pass `false`/`null` to disable.
 */
export function alphanumeric(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  let applying = false
  const onInput = () => {
    if (!active || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = el.value.replace(/[^A-Za-z0-9]+/g, '')
    if (next === el.value) return
    const start = el.selectionStart
    applying = true
    el.value = next
    if (typeof start === 'number' && typeof el.setSelectionRange === 'function') {
      try {
        const pos = Math.min(start, next.length)
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

function toSlug(value: string): string {
  const core = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
  // Trim leading/trailing hyphens without /^-+|-+$/ (polynomial ReDoS on long '-' runs).
  let start = 0
  let end = core.length
  while (start < end && core.charCodeAt(start) === 45 /* - */) start++
  while (end > start && core.charCodeAt(end - 1) === 45) end--
  return core.slice(start, end)
}

/**
 * `use:` action that turns an input/textarea value into a URL slug on blur
 * (lowercase, non-alphanumeric runs → `-`, trim hyphens).
 * Pass `false`/`null` to disable.
 */
export function slugify(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toSlug(el.value)
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

function toCapitalized(value: string): string {
  return value.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
}

function toSentenceCase(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
}

function toCamelCase(value: string): string {
  const parts = value
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase())
  if (parts.length === 0) return ''
  return parts[0] + parts.slice(1).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')
}

function toSnakeCase(value: string): string {
  return value
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase())
    .join('_')
}

function toKebabCase(value: string): string {
  return value
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase())
    .join('-')
}

function toConstantCase(value: string): string {
  return value
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.toUpperCase())
    .join('_')
}

function toPascalCase(value: string): string {
  return value
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('')
}

function toDotCase(value: string): string {
  return value
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase())
    .join('.')
}

function toPathCase(value: string): string {
  return value
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase())
    .join('/')
}

function toTrainCase(value: string): string {
  return value
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('-')
}

function toSwapCase(value: string): string {
  return Array.from(value, (char) => {
    const lower = char.toLowerCase()
    const upper = char.toUpperCase()
    if (char === lower && char !== upper) return upper
    if (char === upper && char !== lower) return lower
    return char
  }).join('')
}

function toReverse(value: string): string {
  return Array.from(value).reverse().join('')
}

/**
 * `use:` action that capitalizes each word in an input/textarea value on blur
 * (first letter upper, rest lower per whitespace-separated token).
 * Pass `false`/`null` to disable.
 */
export function capitalize(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toCapitalized(el.value)
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

/**
 * `use:` action that sentence-cases an input/textarea value on blur
 * (first letter upper, rest lower).
 * Pass `false`/`null` to disable.
 */
export function sentenceCase(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toSentenceCase(el.value)
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

/**
 * `use:` action that converts an input/textarea value to camelCase on blur.
 * Pass `false`/`null` to disable.
 */
export function camelCase(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toCamelCase(el.value)
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

/**
 * `use:` action that converts an input/textarea value to snake_case on blur.
 * Pass `false`/`null` to disable.
 */
export function snakeCase(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toSnakeCase(el.value)
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

/**
 * `use:` action that converts an input/textarea value to kebab-case on blur.
 * Pass `false`/`null` to disable.
 */
export function kebabCase(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toKebabCase(el.value)
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

/**
 * `use:` action that converts an input/textarea value to CONSTANT_CASE on blur.
 * Pass `false`/`null` to disable.
 */
export function constantCase(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toConstantCase(el.value)
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

/**
 * `use:` action that converts an input/textarea value to PascalCase on blur.
 * Pass `false`/`null` to disable.
 */
export function pascalCase(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toPascalCase(el.value)
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

/**
 * `use:` action that converts an input/textarea value to dot.case on blur.
 * Pass `false`/`null` to disable.
 */
export function dotCase(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toDotCase(el.value)
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

/**
 * `use:` action that converts an input/textarea value to path/case on blur.
 * Pass `false`/`null` to disable.
 */
export function pathCase(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toPathCase(el.value)
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

/**
 * `use:` action that converts an input/textarea value to Train-Case on blur.
 * Pass `false`/`null` to disable.
 */
export function trainCase(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toTrainCase(el.value)
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

/**
 * `use:` action that swaps letter casing in an input/textarea value on blur.
 * Pass `false`/`null` to disable.
 */
export function swapCase(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toSwapCase(el.value)
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

/**
 * `use:` action that reverses an input/textarea value on blur.
 * Pass `false`/`null` to disable.
 */
export function reverse(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onBlur = () => {
    if (!active) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    const next = toReverse(el.value)
    if (next === el.value) return
    el.value = next
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
  }
  node.addEventListener('blur', onBlur)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('blur', onBlur)
    },
  }
}

export type MaxLengthOptions = {
  /** Maximum character count. */
  length?: number
}

function normalizeMaxLength(param?: number | MaxLengthOptions | null): number | null {
  if (param == null) return null
  if (typeof param === 'number') {
    return Number.isFinite(param) && param >= 0 ? Math.floor(param) : null
  }
  const n = param.length
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}

/**
 * `use:` action that clamps an input/textarea value to at most `length` characters while typing.
 * Pass a number, `{ length }`, or `null` to disable.
 */
export function maxLength(node: Element, param?: number | MaxLengthOptions | null) {
  let limit = normalizeMaxLength(param)
  let applying = false
  const onInput = () => {
    if (limit == null || applying) return
    const el = node as HTMLInputElement
    if (typeof el.value !== 'string') return
    if (el.value.length <= limit) return
    const next = el.value.slice(0, limit)
    applying = true
    el.value = next
    if (typeof el.setSelectionRange === 'function') {
      try {
        el.setSelectionRange(next.length, next.length)
      } catch {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } catch {
      /* ignore */
    }
    applying = false
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: number | MaxLengthOptions | null) {
      limit = normalizeMaxLength(next)
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

/**
 * `use:` action that grows a textarea (or similar) to fit its content.
 * Listens to `input`; pass `false`/`null` to disable.
 */
export function autoHeight(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const el = node as HTMLElement

  const resize = () => {
    if (!active) return
    if (typeof el.style === 'undefined') return
    el.style.height = 'auto'
    const scrollHeight =
      typeof (el as HTMLTextAreaElement).scrollHeight === 'number'
        ? (el as HTMLTextAreaElement).scrollHeight
        : 0
    el.style.height = `${scrollHeight}px`
  }

  const onInput = () => resize()
  node.addEventListener('input', onInput)
  if (typeof queueMicrotask === 'function') queueMicrotask(resize)
  else Promise.resolve().then(resize)

  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
      if (active) resize()
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

export type DebounceHandler = (value: string) => void
export type DebounceOptions = {
  handler?: DebounceHandler | null
  /** Milliseconds to wait after the last input. Default `300`. */
  wait?: number
}

function normalizeDebounce(param?: DebounceHandler | DebounceOptions | null): {
  handler: DebounceHandler | null | undefined
  wait: number
} {
  if (param == null) {
    return { handler: null, wait: 300 }
  }
  if (typeof param === 'function') {
    return { handler: param, wait: 300 }
  }
  return {
    handler: param.handler,
    wait: param.wait != null ? Number(param.wait) : 300,
  }
}

/**
 * `use:` action that calls `handler` with the control's value after input settles.
 * Mount on an `<input>` / `<textarea>`. Pass a handler, `{ handler, wait }`, or `null` to disable.
 */
export function debounce(node: Element, param?: DebounceHandler | DebounceOptions | null) {
  let opts = normalizeDebounce(param)
  let timer: ReturnType<typeof setTimeout> | null = null

  const clear = () => {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const onInput = () => {
    if (!opts.handler) return
    clear()
    const wait = Number.isFinite(opts.wait) && opts.wait > 0 ? opts.wait : 0
    timer = setTimeout(() => {
      timer = null
      const value =
        typeof (node as HTMLInputElement).value === 'string'
          ? (node as HTMLInputElement).value
          : ''
      opts.handler?.(value)
    }, wait)
  }

  node.addEventListener('input', onInput)

  return {
    update(next?: DebounceHandler | DebounceOptions | null) {
      opts = normalizeDebounce(next)
      if (!opts.handler) clear()
    },
    destroy() {
      clear()
      node.removeEventListener('input', onInput)
    },
  }
}

export type ThrottleHandler = (value: string) => void
export type ThrottleOptions = {
  handler?: ThrottleHandler | null
  /** Minimum milliseconds between handler calls. Default `200`. */
  wait?: number
}

function normalizeThrottle(param?: ThrottleHandler | ThrottleOptions | null): {
  handler: ThrottleHandler | null | undefined
  wait: number
} {
  if (param == null) {
    return { handler: null, wait: 200 }
  }
  if (typeof param === 'function') {
    return { handler: param, wait: 200 }
  }
  return {
    handler: param.handler,
    wait: param.wait != null ? Number(param.wait) : 200,
  }
}

/**
 * `use:` action that calls `handler` with the control's value at most once per `wait` ms.
 * Mount on an `<input>` / `<textarea>`. Pass a handler, `{ handler, wait }`, or `null` to disable.
 */
export function throttle(node: Element, param?: ThrottleHandler | ThrottleOptions | null) {
  let opts = normalizeThrottle(param)
  let last = Number.NEGATIVE_INFINITY
  let trailing: ReturnType<typeof setTimeout> | null = null

  const clear = () => {
    if (trailing != null) {
      clearTimeout(trailing)
      trailing = null
    }
  }

  const readValue = () =>
    typeof (node as HTMLInputElement).value === 'string' ? (node as HTMLInputElement).value : ''

  const fire = () => {
    last = Date.now()
    opts.handler?.(readValue())
  }

  const onInput = () => {
    if (!opts.handler) return
    const wait = Number.isFinite(opts.wait) && opts.wait > 0 ? opts.wait : 0
    const now = Date.now()
    const elapsed = now - last
    if (elapsed >= wait) {
      clear()
      fire()
      return
    }
    clear()
    trailing = setTimeout(() => {
      trailing = null
      fire()
    }, wait - elapsed)
  }

  node.addEventListener('input', onInput)

  return {
    update(next?: ThrottleHandler | ThrottleOptions | null) {
      opts = normalizeThrottle(next)
      if (!opts.handler) clear()
    },
    destroy() {
      clear()
      node.removeEventListener('input', onInput)
    },
  }
}

export type InputHandler = (value: string, event: Event) => void

/**
 * `use:` action that calls `handler(value, event)` on every `input` event
 * (live value while typing). Pass a handler or `null` to disable.
 */
export function input(node: Element, handler?: InputHandler | null) {
  let current: InputHandler | null | undefined = handler
  const onInput = (event: Event) => {
    if (!current) return
    const value =
      typeof (node as HTMLInputElement).value === 'string' ? (node as HTMLInputElement).value : ''
    current(value, event)
  }
  node.addEventListener('input', onInput)
  return {
    update(next?: InputHandler | null) {
      current = next
    },
    destroy() {
      node.removeEventListener('input', onInput)
    },
  }
}

export type ChangeHandler = (value: string, event: Event) => void

/**
 * `use:` action that calls `handler(value, event)` on the control's `change` event
 * (committed value after blur / Enter for text fields, or selection change for selects).
 * Pass a handler or `null` to disable.
 */
export function change(node: Element, handler?: ChangeHandler | null) {
  let current: ChangeHandler | null | undefined = handler
  const onChange = (event: Event) => {
    if (!current) return
    const value =
      typeof (node as HTMLInputElement).value === 'string' ? (node as HTMLInputElement).value : ''
    current(value, event)
  }
  node.addEventListener('change', onChange)
  return {
    update(next?: ChangeHandler | null) {
      current = next
    },
    destroy() {
      node.removeEventListener('change', onChange)
    },
  }
}

export type SubmitHandler = (data: FormData, event: SubmitEvent) => void
export type SubmitOptions = {
  handler?: SubmitHandler | null
  /** When true (default), call `preventDefault` on submit. */
  preventDefault?: boolean
}

function normalizeSubmit(param?: SubmitHandler | SubmitOptions | null): {
  handler: SubmitHandler | null | undefined
  preventDefault: boolean
} {
  if (param == null) {
    return { handler: null, preventDefault: true }
  }
  if (typeof param === 'function') {
    return { handler: param, preventDefault: true }
  }
  return {
    handler: param.handler,
    preventDefault: param.preventDefault !== false,
  }
}

/**
 * `use:` action for `<form>` submit. Calls `handler(FormData, event)`.
 * Pass a handler, `{ handler, preventDefault? }`, or `null` to disable.
 * `preventDefault` defaults to `true` for SPA-style handling.
 */
export function submit(node: Element, param?: SubmitHandler | SubmitOptions | null) {
  let opts = normalizeSubmit(param)
  const onSubmit = (event: Event) => {
    if (!opts.handler) return
    const e = event as SubmitEvent
    if (opts.preventDefault) e.preventDefault()
    const form = node as HTMLFormElement
    const data = typeof FormData === 'function' ? new FormData(form) : ({} as FormData)
    opts.handler(data, e)
  }
  node.addEventListener('submit', onSubmit)
  return {
    update(next?: SubmitHandler | SubmitOptions | null) {
      opts = normalizeSubmit(next)
    },
    destroy() {
      node.removeEventListener('submit', onSubmit)
    },
  }
}

export type FormDataHandler = (data: FormData, event: FormDataEvent) => void

/**
 * `use:` action for the form `formdata` event (fires when `FormData` is constructed for the form).
 * Calls `handler(FormData, event)`. Pass a handler or `null` to disable.
 * Useful to append/modify entries before a submit handler reads the same `FormData`.
 */
export function formdata(node: Element, handler?: FormDataHandler | null) {
  let current: FormDataHandler | null | undefined = handler
  const onFormData = (event: Event) => {
    if (!current) return
    const e = event as FormDataEvent
    current(e.formData, e)
  }
  node.addEventListener('formdata', onFormData)
  return {
    update(next?: FormDataHandler | null) {
      current = next
    },
    destroy() {
      node.removeEventListener('formdata', onFormData)
    },
  }
}

export type ResetHandler = (event: Event) => void
export type ResetOptions = {
  handler?: ResetHandler | null
  /** When true, call `preventDefault` on reset. Default `false`. */
  preventDefault?: boolean
}

function normalizeReset(param?: ResetHandler | ResetOptions | null): {
  handler: ResetHandler | null | undefined
  preventDefault: boolean
} {
  if (param == null) {
    return { handler: null, preventDefault: false }
  }
  if (typeof param === 'function') {
    return { handler: param, preventDefault: false }
  }
  return {
    handler: param.handler,
    preventDefault: param.preventDefault === true,
  }
}

/**
 * `use:` action for `<form>` reset. Calls `handler(event)`.
 * Pass a handler, `{ handler, preventDefault? }`, or `null` to disable.
 */
export function reset(node: Element, param?: ResetHandler | ResetOptions | null) {
  let opts = normalizeReset(param)
  const onReset = (event: Event) => {
    if (!opts.handler) return
    if (opts.preventDefault) event.preventDefault()
    opts.handler(event)
  }
  node.addEventListener('reset', onReset)
  return {
    update(next?: ResetHandler | ResetOptions | null) {
      opts = normalizeReset(next)
    },
    destroy() {
      node.removeEventListener('reset', onReset)
    },
  }
}

export type InvalidHandler = (event: Event) => void
export type InvalidOptions = {
  handler?: InvalidHandler | null
  /** When true (default), call `preventDefault` to suppress the browser bubble. */
  preventDefault?: boolean
}

function normalizeInvalid(param?: InvalidHandler | InvalidOptions | null): {
  handler: InvalidHandler | null | undefined
  preventDefault: boolean
} {
  if (param == null) {
    return { handler: null, preventDefault: true }
  }
  if (typeof param === 'function') {
    return { handler: param, preventDefault: true }
  }
  return {
    handler: param.handler,
    preventDefault: param.preventDefault !== false,
  }
}

/**
 * `use:` action that calls `handler` when a control fails constraint validation (`invalid` event).
 * Pass a handler, `{ handler, preventDefault? }`, or `null` to disable.
 * `preventDefault` defaults to `true` so custom UI can replace the native bubble.
 */
export function invalid(node: Element, param?: InvalidHandler | InvalidOptions | null) {
  let opts = normalizeInvalid(param)
  const onInvalid = (event: Event) => {
    if (!opts.handler) return
    if (opts.preventDefault) event.preventDefault()
    opts.handler(event)
  }
  node.addEventListener('invalid', onInvalid)
  return {
    update(next?: InvalidHandler | InvalidOptions | null) {
      opts = normalizeInvalid(next)
    },
    destroy() {
      node.removeEventListener('invalid', onInvalid)
    },
  }
}

export type CopySource = string | number | (() => string | number | null | undefined) | null | undefined

/**
 * `use:` action that writes text to the clipboard on click.
 * Accepts a string/number, a getter, or `null` to disable.
 */
export function copy(node: Element, source?: CopySource) {
  let current: CopySource = source
  const onClick = () => {
    if (current == null) return
    const raw = typeof current === 'function' ? current() : current
    if (raw == null) return
    const text = String(raw)
    const nav = (globalThis as { navigator?: Navigator }).navigator
    const clip = nav?.clipboard
    if (clip && typeof clip.writeText === 'function') {
      void clip.writeText(text).catch(() => {})
    }
  }
  node.addEventListener('click', onClick)
  return {
    update(next?: CopySource) {
      current = next
    },
    destroy() {
      node.removeEventListener('click', onClick)
    },
  }
}

export type PasteHandler = (text: string, event: ClipboardEvent) => void
export type PasteOptions = {
  handler?: PasteHandler | null
  /** When true (default), call `preventDefault` on the paste event. */
  preventDefault?: boolean
}

function normalizePaste(param?: PasteHandler | PasteOptions | null): {
  handler: PasteHandler | null | undefined
  preventDefault: boolean
} {
  if (param == null) {
    return { handler: null, preventDefault: true }
  }
  if (typeof param === 'function') {
    return { handler: param, preventDefault: true }
  }
  return {
    handler: param.handler,
    preventDefault: param.preventDefault !== false,
  }
}

/**
 * `use:` action that reads pasted plain text and calls `handler(text, event)`.
 * Pass a handler, `{ handler, preventDefault? }`, or `null` to disable.
 */
export function paste(node: Element, param?: PasteHandler | PasteOptions | null) {
  let opts = normalizePaste(param)
  const onPaste = (event: Event) => {
    if (!opts.handler) return
    const e = event as ClipboardEvent
    if (opts.preventDefault) e.preventDefault()
    let text = ''
    try {
      text = e.clipboardData?.getData('text/plain') ?? ''
    } catch {
      text = ''
    }
    opts.handler(text, e)
  }
  node.addEventListener('paste', onPaste)
  return {
    update(next?: PasteHandler | PasteOptions | null) {
      opts = normalizePaste(next)
    },
    destroy() {
      node.removeEventListener('paste', onPaste)
    },
  }
}

export type CutHandler = (text: string, event: ClipboardEvent) => void
export type CutOptions = {
  handler?: CutHandler | null
  /** When true (default), call `preventDefault` on the cut event. */
  preventDefault?: boolean
}

function normalizeCut(param?: CutHandler | CutOptions | null): {
  handler: CutHandler | null | undefined
  preventDefault: boolean
} {
  if (param == null) {
    return { handler: null, preventDefault: true }
  }
  if (typeof param === 'function') {
    return { handler: param, preventDefault: true }
  }
  return {
    handler: param.handler,
    preventDefault: param.preventDefault !== false,
  }
}

/**
 * `use:` action that reads cut plain text and calls `handler(text, event)`.
 * Pass a handler, `{ handler, preventDefault? }`, or `null` to disable.
 */
export function cut(node: Element, param?: CutHandler | CutOptions | null) {
  let opts = normalizeCut(param)
  const onCut = (event: Event) => {
    if (!opts.handler) return
    const e = event as ClipboardEvent
    if (opts.preventDefault) e.preventDefault()
    let text = ''
    try {
      text = e.clipboardData?.getData('text/plain') ?? ''
    } catch {
      text = ''
    }
    // Some browsers expose selection via the input value when clipboardData is empty on cut.
    if (!text && typeof (node as HTMLInputElement).value === 'string') {
      const el = node as HTMLInputElement
      const start = el.selectionStart
      const end = el.selectionEnd
      if (typeof start === 'number' && typeof end === 'number' && end > start) {
        text = el.value.slice(start, end)
      }
    }
    opts.handler(text, e)
  }
  node.addEventListener('cut', onCut)
  return {
    update(next?: CutHandler | CutOptions | null) {
      opts = normalizeCut(next)
    },
    destroy() {
      node.removeEventListener('cut', onCut)
    },
  }
}

export type BeforeinputHandler = (event: InputEvent) => void
export type BeforeinputOptions = {
  handler?: BeforeinputHandler | null
  /** When true, call `preventDefault` on the beforeinput event. Default `false`. */
  preventDefault?: boolean
}

function normalizeBeforeinput(param?: BeforeinputHandler | BeforeinputOptions | null): {
  handler: BeforeinputHandler | null | undefined
  preventDefault: boolean
} {
  if (param == null) {
    return { handler: null, preventDefault: false }
  }
  if (typeof param === 'function') {
    return { handler: param, preventDefault: false }
  }
  return {
    handler: param.handler,
    preventDefault: param.preventDefault === true,
  }
}

/**
 * `use:` action that calls `handler` on `beforeinput` (IME-aware insert/delete).
 * Pass a handler, `{ handler, preventDefault? }`, or `null` to disable.
 */
export function beforeinput(node: Element, param?: BeforeinputHandler | BeforeinputOptions | null) {
  let opts = normalizeBeforeinput(param)
  const onBeforeInput = (event: Event) => {
    if (!opts.handler) return
    const e = event as InputEvent
    if (opts.preventDefault) e.preventDefault()
    opts.handler(e)
  }
  node.addEventListener('beforeinput', onBeforeInput)
  return {
    update(next?: BeforeinputHandler | BeforeinputOptions | null) {
      opts = normalizeBeforeinput(next)
    },
    destroy() {
      node.removeEventListener('beforeinput', onBeforeInput)
    },
  }
}

export type CompositionPhase = 'start' | 'update' | 'end'
export type CompositionInfo = {
  phase: CompositionPhase
  data: string
  event: CompositionEvent
}
export type CompositionHandler = (info: CompositionInfo) => void

/**
 * `use:` action that reports IME composition phases on `node`.
 * Pass a handler `(info) => …` with `phase`/`data`, or `null` to disable.
 */
export function composition(node: Element, handler?: CompositionHandler | null) {
  let current: CompositionHandler | null | undefined = handler

  const fire = (phase: CompositionPhase, event: Event) => {
    if (!current) return
    const e = event as CompositionEvent
    current({
      phase,
      data: typeof e.data === 'string' ? e.data : '',
      event: e,
    })
  }

  const onStart = (event: Event) => fire('start', event)
  const onUpdate = (event: Event) => fire('update', event)
  const onEnd = (event: Event) => fire('end', event)

  node.addEventListener('compositionstart', onStart)
  node.addEventListener('compositionupdate', onUpdate)
  node.addEventListener('compositionend', onEnd)

  return {
    update(next?: CompositionHandler | null) {
      current = next
    },
    destroy() {
      node.removeEventListener('compositionstart', onStart)
      node.removeEventListener('compositionupdate', onUpdate)
      node.removeEventListener('compositionend', onEnd)
    },
  }
}

export type SelectionInfo = {
  start: number
  end: number
  text: string
}
export type SelectionchangeHandler = (info: SelectionInfo) => void

/**
 * `use:` action that reports text selection inside an input/textarea `node`.
 * Listens for document `selectionchange` and element `select`. Pass `null` to disable.
 */
export function selectionchange(node: Element, handler?: SelectionchangeHandler | null) {
  const doc = (globalThis as { document?: Document }).document
  let current: SelectionchangeHandler | null | undefined = handler

  const report = () => {
    if (!current) return
    if (doc && doc.activeElement && doc.activeElement !== node) return
    const el = node as HTMLInputElement | HTMLTextAreaElement
    if (typeof el.selectionStart !== 'number' || typeof el.selectionEnd !== 'number') return
    const start = el.selectionStart
    const end = el.selectionEnd
    const value = typeof el.value === 'string' ? el.value : ''
    current({ start, end, text: value.slice(start, end) })
  }

  if (doc && typeof doc.addEventListener === 'function') {
    doc.addEventListener('selectionchange', report)
  }
  node.addEventListener('select', report)

  return {
    update(next?: SelectionchangeHandler | null) {
      current = next
    },
    destroy() {
      if (doc && typeof doc.removeEventListener === 'function') {
        doc.removeEventListener('selectionchange', report)
      }
      node.removeEventListener('select', report)
    },
  }
}

export type HoverHandler = (hovered: boolean, event: PointerEvent) => void

/**
 * `use:` action that reports pointer hover state for `node`.
 * Pass a handler `(hovered, event) => …`, or `null` to disable.
 */
export function hover(node: Element, handler?: HoverHandler | null) {
  let current: HoverHandler | null | undefined = handler
  const onEnter = (event: Event) => {
    if (!current) return
    current(true, event as PointerEvent)
  }
  const onLeave = (event: Event) => {
    if (!current) return
    current(false, event as PointerEvent)
  }
  node.addEventListener('pointerenter', onEnter)
  node.addEventListener('pointerleave', onLeave)
  return {
    update(next?: HoverHandler | null) {
      current = next
    },
    destroy() {
      node.removeEventListener('pointerenter', onEnter)
      node.removeEventListener('pointerleave', onLeave)
    },
  }
}

export type DblclickHandler = (event: MouseEvent) => void

/**
 * `use:` action that calls `handler` on double-click.
 * Pass a handler or `null` to disable.
 */
export function dblclick(node: Element, handler?: DblclickHandler | null) {
  let current: DblclickHandler | null | undefined = handler
  const onDblClick = (event: Event) => {
    if (!current) return
    current(event as MouseEvent)
  }
  node.addEventListener('dblclick', onDblClick)
  return {
    update(next?: DblclickHandler | null) {
      current = next
    },
    destroy() {
      node.removeEventListener('dblclick', onDblClick)
    },
  }
}

export type ContextmenuHandler = (event: MouseEvent) => void
export type ContextmenuOptions = {
  handler?: ContextmenuHandler | null
  /** When true (default), call `preventDefault` on the contextmenu event. */
  preventDefault?: boolean
}

function normalizeContextmenu(param?: ContextmenuHandler | ContextmenuOptions | null): {
  handler: ContextmenuHandler | null | undefined
  preventDefault: boolean
} {
  if (param == null) {
    return { handler: null, preventDefault: true }
  }
  if (typeof param === 'function') {
    return { handler: param, preventDefault: true }
  }
  return {
    handler: param.handler,
    preventDefault: param.preventDefault !== false,
  }
}

/**
 * `use:` action that calls `handler` on context menu (right-click / long-press menu).
 * Pass a handler, `{ handler, preventDefault? }`, or `null` to disable.
 * `preventDefault` defaults to `true` so custom menus can replace the browser menu.
 */
export function contextmenu(node: Element, param?: ContextmenuHandler | ContextmenuOptions | null) {
  let opts = normalizeContextmenu(param)
  const onContextMenu = (event: Event) => {
    if (!opts.handler) return
    const e = event as MouseEvent
    if (opts.preventDefault) e.preventDefault()
    opts.handler(e)
  }
  node.addEventListener('contextmenu', onContextMenu)
  return {
    update(next?: ContextmenuHandler | ContextmenuOptions | null) {
      opts = normalizeContextmenu(next)
    },
    destroy() {
      node.removeEventListener('contextmenu', onContextMenu)
    },
  }
}

export type WheelHandler = (event: WheelEvent) => void
export type WheelOptions = {
  handler?: WheelHandler | null
  /** When true, call `preventDefault` on the wheel event. Default `false`. */
  preventDefault?: boolean
  /** Passive listener when `preventDefault` is false. Default `true`. */
  passive?: boolean
}

function normalizeWheel(param?: WheelHandler | WheelOptions | null): {
  handler: WheelHandler | null | undefined
  preventDefault: boolean
  passive: boolean
} {
  if (param == null) {
    return { handler: null, preventDefault: false, passive: true }
  }
  if (typeof param === 'function') {
    return { handler: param, preventDefault: false, passive: true }
  }
  const preventDefault = param.preventDefault === true
  return {
    handler: param.handler,
    preventDefault,
    passive: param.passive != null ? Boolean(param.passive) : !preventDefault,
  }
}

/**
 * `use:` action that calls `handler` on wheel / trackpad scroll over `node`.
 * Pass a handler, `{ handler, preventDefault?, passive? }`, or `null` to disable.
 * Rebinds the listener when options change so `passive` stays consistent with `preventDefault`.
 */
export function wheel(node: Element, param?: WheelHandler | WheelOptions | null) {
  let opts = normalizeWheel(param)

  const onWheel = (event: Event) => {
    if (!opts.handler) return
    const e = event as WheelEvent
    if (opts.preventDefault) e.preventDefault()
    opts.handler(e)
  }

  const bind = () => {
    node.addEventListener('wheel', onWheel, { passive: opts.passive && !opts.preventDefault })
  }
  const unbind = () => {
    node.removeEventListener('wheel', onWheel)
  }
  bind()

  return {
    update(next?: WheelHandler | WheelOptions | null) {
      unbind()
      opts = normalizeWheel(next)
      bind()
    },
    destroy() {
      unbind()
    },
  }
}

export type ElementScroll = { x: number; y: number }
export type ScrollHandler = (pos: ElementScroll, event: Event) => void
export type ScrollOptions = {
  handler?: ScrollHandler | null
  /** Fire once with the current position after attach. Default `false`. */
  immediate?: boolean
}

function normalizeScroll(param?: ScrollHandler | ScrollOptions | null): {
  handler: ScrollHandler | null | undefined
  immediate: boolean
} {
  if (param == null) {
    return { handler: null, immediate: false }
  }
  if (typeof param === 'function') {
    return { handler: param, immediate: false }
  }
  return {
    handler: param.handler,
    immediate: param.immediate === true,
  }
}

function readElementScroll(node: Element): ElementScroll {
  const el = node as HTMLElement
  return {
    x: typeof el.scrollLeft === 'number' ? el.scrollLeft : 0,
    y: typeof el.scrollTop === 'number' ? el.scrollTop : 0,
  }
}

/**
 * `use:` action that reports `scrollLeft` / `scrollTop` of `node` on scroll.
 * Pass a handler `(pos, event) => …`, `{ handler, immediate? }`, or `null` to disable.
 */
export function scroll(node: Element, param?: ScrollHandler | ScrollOptions | null) {
  let opts = normalizeScroll(param)
  const onScroll = (event: Event) => {
    if (!opts.handler) return
    opts.handler(readElementScroll(node), event)
  }
  node.addEventListener('scroll', onScroll, { passive: true })
  if (opts.immediate && opts.handler) {
    opts.handler(readElementScroll(node), new Event('scroll'))
  }
  return {
    update(next?: ScrollHandler | ScrollOptions | null) {
      opts = normalizeScroll(next)
      if (opts.immediate && opts.handler) {
        opts.handler(readElementScroll(node), new Event('scroll'))
      }
    },
    destroy() {
      node.removeEventListener('scroll', onScroll)
    },
  }
}

export type SnapAxis = 'x' | 'y' | 'both'
export type SnapAlign = 'start' | 'center' | 'end'
export type SnapType = 'mandatory' | 'proximity'
export type SnapOptions = {
  /** Snap axis. Default `'x'`. */
  axis?: SnapAxis
  /** Child `scroll-snap-align`. Default `'start'`. */
  align?: SnapAlign
  /** `scroll-snap-type` strictness. Default `'mandatory'`. */
  type?: SnapType
  /** When false, clears snap styles. Default `true`. */
  enabled?: boolean
}

function normalizeSnap(param?: SnapOptions | boolean | null): {
  enabled: boolean
  axis: SnapAxis
  align: SnapAlign
  type: SnapType
} {
  if (param === false || param === null) {
    return { enabled: false, axis: 'x', align: 'start', type: 'mandatory' }
  }
  if (param === true || param === undefined) {
    return { enabled: true, axis: 'x', align: 'start', type: 'mandatory' }
  }
  const axis = param.axis === 'y' || param.axis === 'both' ? param.axis : 'x'
  const align = param.align === 'center' || param.align === 'end' ? param.align : 'start'
  const type = param.type === 'proximity' ? 'proximity' : 'mandatory'
  return {
    enabled: param.enabled !== false,
    axis,
    align,
    type,
  }
}

function snapTypeValue(axis: SnapAxis, type: SnapType): string {
  if (axis === 'both') return `both ${type}`
  return `${axis} ${type}`
}

/**
 * `use:` action that enables CSS scroll snap on `node` and aligns direct element children.
 * Pass `true` / options, or `false`/`null` to disable and restore prior inline styles.
 */
export function snap(node: Element, param?: SnapOptions | boolean | null) {
  const el = node as HTMLElement
  const prev = {
    overflowX: el.style?.overflowX ?? '',
    overflowY: el.style?.overflowY ?? '',
    scrollSnapType: el.style?.scrollSnapType ?? '',
  }
  const childPrev = new WeakMap<Element, string>()

  const clearChildren = () => {
    const children = el.children
    if (!children) return
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement
      if (!child?.style) continue
      const saved = childPrev.get(child)
      if (saved != null) child.style.scrollSnapAlign = saved
      else child.style.removeProperty('scroll-snap-align')
      childPrev.delete(child)
    }
  }

  const applyChildren = (align: SnapAlign) => {
    const children = el.children
    if (!children) return
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement
      if (!child?.style) continue
      if (!childPrev.has(child)) childPrev.set(child, child.style.scrollSnapAlign)
      child.style.scrollSnapAlign = align
    }
  }

  const apply = (opts: ReturnType<typeof normalizeSnap>) => {
    if (!el.style) return
    if (!opts.enabled) {
      el.style.overflowX = prev.overflowX
      el.style.overflowY = prev.overflowY
      el.style.scrollSnapType = prev.scrollSnapType
      clearChildren()
      return
    }
    if (opts.axis === 'x' || opts.axis === 'both') el.style.overflowX = 'auto'
    if (opts.axis === 'y' || opts.axis === 'both') el.style.overflowY = 'auto'
    if (opts.axis === 'x') el.style.overflowY = prev.overflowY || el.style.overflowY
    if (opts.axis === 'y') el.style.overflowX = prev.overflowX || el.style.overflowX
    el.style.scrollSnapType = snapTypeValue(opts.axis, opts.type)
    applyChildren(opts.align)
  }

  let opts = normalizeSnap(param)
  apply(opts)

  return {
    update(next?: SnapOptions | boolean | null) {
      opts = normalizeSnap(next)
      apply(opts)
    },
    destroy() {
      if (!el.style) return
      el.style.overflowX = prev.overflowX
      el.style.overflowY = prev.overflowY
      el.style.scrollSnapType = prev.scrollSnapType
      clearChildren()
    },
  }
}

export type PressedHandler = (pressed: boolean, event: PointerEvent) => void
export type PressedOptions = {
  /** CSS class while pressed. Default `pressed`. */
  class?: string
  handler?: PressedHandler | null
}

function normalizePressed(param?: PressedOptions | string | boolean | null): {
  enabled: boolean
  className: string
  handler: PressedHandler | null | undefined
} {
  if (param === false || param === null) {
    return { enabled: false, className: 'pressed', handler: undefined }
  }
  if (param === true || param === undefined) {
    return { enabled: true, className: 'pressed', handler: undefined }
  }
  if (typeof param === 'string') {
    return { enabled: true, className: param || 'pressed', handler: undefined }
  }
  return {
    enabled: true,
    className: param.class || 'pressed',
    handler: param.handler,
  }
}

/**
 * `use:` action that toggles a class (and optional handler) while the pointer is down.
 * Pass a class name string, `{ class, handler }`, or `false`/`null` to disable.
 */
export function pressed(node: Element, param?: PressedOptions | string | boolean | null) {
  let opts = normalizePressed(param)
  let down = false

  const apply = (next: boolean, event: PointerEvent) => {
    if (down === next) return
    down = next
    if (opts.className) {
      if (next) node.classList.add(opts.className)
      else node.classList.remove(opts.className)
    }
    opts.handler?.(next, event)
  }

  const onDown = (event: Event) => {
    if (!opts.enabled) return
    apply(true, event as PointerEvent)
  }
  const onUp = (event: Event) => {
    if (!opts.enabled) return
    apply(false, event as PointerEvent)
  }

  node.addEventListener('pointerdown', onDown)
  node.addEventListener('pointerup', onUp)
  node.addEventListener('pointercancel', onUp)
  node.addEventListener('pointerleave', onUp)

  return {
    update(next?: PressedOptions | string | boolean | null) {
      const prevClass = opts.className
      opts = normalizePressed(next)
      if (prevClass && prevClass !== opts.className) node.classList.remove(prevClass)
      if (!opts.enabled) {
        if (prevClass) node.classList.remove(prevClass)
        down = false
        return
      }
      if (down && opts.className) node.classList.add(opts.className)
    },
    destroy() {
      node.removeEventListener('pointerdown', onDown)
      node.removeEventListener('pointerup', onUp)
      node.removeEventListener('pointercancel', onUp)
      node.removeEventListener('pointerleave', onUp)
      if (opts.className) node.classList.remove(opts.className)
    },
  }
}

export type FocusHandler = (focused: boolean, event: FocusEvent) => void

/**
 * `use:` action that reports whether `node` itself is focused (not descendants).
 * Pass a handler `(focused, event) => …`, or `null` to disable.
 */
export function focus(node: Element, handler?: FocusHandler | null) {
  let current: FocusHandler | null | undefined = handler
  let focused = false
  const set = (next: boolean, event: FocusEvent) => {
    if (focused === next) return
    focused = next
    if (current) current(next, event)
  }
  const onFocus = (event: Event) => {
    if (!current) return
    set(true, event as FocusEvent)
  }
  const onBlur = (event: Event) => {
    if (!current) return
    set(false, event as FocusEvent)
  }
  node.addEventListener('focus', onFocus)
  node.addEventListener('blur', onBlur)
  return {
    update(next?: FocusHandler | null) {
      current = next
    },
    destroy() {
      node.removeEventListener('focus', onFocus)
      node.removeEventListener('blur', onBlur)
    },
  }
}

export type FocusWithinHandler = (focused: boolean, event: FocusEvent) => void

/**
 * `use:` action that reports whether focus is inside `node` (including descendants).
 * Pass a handler `(focused, event) => …`, or `null` to disable.
 */
export function focusWithin(node: Element, handler?: FocusWithinHandler | null) {
  let current: FocusWithinHandler | null | undefined = handler
  let inside = false
  const set = (next: boolean, event: FocusEvent) => {
    if (inside === next) return
    inside = next
    if (current) current(next, event)
  }
  const onFocusIn = (event: Event) => {
    if (!current) return
    set(true, event as FocusEvent)
  }
  const onFocusOut = (event: Event) => {
    if (!current) return
    const e = event as FocusEvent
    const next = e.relatedTarget
    if (next && typeof (node as { contains?: (n: Node) => boolean }).contains === 'function') {
      if (node.contains(next as Node)) return
    }
    set(false, e)
  }
  node.addEventListener('focusin', onFocusIn)
  node.addEventListener('focusout', onFocusOut)
  return {
    update(next?: FocusWithinHandler | null) {
      current = next
    },
    destroy() {
      node.removeEventListener('focusin', onFocusIn)
      node.removeEventListener('focusout', onFocusOut)
    },
  }
}

export type FocusVisibleHandler = (visible: boolean, event: FocusEvent) => void
export type FocusVisibleOptions = {
  /** CSS class when keyboard-focused. Default `focus-visible`. */
  class?: string
  handler?: FocusVisibleHandler | null
}

function normalizeFocusVisible(param?: FocusVisibleOptions | string | boolean | null): {
  enabled: boolean
  className: string
  handler: FocusVisibleHandler | null | undefined
} {
  if (param === false || param === null) {
    return { enabled: false, className: 'focus-visible', handler: undefined }
  }
  if (param === true || param === undefined) {
    return { enabled: true, className: 'focus-visible', handler: undefined }
  }
  if (typeof param === 'string') {
    return { enabled: true, className: param || 'focus-visible', handler: undefined }
  }
  return {
    enabled: true,
    className: param.class || 'focus-visible',
    handler: param.handler,
  }
}

/**
 * `use:` action that toggles a class (and optional handler) when the element
 * matches `:focus-visible` (keyboard focus, not mouse click).
 * Pass `false`/`null` to disable, a class name string, or `{ class, handler }`.
 */
export function focusVisible(node: Element, param?: FocusVisibleOptions | string | boolean | null) {
  let opts = normalizeFocusVisible(param)
  let visible = false

  const apply = (next: boolean, event: FocusEvent) => {
    if (visible === next) return
    visible = next
    if (opts.className) {
      if (next) node.classList.add(opts.className)
      else node.classList.remove(opts.className)
    }
    opts.handler?.(next, event)
  }

  const sync = (event: FocusEvent) => {
    if (!opts.enabled) return
    let match = false
    try {
      match = typeof (node as HTMLElement).matches === 'function' && node.matches(':focus-visible')
    } catch {
      match = document.activeElement === node
    }
    apply(match, event)
  }

  const onFocus = (event: Event) => sync(event as FocusEvent)
  const onBlur = (event: Event) => {
    if (!opts.enabled) return
    apply(false, event as FocusEvent)
  }

  node.addEventListener('focus', onFocus)
  node.addEventListener('blur', onBlur)

  return {
    update(next?: FocusVisibleOptions | string | boolean | null) {
      const prevClass = opts.className
      opts = normalizeFocusVisible(next)
      if (prevClass && prevClass !== opts.className) node.classList.remove(prevClass)
      if (!opts.enabled) {
        if (prevClass) node.classList.remove(prevClass)
        visible = false
        return
      }
      if (visible && opts.className) node.classList.add(opts.className)
    },
    destroy() {
      node.removeEventListener('focus', onFocus)
      node.removeEventListener('blur', onBlur)
      if (opts.className) node.classList.remove(opts.className)
    },
  }
}

export type DownloadData = string | Blob

export type DownloadOptions = {
  filename: string
  data: DownloadData | (() => DownloadData)
  /** MIME type when `data` is a string. Default `text/plain`. */
  type?: string
}

/**
 * `use:` action that downloads a file on click.
 * Pass `{ filename, data }` (data may be a getter), or `null` to disable.
 */
export function download(node: Element, options?: DownloadOptions | null) {
  let current: DownloadOptions | null | undefined = options
  const onClick = () => {
    if (!current?.filename) return
    const raw = typeof current.data === 'function' ? current.data() : current.data
    if (raw == null) return
    const doc = (globalThis as { document?: Document }).document
    const gURL = (globalThis as { URL?: typeof URL }).URL
    if (!doc || typeof doc.createElement !== 'function' || !gURL) return

    const blob =
      typeof Blob !== 'undefined' && raw instanceof Blob
        ? raw
        : new Blob([String(raw)], { type: current.type || 'text/plain' })
    const href = gURL.createObjectURL(blob)
    const a = doc.createElement('a')
    a.href = href
    a.download = current.filename
    a.rel = 'noopener'
    doc.body?.appendChild(a)
    a.click()
    a.remove()
    if (typeof gURL.revokeObjectURL === 'function') gURL.revokeObjectURL(href)
  }
  node.addEventListener('click', onClick)
  return {
    update(next?: DownloadOptions | null) {
      current = next
    },
    destroy() {
      node.removeEventListener('click', onClick)
    },
  }
}

/**
 * `use:` action that toggles Fullscreen API for `node` on click.
 * Pass `false` to disable; `destroy` exits fullscreen if this node is active.
 */
export function fullscreen(node: Element, enabled: boolean | null | undefined = true) {
  let active = enabled !== false && enabled != null
  const onClick = () => {
    if (!active) return
    const doc = (globalThis as { document?: Document }).document
    if (!doc) return
    const el = node as HTMLElement & { requestFullscreen?: () => Promise<void> }
    if (doc.fullscreenElement === node) {
      if (typeof doc.exitFullscreen === 'function') void doc.exitFullscreen().catch(() => {})
      return
    }
    if (typeof el.requestFullscreen === 'function') void el.requestFullscreen().catch(() => {})
  }
  node.addEventListener('click', onClick)
  return {
    update(next?: boolean | null) {
      active = next !== false && next != null
    },
    destroy() {
      node.removeEventListener('click', onClick)
      const doc = (globalThis as { document?: Document }).document
      if (doc && doc.fullscreenElement === node && typeof doc.exitFullscreen === 'function') {
        void doc.exitFullscreen().catch(() => {})
      }
    },
  }
}

export type ResizeHandler = (entry: ResizeObserverEntry) => void

/**
 * `use:` action that observes `node` size via `ResizeObserver`.
 * Pass a handler, or `null` to disable without disconnecting (reconnects on next handler).
 */
export function resize(node: Element, handler?: ResizeHandler | null) {
  const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver
  if (typeof RO !== 'function') {
    return {
      update(_next?: ResizeHandler | null) {},
      destroy() {},
    }
  }
  let current: ResizeHandler | null | undefined = handler
  const observer = new RO((entries) => {
    if (!current) return
    const entry = entries[0]
    if (entry) current(entry)
  })
  observer.observe(node)
  return {
    update(next?: ResizeHandler | null) {
      current = next
    },
    destroy() {
      observer.disconnect()
    },
  }
}

export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

export type SwipeInfo = {
  direction: SwipeDirection
  dx: number
  dy: number
}

export type SwipeHandler = (info: SwipeInfo) => void

export type SwipeOptions = {
  handler: SwipeHandler
  /** Minimum movement in px. Default `40`. */
  threshold?: number
}

function normalizeSwipe(
  param?: SwipeHandler | SwipeOptions | null,
): { handler: SwipeHandler | null; threshold: number } {
  if (param == null) return { handler: null, threshold: 40 }
  if (typeof param === 'function') return { handler: param, threshold: 40 }
  const t = Number(param.threshold)
  return {
    handler: param.handler ?? null,
    threshold: Number.isFinite(t) && t > 0 ? t : 40,
  }
}

/**
 * `use:` action that detects pointer swipes on `node`.
 * Accepts a handler or `{ handler, threshold }` (default 40px). Pass `null` to disable.
 */
export function swipe(node: Element, param?: SwipeHandler | SwipeOptions | null) {
  let opts = normalizeSwipe(param)
  let startX = 0
  let startY = 0
  let tracking = false

  const onDown = (event: Event) => {
    if (!opts.handler) return
    const e = event as PointerEvent
    if (typeof e.button === 'number' && e.button !== 0) return
    tracking = true
    startX = e.clientX
    startY = e.clientY
  }

  const onUp = (event: Event) => {
    if (!tracking || !opts.handler) {
      tracking = false
      return
    }
    tracking = false
    const e = event as PointerEvent
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    const ax = Math.abs(dx)
    const ay = Math.abs(dy)
    if (Math.max(ax, ay) < opts.threshold) return
    const direction: SwipeDirection =
      ax >= ay ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    opts.handler({ direction, dx, dy })
  }

  const onCancel = () => {
    tracking = false
  }

  node.addEventListener('pointerdown', onDown)
  node.addEventListener('pointerup', onUp)
  node.addEventListener('pointercancel', onCancel)
  node.addEventListener('pointerleave', onCancel)

  return {
    update(next?: SwipeHandler | SwipeOptions | null) {
      opts = normalizeSwipe(next)
      if (!opts.handler) tracking = false
    },
    destroy() {
      node.removeEventListener('pointerdown', onDown)
      node.removeEventListener('pointerup', onUp)
      node.removeEventListener('pointercancel', onCancel)
      node.removeEventListener('pointerleave', onCancel)
    },
  }
}

export type PinchInfo = {
  /** Scale relative to the distance when the second pointer landed (1 = unchanged). */
  scale: number
  centerX: number
  centerY: number
  event: PointerEvent
}

export type PinchHandler = (info: PinchInfo) => void

/**
 * `use:` action that reports two-pointer pinch scale on `node`.
 * Pass `null` to disable.
 */
export function pinch(node: Element, handler?: PinchHandler | null) {
  let current: PinchHandler | null | undefined = handler
  const pointers = new Map<number, { x: number; y: number }>()
  let originDist = 0

  const dist = () => {
    const pts = [...pointers.values()]
    if (pts.length < 2) return 0
    const dx = pts[1]!.x - pts[0]!.x
    const dy = pts[1]!.y - pts[0]!.y
    return Math.hypot(dx, dy)
  }

  const center = () => {
    const pts = [...pointers.values()]
    return {
      x: (pts[0]!.x + pts[1]!.x) / 2,
      y: (pts[0]!.y + pts[1]!.y) / 2,
    }
  }

  const onDown = (event: Event) => {
    if (!current) return
    const e = event as PointerEvent
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2) {
      originDist = dist() || 1
    }
  }

  const onMove = (event: Event) => {
    if (!current || pointers.size < 2) return
    const e = event as PointerEvent
    if (!pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const d = dist()
    const c = center()
    current({
      scale: d / originDist,
      centerX: c.x,
      centerY: c.y,
      event: e,
    })
  }

  const onUp = (event: Event) => {
    const e = event as PointerEvent
    pointers.delete(e.pointerId)
    if (pointers.size < 2) originDist = 0
  }

  node.addEventListener('pointerdown', onDown)
  node.addEventListener('pointermove', onMove)
  node.addEventListener('pointerup', onUp)
  node.addEventListener('pointercancel', onUp)

  return {
    update(next?: PinchHandler | null) {
      current = next
      if (!current) {
        pointers.clear()
        originDist = 0
      }
    },
    destroy() {
      node.removeEventListener('pointerdown', onDown)
      node.removeEventListener('pointermove', onMove)
      node.removeEventListener('pointerup', onUp)
      node.removeEventListener('pointercancel', onUp)
    },
  }
}

export type TooltipOptions = {
  content: string
  /** Delay before showing, ms. Default `0`. */
  delay?: number
}

/**
 * `use:` action that shows a lightweight tooltip on hover/focus.
 * Pass a string, `{ content, delay }`, or `null` to disable.
 */
export function tooltip(node: Element, param?: string | TooltipOptions | null) {
  let content = ''
  let delay = 0
  let tip: HTMLElement | null = null
  let timer = 0
  let visible = false

  const normalize = (next?: string | TooltipOptions | null) => {
    if (next == null || next === '') {
      content = ''
      delay = 0
      return
    }
    if (typeof next === 'string') {
      content = next
      delay = 0
      return
    }
    content = next.content ?? ''
    delay = Math.max(0, Number(next.delay) || 0)
  }

  const hide = () => {
    if (timer && typeof clearTimeout === 'function') clearTimeout(timer)
    timer = 0
    visible = false
    if (tip) {
      tip.remove()
      tip = null
    }
  }

  const place = () => {
    if (!tip) return
    const rect = node.getBoundingClientRect()
    tip.style.left = `${rect.left + rect.width / 2 + (typeof window !== 'undefined' ? window.scrollX : 0)}px`
    tip.style.top = `${rect.bottom + 6 + (typeof window !== 'undefined' ? window.scrollY : 0)}px`
  }

  const show = () => {
    if (!content || typeof document === 'undefined') return
    hide()
    tip = document.createElement('div')
    tip.setAttribute('role', 'tooltip')
    tip.setAttribute('data-avedon-tooltip', '')
    tip.textContent = content
    tip.style.position = 'absolute'
    tip.style.transform = 'translateX(-50%)'
    tip.style.zIndex = '9999'
    tip.style.pointerEvents = 'none'
    tip.style.padding = '4px 8px'
    tip.style.background = '#111'
    tip.style.color = '#fff'
    tip.style.fontSize = '12px'
    tip.style.borderRadius = '4px'
    document.body.appendChild(tip)
    place()
    visible = true
  }

  const scheduleShow = () => {
    if (!content) return
    if (timer && typeof clearTimeout === 'function') clearTimeout(timer)
    if (delay <= 0) {
      show()
      return
    }
    timer = setTimeout(show, delay) as unknown as number
  }

  normalize(param)

  node.addEventListener('pointerenter', scheduleShow)
  node.addEventListener('pointerleave', hide)
  node.addEventListener('focusin', scheduleShow)
  node.addEventListener('focusout', hide)

  return {
    update(next?: string | TooltipOptions | null) {
      normalize(next)
      if (!content) hide()
      else if (visible) show()
    },
    destroy() {
      hide()
      node.removeEventListener('pointerenter', scheduleShow)
      node.removeEventListener('pointerleave', hide)
      node.removeEventListener('focusin', scheduleShow)
      node.removeEventListener('focusout', hide)
    },
  }
}

export type MutateHandler = (records: MutationRecord[]) => void

export type MutateOptions = {
  handler: MutateHandler
  childList?: boolean
  attributes?: boolean
  characterData?: boolean
  subtree?: boolean
  attributeFilter?: string[]
}

function normalizeMutate(param?: MutateHandler | MutateOptions | null): {
  handler: MutateHandler | null
  init: MutationObserverInit
} {
  if (param == null) {
    return { handler: null, init: { childList: true, subtree: true } }
  }
  if (typeof param === 'function') {
    return { handler: param, init: { childList: true, subtree: true } }
  }
  const init: MutationObserverInit = {
    childList: param.childList !== false,
    subtree: param.subtree !== false,
  }
  if (param.attributes) init.attributes = true
  if (param.characterData) init.characterData = true
  if (param.attributeFilter?.length) {
    init.attributes = true
    init.attributeFilter = param.attributeFilter
  }
  return { handler: param.handler ?? null, init }
}

/**
 * `use:` action that observes DOM mutations under `node` via `MutationObserver`.
 * Accepts a handler or options (`childList`/`subtree` default true). Pass `null` to disable.
 */
export function mutate(node: Element, param?: MutateHandler | MutateOptions | null) {
  const MO = (globalThis as { MutationObserver?: typeof MutationObserver }).MutationObserver
  if (typeof MO !== 'function') {
    return {
      update(_next?: MutateHandler | MutateOptions | null) {},
      destroy() {},
    }
  }
  let opts = normalizeMutate(param)
  const observer = new MO((records) => {
    if (!opts.handler) return
    opts.handler(records)
  })
  if (opts.handler) observer.observe(node, opts.init)

  return {
    update(next?: MutateHandler | MutateOptions | null) {
      opts = normalizeMutate(next)
      observer.disconnect()
      if (opts.handler) observer.observe(node, opts.init)
    },
    destroy() {
      observer.disconnect()
    },
  }
}

export type StickyHandler = (stuck: boolean) => void

/**
 * `use:` action that reports when a `position: sticky` element is stuck.
 * Compares `getBoundingClientRect().top` to the computed `top` offset on scroll/resize.
 * Pass `null` to disable notifications.
 */
export function sticky(node: Element, handler?: StickyHandler | null) {
  const w = (globalThis as { window?: Window; getComputedStyle?: typeof getComputedStyle }).window
  const getComputedStyleFn = (globalThis as { getComputedStyle?: typeof getComputedStyle }).getComputedStyle
  if (!w || typeof (node as HTMLElement).getBoundingClientRect !== 'function') {
    return {
      update(_next?: StickyHandler | null) {},
      destroy() {},
    }
  }

  let current: StickyHandler | null | undefined = handler
  let stuck = false
  const setStuck = (next: boolean) => {
    if (stuck === next) return
    stuck = next
    if (current) current(next)
  }

  const check = () => {
    const el = node as HTMLElement
    const style = typeof getComputedStyleFn === 'function' ? getComputedStyleFn(el) : null
    const pos = style?.position ?? ''
    if (pos !== 'sticky' && pos !== '-webkit-sticky') {
      setStuck(false)
      return
    }
    const top = style ? Number.parseFloat(style.top) || 0 : 0
    const rectTop = el.getBoundingClientRect().top
    setStuck(rectTop <= top + 0.5)
  }

  const onScroll = () => {
    check()
  }
  w.addEventListener('scroll', onScroll, { passive: true })
  w.addEventListener('resize', onScroll)
  if (typeof queueMicrotask === 'function') queueMicrotask(check)
  else Promise.resolve().then(check)

  return {
    update(next?: StickyHandler | null) {
      current = next
    },
    destroy() {
      w.removeEventListener('scroll', onScroll)
      w.removeEventListener('resize', onScroll)
    },
  }
}

export type DragPhase = 'start' | 'move' | 'end'

export type DragInfo = {
  phase: DragPhase
  dx: number
  dy: number
  x: number
  y: number
  event: PointerEvent
}

export type DragHandler = (info: DragInfo) => void

/**
 * `use:` action that reports pointer drag start/move/end with deltas from the press point.
 * Pass `null` to disable.
 */
export function drag(node: Element, handler?: DragHandler | null) {
  let current: DragHandler | null | undefined = handler
  let startX = 0
  let startY = 0
  let pointerId: number | null = null
  const el = node as HTMLElement & {
    setPointerCapture?: (id: number) => void
    releasePointerCapture?: (id: number) => void
  }

  const onDown = (event: Event) => {
    if (!current) return
    const e = event as PointerEvent
    if (typeof e.button === 'number' && e.button !== 0) return
    pointerId = typeof e.pointerId === 'number' ? e.pointerId : 0
    startX = e.clientX
    startY = e.clientY
    try {
      el.setPointerCapture?.(pointerId)
    } catch {
      /* ignore */
    }
    current({ phase: 'start', dx: 0, dy: 0, x: e.clientX, y: e.clientY, event: e })
  }

  const onMove = (event: Event) => {
    if (!current || pointerId == null) return
    const e = event as PointerEvent
    if (typeof e.pointerId === 'number' && e.pointerId !== pointerId) return
    current({
      phase: 'move',
      dx: e.clientX - startX,
      dy: e.clientY - startY,
      x: e.clientX,
      y: e.clientY,
      event: e,
    })
  }

  const end = (event: Event) => {
    if (pointerId == null) return
    const e = event as PointerEvent
    if (typeof e.pointerId === 'number' && e.pointerId !== pointerId) return
    const id = pointerId
    pointerId = null
    try {
      el.releasePointerCapture?.(id)
    } catch {
      /* ignore */
    }
    if (current) {
      current({
        phase: 'end',
        dx: e.clientX - startX,
        dy: e.clientY - startY,
        x: e.clientX,
        y: e.clientY,
        event: e,
      })
    }
  }

  node.addEventListener('pointerdown', onDown)
  node.addEventListener('pointermove', onMove)
  node.addEventListener('pointerup', end)
  node.addEventListener('pointercancel', end)

  return {
    update(next?: DragHandler | null) {
      current = next
      if (!current) pointerId = null
    },
    destroy() {
      node.removeEventListener('pointerdown', onDown)
      node.removeEventListener('pointermove', onMove)
      node.removeEventListener('pointerup', end)
      node.removeEventListener('pointercancel', end)
    },
  }
}

export type DropzoneHandler = (files: File[], event: DragEvent) => void

export type DropzoneOptions = {
  handler: DropzoneHandler
  /** Called when the drag enters/leaves the zone (refcount-safe for children). */
  onActive?: (active: boolean) => void
}

function normalizeDropzone(
  param?: DropzoneHandler | DropzoneOptions | null,
): { handler: DropzoneHandler | null; onActive?: (active: boolean) => void } {
  if (param == null) return { handler: null }
  if (typeof param === 'function') return { handler: param }
  return { handler: param.handler ?? null, onActive: param.onActive }
}

/**
 * `use:` action that accepts file drops on `node`.
 * Accepts a handler or `{ handler, onActive }`. Pass `null` to disable.
 */
export function dropzone(node: Element, param?: DropzoneHandler | DropzoneOptions | null) {
  let opts = normalizeDropzone(param)
  let enterDepth = 0

  const setActive = (active: boolean) => {
    opts.onActive?.(active)
  }

  const onDragEnter = (event: Event) => {
    if (!opts.handler) return
    event.preventDefault()
    enterDepth += 1
    if (enterDepth === 1) setActive(true)
  }

  const onDragOver = (event: Event) => {
    if (!opts.handler) return
    event.preventDefault()
  }

  const onDragLeave = (event: Event) => {
    if (!opts.handler) return
    enterDepth = Math.max(0, enterDepth - 1)
    if (enterDepth === 0) setActive(false)
  }

  const onDrop = (event: Event) => {
    if (!opts.handler) return
    const e = event as DragEvent
    e.preventDefault()
    enterDepth = 0
    setActive(false)
    const list = e.dataTransfer?.files
    const files = list ? Array.from(list) : []
    opts.handler(files, e)
  }

  node.addEventListener('dragenter', onDragEnter)
  node.addEventListener('dragover', onDragOver)
  node.addEventListener('dragleave', onDragLeave)
  node.addEventListener('drop', onDrop)

  return {
    update(next?: DropzoneHandler | DropzoneOptions | null) {
      opts = normalizeDropzone(next)
      if (!opts.handler) {
        enterDepth = 0
        setActive(false)
      }
    },
    destroy() {
      node.removeEventListener('dragenter', onDragEnter)
      node.removeEventListener('dragover', onDragOver)
      node.removeEventListener('dragleave', onDragLeave)
      node.removeEventListener('drop', onDrop)
    },
  }
}

const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export type FocusTrapOptions = {
  /** When `false`, key handling and autofocus are off. Default `true`. */
  enabled?: boolean
  /** Focus the first focusable child when (re)activated. Default `true`. */
  autofocus?: boolean
}

function normalizeFocusTrapOptions(
  options?: FocusTrapOptions | boolean | null,
): { enabled: boolean; autofocus: boolean } {
  if (options == null || options === true) return { enabled: true, autofocus: true }
  if (options === false) return { enabled: false, autofocus: false }
  return {
    enabled: options.enabled !== false,
    autofocus: options.autofocus !== false,
  }
}

function focusableElements(root: Element): HTMLElement[] {
  if (typeof root.querySelectorAll !== 'function') return []
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
    const html = el as HTMLElement
    if (typeof html.focus !== 'function') return false
    if (html.closest?.('[disabled],fieldset[disabled]')) return false
    const style = (globalThis as { getComputedStyle?: (e: Element) => CSSStyleDeclaration }).getComputedStyle?.(
      html,
    )
    if (style && (style.visibility === 'hidden' || style.display === 'none')) return false
    return true
  }) as HTMLElement[]
}

/**
 * `use:` action that traps Tab focus inside `node` (and optionally autofocuses the first control).
 * Pass `false` / `{ enabled: false }` to pause without destroying the listener.
 */
export function focusTrap(node: Element, options?: FocusTrapOptions | boolean | null) {
  const doc = (globalThis as { document?: Document }).document
  if (!doc || typeof doc.addEventListener !== 'function') {
    return {
      update(_next?: FocusTrapOptions | boolean | null) {},
      destroy() {},
    }
  }
  let opts = normalizeFocusTrapOptions(options)

  const activate = () => {
    if (!opts.enabled || !opts.autofocus) return
    const list = focusableElements(node)
    list[0]?.focus()
  }

  const onKeyDown = (event: Event) => {
    if (!opts.enabled) return
    const e = event as KeyboardEvent
    if (e.key !== 'Tab') return
    const list = focusableElements(node)
    if (!list.length) {
      e.preventDefault()
      return
    }
    const first = list[0]!
    const last = list[list.length - 1]!
    const active = doc.activeElement
    if (e.shiftKey) {
      if (active === first || !node.contains(active)) {
        e.preventDefault()
        last.focus()
      }
    } else if (active === last || !node.contains(active)) {
      e.preventDefault()
      first.focus()
    }
  }

  doc.addEventListener('keydown', onKeyDown)
  queueMicrotask(activate)

  return {
    update(next?: FocusTrapOptions | boolean | null) {
      opts = normalizeFocusTrapOptions(next)
      queueMicrotask(activate)
    },
    destroy() {
      doc.removeEventListener('keydown', onKeyDown)
    },
  }
}

let scrollLockCount = 0
let savedHtmlOverflow = ''
let savedBodyOverflow = ''

/** Test helper: reset module scroll-lock refcount after stubbing `document`. */
export function __resetScrollLock() {
  scrollLockCount = 0
  savedHtmlOverflow = ''
  savedBodyOverflow = ''
}

function acquireScrollLock() {
  const doc = (globalThis as { document?: Document }).document
  if (!doc?.documentElement) return
  if (scrollLockCount === 0) {
    savedHtmlOverflow = doc.documentElement.style.overflow
    savedBodyOverflow = doc.body?.style.overflow ?? ''
    doc.documentElement.style.overflow = 'hidden'
    if (doc.body) doc.body.style.overflow = 'hidden'
  }
  scrollLockCount++
}

function releaseScrollLock() {
  const doc = (globalThis as { document?: Document }).document
  if (!doc?.documentElement || scrollLockCount === 0) return
  scrollLockCount--
  if (scrollLockCount !== 0) return
  doc.documentElement.style.overflow = savedHtmlOverflow
  if (doc.body) doc.body.style.overflow = savedBodyOverflow
}

/**
 * `use:` action that locks document scroll while active (refcount-safe for nested usage).
 * Pass `false` to unlock without destroying; default is locked when the action mounts.
 */
export function lockScroll(_node: Element, enabled: boolean | null | undefined = true) {
  let active = false
  const sync = (on: boolean | null | undefined) => {
    const want = on !== false && on != null
    if (want && !active) {
      acquireScrollLock()
      active = true
    } else if (!want && active) {
      releaseScrollLock()
      active = false
    }
  }
  sync(enabled)
  return {
    update(next?: boolean | null) {
      sync(next)
    },
    destroy() {
      sync(false)
    },
  }
}

export type EscapeKeyHandler = (event: KeyboardEvent) => void

/**
 * `use:` action that calls `handler` when Escape is pressed.
 * Pass `null`/`undefined` to disable without destroying the listener.
 */
export function escapeKey(_node: Element, handler?: EscapeKeyHandler | null) {
  const doc = (globalThis as { document?: Document }).document
  if (!doc || typeof doc.addEventListener !== 'function') {
    return {
      update(_next?: EscapeKeyHandler | null) {},
      destroy() {},
    }
  }
  let current: EscapeKeyHandler | null | undefined = handler
  const onKeyDown = (event: Event) => {
    if (!current) return
    const e = event as KeyboardEvent
    if (e.key !== 'Escape') return
    current(e)
  }
  doc.addEventListener('keydown', onKeyDown)
  return {
    update(next?: EscapeKeyHandler | null) {
      current = next
    },
    destroy() {
      doc.removeEventListener('keydown', onKeyDown)
    },
  }
}

export type HotkeyOptions = {
  key: string
  handler: (event: KeyboardEvent) => void
  ctrl?: boolean
  meta?: boolean
  alt?: boolean
  shift?: boolean
  /** Default `true`. */
  preventDefault?: boolean
}

function hotkeyMatches(e: KeyboardEvent, opts: HotkeyOptions): boolean {
  if (e.key !== opts.key) return false
  if (!!opts.ctrl !== e.ctrlKey) return false
  if (!!opts.meta !== e.metaKey) return false
  if (!!opts.alt !== e.altKey) return false
  if (!!opts.shift !== e.shiftKey) return false
  return true
}

/**
 * `use:` action that runs `handler` when a key combination is pressed on `document`.
 * Pass `null` to disable without destroying the listener.
 */
export function hotkey(_node: Element, options?: HotkeyOptions | null) {
  const doc = (globalThis as { document?: Document }).document
  if (!doc || typeof doc.addEventListener !== 'function') {
    return {
      update(_next?: HotkeyOptions | null) {},
      destroy() {},
    }
  }
  let current: HotkeyOptions | null | undefined = options
  const onKeyDown = (event: Event) => {
    if (!current?.handler) return
    const e = event as KeyboardEvent
    if (!hotkeyMatches(e, current)) return
    if (current.preventDefault !== false) e.preventDefault()
    current.handler(e)
  }
  doc.addEventListener('keydown', onKeyDown)
  return {
    update(next?: HotkeyOptions | null) {
      current = next
    },
    destroy() {
      doc.removeEventListener('keydown', onKeyDown)
    },
  }
}

/**
 * `use:` action that runs `handler` when a key combination is pressed on `node`
 * (element must be focusable). Same options as `hotkey`. Pass `null` to disable.
 */
export function keydown(node: Element, options?: HotkeyOptions | null) {
  let current: HotkeyOptions | null | undefined = options
  const onKeyDown = (event: Event) => {
    if (!current?.handler) return
    const e = event as KeyboardEvent
    if (!hotkeyMatches(e, current)) return
    if (current.preventDefault !== false) e.preventDefault()
    current.handler(e)
  }
  node.addEventListener('keydown', onKeyDown)
  return {
    update(next?: HotkeyOptions | null) {
      current = next
    },
    destroy() {
      node.removeEventListener('keydown', onKeyDown)
    },
  }
}

/**
 * `use:` action that runs `handler` when a key combination is released on `node`
 * (element must be focusable). Same options as `hotkey` / `keydown`. Pass `null` to disable.
 */
export function keyup(node: Element, options?: HotkeyOptions | null) {
  let current: HotkeyOptions | null | undefined = options
  const onKeyUp = (event: Event) => {
    if (!current?.handler) return
    const e = event as KeyboardEvent
    if (!hotkeyMatches(e, current)) return
    if (current.preventDefault !== false) e.preventDefault()
    current.handler(e)
  }
  node.addEventListener('keyup', onKeyUp)
  return {
    update(next?: HotkeyOptions | null) {
      current = next
    },
    destroy() {
      node.removeEventListener('keyup', onKeyUp)
    },
  }
}

export type InViewDetail = { isIntersecting: boolean; ratio: number }
export type InViewHandler = (detail: InViewDetail) => void
export type InViewOptions = {
  handler?: InViewHandler | null
  root?: Element | Document | null
  rootMargin?: string
  threshold?: number | number[]
  /** When true, unobserve after the first intersecting callback. */
  once?: boolean
}

function normalizeInViewParam(
  param?: InViewHandler | InViewOptions | null,
): {
  handler: InViewHandler | null | undefined
  root: Element | Document | null | undefined
  rootMargin: string | undefined
  threshold: number | number[] | undefined
  once: boolean
} {
  if (param == null) {
    return { handler: null, root: undefined, rootMargin: undefined, threshold: undefined, once: false }
  }
  if (typeof param === 'function') {
    return { handler: param, root: undefined, rootMargin: undefined, threshold: undefined, once: false }
  }
  return {
    handler: param.handler,
    root: param.root,
    rootMargin: param.rootMargin,
    threshold: param.threshold,
    once: !!param.once,
  }
}

/**
 * `use:` action that observes intersection with the viewport (or a custom root).
 * Pass a handler, or `{ handler, root, rootMargin, threshold, once }`.
 */
export function inView(node: Element, param?: InViewHandler | InViewOptions | null) {
  const IO = (globalThis as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver
  if (typeof IO !== 'function') {
    return {
      update(_next?: InViewHandler | InViewOptions | null) {},
      destroy() {},
    }
  }

  let opts = normalizeInViewParam(param)
  let observer: IntersectionObserver | null = null

  const disconnect = () => {
    observer?.disconnect()
    observer = null
  }

  const connect = () => {
    disconnect()
    if (!opts.handler) return
    observer = new IO(
      (entries) => {
        const entry = entries[0]
        if (!entry || !opts.handler) return
        opts.handler({ isIntersecting: entry.isIntersecting, ratio: entry.intersectionRatio })
        if (opts.once && entry.isIntersecting) disconnect()
      },
      {
        root: (opts.root as Element | null | undefined) ?? null,
        rootMargin: opts.rootMargin,
        threshold: opts.threshold,
      },
    )
    observer.observe(node)
  }

  connect()

  return {
    update(next?: InViewHandler | InViewOptions | null) {
      opts = normalizeInViewParam(next)
      connect()
    },
    destroy() {
      disconnect()
    },
  }
}

export type ScrollIntoViewParam =
  | boolean
  | null
  | (ScrollIntoViewOptions & { /** When false/omitted with only options, still scrolls. Use `when` to gate. */ when?: boolean })

function shouldScrollIntoView(param?: ScrollIntoViewParam): boolean {
  if (param == null || param === false) return false
  if (param === true) return true
  return param.when !== false
}

function scrollIntoViewOpts(param?: ScrollIntoViewParam): ScrollIntoViewOptions | boolean {
  if (param == null || typeof param === 'boolean') return true
  const { when: _when, ...rest } = param
  return Object.keys(rest).length ? rest : true
}

/**
 * `use:` action that scrolls `node` into view when the param is truthy.
 * Pass `true`, `ScrollIntoViewOptions` (optional `when`), or `false`/`null` to skip.
 * Re-enabling via `update` scrolls again.
 */
export function scrollIntoView(node: Element, param?: ScrollIntoViewParam) {
  const run = (next?: ScrollIntoViewParam) => {
    if (!shouldScrollIntoView(next)) return
    const el = node as HTMLElement
    if (typeof el.scrollIntoView !== 'function') return
    try {
      el.scrollIntoView(scrollIntoViewOpts(next))
    } catch {
      /* ignore */
    }
  }
  const schedule = (next?: ScrollIntoViewParam) => {
    if (typeof queueMicrotask === 'function') queueMicrotask(() => run(next))
    else Promise.resolve().then(() => run(next))
  }
  schedule(param)
  return {
    update(next?: ScrollIntoViewParam) {
      schedule(next)
    },
    destroy() {},
  }
}

export type InfiniteScrollHandler = () => void
export type InfiniteScrollOptions = {
  handler?: InfiniteScrollHandler | null
  /** Pixels from the bottom that count as “near end”. Default `200`. */
  offset?: number
  /** When true, ignore scroll triggers. */
  disabled?: boolean
}

function normalizeInfiniteScroll(
  param?: InfiniteScrollHandler | InfiniteScrollOptions | null,
): {
  handler: InfiniteScrollHandler | null | undefined
  offset: number
  disabled: boolean
} {
  if (param == null) {
    return { handler: null, offset: 200, disabled: true }
  }
  if (typeof param === 'function') {
    return { handler: param, offset: 200, disabled: false }
  }
  return {
    handler: param.handler,
    offset: param.offset != null ? Number(param.offset) : 200,
    disabled: !!param.disabled || !param.handler,
  }
}

/**
 * `use:` action that calls `handler` when the element is scrolled near its bottom.
 * Mount on a scrollable container. Pass a handler, `{ handler, offset, disabled }`, or `null` to disable.
 */
export function infiniteScroll(
  node: Element,
  param?: InfiniteScrollHandler | InfiniteScrollOptions | null,
) {
  let opts = normalizeInfiniteScroll(param)
  let armed = true
  const el = node as HTMLElement

  const check = () => {
    if (opts.disabled || !opts.handler) return
    if (typeof el.scrollTop !== 'number') return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    if (dist <= opts.offset) {
      if (!armed) return
      armed = false
      opts.handler()
    } else {
      armed = true
    }
  }

  const onScroll = () => check()
  node.addEventListener('scroll', onScroll, { passive: true })
  if (typeof queueMicrotask === 'function') queueMicrotask(check)
  else Promise.resolve().then(check)

  return {
    update(next?: InfiniteScrollHandler | InfiniteScrollOptions | null) {
      opts = normalizeInfiniteScroll(next)
      armed = true
      check()
    },
    destroy() {
      node.removeEventListener('scroll', onScroll)
    },
  }
}

export type RevealOptions = {
  /** Class toggled while intersecting. Default `revealed`. */
  class?: string
  root?: Element | Document | null
  rootMargin?: string
  threshold?: number | number[]
  /** When true, keep the class after the first intersection. Default `true`. */
  once?: boolean
}

function normalizeReveal(param?: string | RevealOptions | boolean | null): {
  enabled: boolean
  className: string
  root: Element | Document | null | undefined
  rootMargin: string | undefined
  threshold: number | number[] | undefined
  once: boolean
} {
  if (param === false || param === null) {
    return {
      enabled: false,
      className: 'revealed',
      root: undefined,
      rootMargin: undefined,
      threshold: undefined,
      once: true,
    }
  }
  if (param === true || param === undefined) {
    return {
      enabled: true,
      className: 'revealed',
      root: undefined,
      rootMargin: undefined,
      threshold: undefined,
      once: true,
    }
  }
  if (typeof param === 'string') {
    return {
      enabled: true,
      className: param || 'revealed',
      root: undefined,
      rootMargin: undefined,
      threshold: undefined,
      once: true,
    }
  }
  return {
    enabled: true,
    className: param.class || 'revealed',
    root: param.root,
    rootMargin: param.rootMargin,
    threshold: param.threshold,
    once: param.once !== false,
  }
}

/**
 * `use:` action that toggles a CSS class when `node` enters the viewport.
 * Pass a class name, options, `true` / no arg (default class `revealed`), or `false`/`null` to disable.
 */
export function reveal(node: Element, param?: string | RevealOptions | boolean | null) {
  const IO = (globalThis as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver
  if (typeof IO !== 'function' || typeof node.classList?.add !== 'function') {
    return {
      update(_next?: string | RevealOptions | boolean | null) {},
      destroy() {},
    }
  }

  let opts = normalizeReveal(param)
  let observer: IntersectionObserver | null = null

  const clear = () => {
    node.classList.remove(opts.className)
  }

  const disconnect = () => {
    observer?.disconnect()
    observer = null
  }

  const connect = () => {
    disconnect()
    if (!opts.enabled) {
      clear()
      return
    }
    observer = new IO(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        if (entry.isIntersecting) {
          node.classList.add(opts.className)
          if (opts.once) disconnect()
        } else if (!opts.once) {
          node.classList.remove(opts.className)
        }
      },
      {
        root: (opts.root as Element | null | undefined) ?? null,
        rootMargin: opts.rootMargin,
        threshold: opts.threshold,
      },
    )
    observer.observe(node)
  }

  connect()

  return {
    update(next?: string | RevealOptions | boolean | null) {
      const prevClass = opts.className
      opts = normalizeReveal(next)
      if (prevClass !== opts.className) node.classList.remove(prevClass)
      connect()
    },
    destroy() {
      disconnect()
      clear()
    },
  }
}

export type LazyOptions = {
  /** Attribute holding the real URL. Default `data-src`. */
  attribute?: string
  /** Destination attribute. Default `src` (or `srcset` when attribute ends with `srcset`). */
  target?: string
  root?: Element | Document | null
  rootMargin?: string
  threshold?: number | number[]
}

function normalizeLazy(param?: LazyOptions | boolean | null): {
  enabled: boolean
  attribute: string
  target: string
  root: Element | Document | null | undefined
  rootMargin: string | undefined
  threshold: number | number[] | undefined
} {
  if (param === false || param === null) {
    return {
      enabled: false,
      attribute: 'data-src',
      target: 'src',
      root: undefined,
      rootMargin: undefined,
      threshold: undefined,
    }
  }
  if (param === true || param === undefined) {
    return {
      enabled: true,
      attribute: 'data-src',
      target: 'src',
      root: undefined,
      rootMargin: undefined,
      threshold: undefined,
    }
  }
  const attribute = param.attribute || 'data-src'
  const target =
    param.target ||
    (attribute === 'data-srcset' || attribute.endsWith('srcset') ? 'srcset' : 'src')
  return {
    enabled: true,
    attribute,
    target,
    root: param.root,
    rootMargin: param.rootMargin,
    threshold: param.threshold,
  }
}

/**
 * `use:` action that copies a deferred URL onto an element when it enters the viewport
 * (default `data-src` → `src`). Pass options, `true` / no arg, or `false`/`null` to disable.
 */
export function lazy(node: Element, param?: LazyOptions | boolean | null) {
  const IO = (globalThis as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver
  if (typeof IO !== 'function') {
    return {
      update(_next?: LazyOptions | boolean | null) {},
      destroy() {},
    }
  }

  let opts = normalizeLazy(param)
  let observer: IntersectionObserver | null = null
  let loaded = false

  const disconnect = () => {
    observer?.disconnect()
    observer = null
  }

  const apply = () => {
    if (loaded || !opts.enabled) return
    const url = node.getAttribute?.(opts.attribute)
    if (!url) return
    if (opts.target in node) {
      ;(node as unknown as Record<string, string>)[opts.target] = url
    } else {
      node.setAttribute?.(opts.target, url)
    }
    node.removeAttribute?.(opts.attribute)
    loaded = true
    disconnect()
  }

  const connect = () => {
    disconnect()
    if (!opts.enabled || loaded) return
    observer = new IO(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) apply()
      },
      {
        root: (opts.root as Element | null | undefined) ?? null,
        rootMargin: opts.rootMargin,
        threshold: opts.threshold,
      },
    )
    observer.observe(node)
  }

  connect()

  return {
    update(next?: LazyOptions | boolean | null) {
      opts = normalizeLazy(next)
      if (!opts.enabled) disconnect()
      else connect()
    },
    destroy() {
      disconnect()
    },
  }
}

export type ScrollspyHandler = (id: string | null) => void
export type ScrollspyOptions = {
  /** Section element ids (without `#`) or CSS selectors. */
  sections: string[]
  handler?: ScrollspyHandler | null
  root?: Element | Document | null
  rootMargin?: string
  threshold?: number | number[]
}

function resolveScrollspyTarget(selector: string): Element | null {
  if (typeof document === 'undefined') return null
  const trimmed = selector.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('#') || trimmed.startsWith('.') || trimmed.includes(' ')) {
    return document.querySelector(trimmed)
  }
  return document.getElementById(trimmed) ?? document.querySelector(trimmed)
}

/**
 * Observe page sections and report which one is most in view (for nav highlighting).
 * Mount on a nav container; pass section ids/selectors and a handler.
 * Pass `null` to disable.
 *
 * Initial connect is deferred so section targets rendered after the nav still resolve.
 */
export function scrollspy(_node: Element, param?: ScrollspyOptions | null) {
  let current = param
  let observer: IntersectionObserver | null = null
  let disposed = false
  let retry = 0
  const ratios = new Map<Element, number>()

  const emit = () => {
    const handler = current?.handler
    if (!handler) return
    let best: Element | null = null
    let bestRatio = 0
    for (const [el, ratio] of ratios) {
      if (ratio > bestRatio) {
        bestRatio = ratio
        best = el
      }
    }
    handler(best?.id || null)
  }

  const disconnect = () => {
    observer?.disconnect()
    observer = null
    ratios.clear()
  }

  const connect = () => {
    if (disposed) return
    disconnect()
    if (!current?.sections?.length) return
    if (typeof IntersectionObserver === 'undefined') return
    const targets = current.sections
      .map(resolveScrollspyTarget)
      .filter((el): el is Element => el != null)
    if (!targets.length) {
      // Sections may mount after this action (nav-first templates).
      if (retry < 8) {
        retry += 1
        scheduleConnect()
      }
      return
    }
    retry = 0
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0)
        }
        emit()
      },
      {
        root: current.root ?? undefined,
        rootMargin: current.rootMargin,
        threshold: current.threshold ?? [0, 0.25, 0.5, 0.75, 1],
      },
    )
    for (const el of targets) observer.observe(el)
  }

  const scheduleConnect = () => {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => connect())
    } else {
      queueMicrotask(() => connect())
    }
  }

  scheduleConnect()

  return {
    update(next?: ScrollspyOptions | null) {
      current = next
      retry = 0
      scheduleConnect()
    },
    destroy() {
      disposed = true
      disconnect()
    },
  }
}

/** Pending signal values applied on the next mount (dev HMR only). */
let pendingHmrSignals: Record<string, unknown> | null = null
/** Signal bag for the mount currently executing. */
let activeSignalBag: Record<string, Signal<unknown>> | null = null

export type HmrComponentState = {
  data?: Record<string, unknown>
  signals: Record<string, unknown>
}

export function __hmrPrepareSignals(state: Record<string, unknown> | null | undefined) {
  pendingHmrSignals = state && Object.keys(state).length ? { ...state } : null
}

export function __hmrBeginSignalBag(): Record<string, Signal<unknown>> {
  activeSignalBag = {}
  return activeSignalBag
}

export function __hmrEndSignalBag() {
  pendingHmrSignals = null
  activeSignalBag = null
}

export function __hmrSnapshotSignals(bag: Record<string, Signal<unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, s] of Object.entries(bag)) out[k] = s.get()
  return out
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
  let disposed = false
  const run: EffectFn = () => {
    if (disposed) return
    if (typeof cleanup === 'function') cleanup()
    clearEffectSources(run)
    activeEffect = run
    try {
      cleanup = fn()
    } finally {
      activeEffect = null
    }
  }
  run()
  return () => {
    disposed = true
    if (typeof cleanup === 'function') cleanup()
    cleanup = undefined
    clearEffectSources(run)
  }
}

/** Read signals inside `fn` without subscribing the current effect. */
export function untrack<T>(fn: () => T): T {
  const prev = activeEffect
  activeEffect = null
  try {
    return fn()
  } finally {
    activeEffect = prev
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
  /** Dev HMR: snapshot of data + named signal values. */
  getHmrState?(): HmrComponentState
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
  const nextData = doc.getElementById('__AVEDON_DATA__')
  const app = document.getElementById('app')
  const dataEl = document.getElementById('__AVEDON_DATA__')
  if (app && nextApp) {
    moveChildNodes(app, nextApp)
    settleAvedonStream(app)
  }
  if (dataEl && nextData) dataEl.textContent = nextData.textContent
  const nextTitle = doc.querySelector('title')
  if (nextTitle) document.title = nextTitle.textContent ?? document.title
  syncAvedonCss(doc)
}

export function syncAvedonCss(from: ParentNode, toDoc: Document = document) {
  const nextCss = from.querySelector('style[data-avedon-css]')
  let cssEl = toDoc.querySelector('style[data-avedon-css]') as HTMLStyleElement | null
  if (nextCss) {
    if (!cssEl) {
      cssEl = toDoc.createElement('style')
      cssEl.setAttribute('data-avedon-css', '')
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
      credentials: 'same-origin',
    })
    const html = await res.text()
    // After action redirects, fetch follows to the final URL — boot that path, not the form action.
    const finalUrl = new URL(res.url)
    abandonHandler?.()
    applyDocument(html)
    history.pushState({}, '', finalUrl.pathname + finalUrl.search + finalUrl.hash)
    await bootHandler?.(finalUrl.pathname)
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
