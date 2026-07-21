/** Shared types for vexjs packages. */

export type RenderMode = 'ssr' | 'ssg' | 'csr'

export interface LoadContext {
  params: Record<string, string>
  request: Request
  url: URL
}

export type LoadResult = Record<string, unknown> | void | Response

export type ActionContext = LoadContext & { formData: FormData }

export type ActionHandler = (event: ActionContext) => Promise<unknown> | unknown

export type ApiHandler = (event: LoadContext) => Promise<Response> | Response

export type GuardResult = boolean | Response | Promise<boolean | Response>

export type GuardFn = (event: LoadContext) => GuardResult

/** Extract param names from a path pattern like `/posts/:id` / `/x/:id?` / `*wildcard`. */
export type ExtractParams<Path extends string> =
  Path extends `${infer _Start}:${infer Rest}`
    ? Rest extends `${infer Param}/${infer Tail}`
      ? (Param extends `${infer Name}?` ? { [K in Name]?: string } : { [K in Param]: string }) &
          ExtractParams<`/${Tail}`>
      : Rest extends `${infer Param}?`
        ? { [K in Param]?: string }
        : Rest extends `*${infer Wild}`
          ? { [K in Wild]: string }
          : { [K in Rest]: string }
    : Path extends `${infer _Start}*${infer Wild}`
      ? { [K in Wild]: string }
      : {}

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
