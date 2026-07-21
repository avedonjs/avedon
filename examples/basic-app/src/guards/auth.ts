import { requireSession } from '@vexjs/server'

/** Session guard: set cookie via login action (see docs/session.md). */
export const requireAuth = requireSession({ redirectTo: '/?login=1' })
