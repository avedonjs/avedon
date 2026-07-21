import type { LoadEvent } from '@vexjs/server'

/** Fake auth: deny everyone (demo for 403). Pass ?auth=1 to allow. */
export function requireAuth(event: LoadEvent): boolean {
  return event.url.searchParams.get('auth') === '1'
}
