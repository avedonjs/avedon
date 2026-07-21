/** Shared types for vexjs packages. */

export type RenderMode = 'ssr' | 'ssg' | 'csr'

/** Flatten intersections for readable/assignable param records. */
export type Simplify<T> = { [K in keyof T]: T[K] }

/** Merge param records (child keys win on overlap). */
export type MergeParams<Parent extends object, Child extends object> = Simplify<
  Omit<Parent, keyof Child> & Child
>

/** Extract param names from a path pattern like `/posts/:id` / `/x/:id?` / `*wildcard`. */
export type ExtractParams<Path extends string> = Simplify<_ExtractParams<Path>>

type _ExtractParams<Path extends string> =
  Path extends `${infer _Start}:${infer Rest}`
    ? Rest extends `${infer Param}/${infer Tail}`
      ? (Param extends `${infer Name}?` ? { [K in Name]?: string } : { [K in Param]: string }) &
          _ExtractParams<`/${Tail}`>
      : Rest extends `${infer Param}?`
        ? { [K in Param]?: string }
        : Rest extends `*${infer Wild}`
          ? Wild extends ''
            ? { '*': string }
            : { [K in Wild]: string }
          : { [K in Rest]: string }
    : Path extends `${infer _Start}*${infer Wild}`
      ? Wild extends ''
        ? { '*': string }
        : { [K in Wild]: string }
      : {}

/** Join a parent route path with a relative/absolute child path. */
export type JoinPaths<Parent extends string, Child extends string> = Parent extends '/'
  ? Child extends `/${string}`
    ? Child
    : `/${Child}`
  : Child extends `/${infer Rest}`
    ? `${TrimTrailingSlash<Parent>}/${Rest}`
    : `${TrimTrailingSlash<Parent>}/${Child}`

type TrimTrailingSlash<S extends string> = S extends `${infer R}/` ? TrimTrailingSlash<R> : S

export type ParamsRecord = Record<string, string | undefined>

export type CookieSerializeOptions = {
  path?: string
  domain?: string
  maxAge?: number
  expires?: Date
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
}

/** Read/write cookies for the current request (server). */
export interface Cookies {
  get(name: string): string | undefined
  getAll(): Record<string, string>
  set(name: string, value: string, opts?: CookieSerializeOptions): void
  delete(name: string, opts?: CookieSerializeOptions): void
}

/** Sealed session payload (server; present when handler session is configured). */
export interface Session<T extends Record<string, unknown> = Record<string, unknown>> {
  data: T | null
  set(data: T): void
  destroy(): void
}

export interface LoadContext<Params extends object = Record<string, string>> {
  params: Params
  request: Request
  url: URL
  cookies: Cookies
  session?: Session
}

/**
 * Load/guard event. Pass a path pattern to type `params`, e.g. `LoadEvent<'/posts/:id'>`.
 * With no type arg, `params` is `Record<string, string>` (backward compatible).
 */
export type LoadEvent<Path extends string = string> = string extends Path
  ? LoadContext<Record<string, string>>
  : LoadContext<ExtractParams<Path>>

export type LoadResult = Record<string, unknown> | void | Response

export type ActionContext<Params extends object = Record<string, string>> = LoadContext<Params> & {
  formData: FormData
}

export type ActionHandler<Params extends object = Record<string, string>> = (
  event: ActionContext<Params>,
) => Promise<unknown> | unknown

export type ApiHandler<Params extends object = Record<string, string>> = (
  event: LoadContext<Params>,
) => Promise<Response> | Response

export type GuardResult = boolean | Response | Promise<boolean | Response>

export type GuardFn<Params extends object = Record<string, string>> = (
  event: LoadContext<Params>,
) => GuardResult

export interface AdapterInterface {
  name: string
  adapt(builder: AdapterBuilder): Promise<void>
}

export interface AdapterBuilder {
  getClientDirectory(): string
  getServerEntry(): string
  getSsgPages(): Array<{ path: string; html: string }>
  getManifest(): Record<string, unknown>
  writeClient(dest: string): void
  writeFile(file: string, contents: string): void
  mkdirp(dir: string): void
}

export interface ParsedVexBlocks {
  clientScript: string
  serverScript: string
  style: string
  markup: string
  scoped: boolean
}
