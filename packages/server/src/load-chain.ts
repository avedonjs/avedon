import type { AvedonComponentModule, LoadEvent } from './types.js'

/**
 * Run layout loads (outer → inner) then leaf load, merging objects.
 * `layouts` is innermost-first (pipeline wrap order); we reverse for load order.
 * Later loads overwrite earlier keys. Returns a Response if any load short-circuits.
 */
export async function loadRouteChain(
  layouts: AvedonComponentModule[],
  leaf: AvedonComponentModule,
  event: LoadEvent,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown> | Response> {
  let data: Record<string, unknown> = { ...extra }
  for (const mod of [...layouts].reverse()) {
    if (!mod.load) continue
    const loaded = await mod.load(event)
    if (loaded instanceof Response) return loaded
    if (loaded) data = { ...data, ...loaded }
  }
  if (leaf.load) {
    const loaded = await leaf.load(event)
    if (loaded instanceof Response) return loaded
    if (loaded) data = { ...data, ...loaded }
  }
  return data
}
