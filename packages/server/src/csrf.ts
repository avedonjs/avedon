import { HttpError } from './errors.js'
import type { CsrfOptions } from './types.js'

/**
 * Reject cross-site form POSTs (SvelteKit-style Origin / Referer check).
 * Call before dispatching `actions`. Throws HttpError(403) on failure.
 */
export function assertCsrf(request: Request, csrf: CsrfOptions = {}): void {
  if (csrf === false) return

  const opts = csrf ?? {}
  const allowed = new Set<string>([new URL(request.url).origin])
  for (const o of opts.trustedOrigins ?? []) {
    try {
      allowed.add(new URL(o).origin)
    } catch {
      allowed.add(o)
    }
  }

  const origin = request.headers.get('origin')
  if (origin) {
    if (!allowed.has(origin)) {
      throw new HttpError(403, 'Cross-site POST form submissions are forbidden')
    }
    return
  }

  const referer = request.headers.get('referer')
  if (referer) {
    try {
      if (allowed.has(new URL(referer).origin)) return
    } catch {
      /* invalid referer */
    }
    throw new HttpError(403, 'Cross-site POST form submissions are forbidden')
  }

  throw new HttpError(403, 'Cross-site POST form submissions are forbidden')
}
