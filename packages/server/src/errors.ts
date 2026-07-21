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
  return err instanceof HttpError
}

export function notFound(message = 'Not Found'): never {
  throw new HttpError(404, message)
}

export function error(status: number, message = ''): never {
  throw new HttpError(status, message)
}

export function redirect(url: string, status = 302): never {
  throw Response.redirect(url, status)
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  if (!headers.has('content-type')) headers.set('content-type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(data), { ...init, headers })
}
