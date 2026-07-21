import { routes } from './routes'
import appHtml from './app.html?raw'
import hooks from './hooks.server'
import * as errorComponent from './error.vex'
import * as notFoundComponent from './not-found.vex'

/** Dev default; set SESSION_SECRET in production (32+ chars). */
export const session = {
  secret:
    process.env.SESSION_SECRET ?? 'dev-only-session-secret-32chars-min!!',
}

export { routes, appHtml, hooks, errorComponent, notFoundComponent }
