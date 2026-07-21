export class HttpError extends Error {
  status: number
  body: string

  constructor(status: number, body: string = '') {
    super(body || `HTTP ${status}`)
    this.name = 'HttpError'
    this.status = status
    this.body = body
  }
}

export function isHttpError(err: unknown): err is HttpError {
  if (err instanceof HttpError) return true
  if (!err || typeof err !== 'object') return false
  const e = err as HttpError
  return e.name === 'HttpError' && typeof e.status === 'number'
}

export function notFound(message = 'Not Found'): never {
  throw new HttpError(404, message)
}

export function error(status: number, message = ''): never {
  throw new HttpError(status, message)
}

export function redirect(url: string, status = 302): never {
  throw new Response(null, {
    status,
    headers: { Location: url },
  })
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  if (!headers.has('content-type')) headers.set('content-type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(data), { ...init, headers })
}
