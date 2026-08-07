import { logger, rateLimit, type HandleHook } from '@avedon/server'

export const middleware = [
  logger(),
  // Default key does not trust X-Forwarded-For. Behind a reverse proxy, pass
  // `trustForwarded: true` or a custom `key` that reads the proxy’s client IP header.
  rateLimit({ max: 200, windowMs: 60_000 }),
  // Add cors({ origin: 'https://your.app' }) when you need cross-origin browser access.
  // Avoid cors({ origin: true }) in production — it reflects any Origin.
]

/** Optional escape hatch; runs after `middleware`, before the core pipeline. */
export const handle: HandleHook = async ({ request, resolve }) => {
  return resolve(request)
}

export default { middleware, handle }
