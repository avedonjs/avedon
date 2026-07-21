import type { HandleArgs, Middleware } from './types.js'

/**
 * Compose middleware outer → inner (first handler sees the request first).
 * Empty sequence calls `resolve` directly.
 */
export function sequence(...handlers: Middleware[]): Middleware {
  if (handlers.length === 0) {
    return ({ request, resolve }) => resolve(request)
  }

  return (args: HandleArgs) => {
    let i = 0
    const dispatch = (request: Request): Promise<Response> => {
      const handler = handlers[i++]
      if (!handler) return args.resolve(request)
      return Promise.resolve(
        handler({
          request,
          resolve: dispatch,
        }),
      )
    }
    return dispatch(args.request)
  }
}
