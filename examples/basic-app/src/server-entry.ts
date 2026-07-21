import { routes } from './routes'
import appHtml from './app.html?raw'
import hooks from './hooks.server'
import * as errorComponent from './error.avedon'
import * as notFoundComponent from './not-found.avedon'

/** Dev default; set SESSION_SECRET in production (32+ chars). */
export const session = {
  secret:
    process.env.SESSION_SECRET ?? 'dev-only-session-secret-32chars-min!!',
}

export { routes, appHtml, hooks, errorComponent, notFoundComponent }
