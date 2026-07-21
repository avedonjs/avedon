import { cors, logger, rateLimit, type HandleHook } from '@avedon/server'

export const middleware = [
  logger(),
  rateLimit({ max: 200, windowMs: 60_000 }),
  cors({ origin: true }),
]

/** Optional escape hatch; runs after `middleware`, before the core pipeline. */
export const handle: HandleHook = async ({ request, resolve }) => {
  return resolve(request)
}

export default { middleware, handle }
