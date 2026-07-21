import { cors, logger, rateLimit } from '@vexjs/server'

export const middleware = [
  logger(),
  rateLimit({ max: 200, windowMs: 60_000 }),
  cors({ origin: true }),
]

export default { middleware }
