/** True when the cached page should be regenerated (SWR trigger). `revalidateSec <= 0` → always stale. */
export function isStale(mtimeMs: number, revalidateSec: number, now = Date.now()): boolean {
  if (revalidateSec <= 0) return true
  return now - mtimeMs >= revalidateSec * 1000
}

/** Deduplicate concurrent background work per key (e.g. pathname). */
export function createPathLock() {
  const inflight = new Map<string, Promise<void>>()

  return {
    /** Fire-and-forget; skips if `key` already regenerating. */
    run(key: string, fn: () => Promise<void>): void {
      if (inflight.has(key)) return
      const p = Promise.resolve()
        .then(fn)
        .catch((err) => {
          console.error('[avedon isr]', key, err)
        })
        .finally(() => {
          if (inflight.get(key) === p) inflight.delete(key)
        })
      inflight.set(key, p)
    },
    has(key: string): boolean {
      return inflight.has(key)
    },
    get size(): number {
      return inflight.size
    },
  }
}

export type PathLock = ReturnType<typeof createPathLock>
