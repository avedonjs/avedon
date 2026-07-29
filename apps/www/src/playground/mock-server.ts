export type MockActionCtx = {
  params: Record<string, string>
  request: { formData: () => Promise<FormData> }
}

export type MockServer = {
  props: Record<string, unknown>
  actions: Record<string, (ctx: MockActionCtx) => Promise<unknown> | unknown> | null
}

function stripServerImports(source: string): string {
  return source
    .replace(/^import\s+.+from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^import\s+type\s+.+;?\s*$/gm, '')
    // In our mock eval we expect plain `function load()` / `actions` bindings.
    // Strip `export` keywords so `new AsyncFunction(...)` doesn't choke on them.
    .replace(/^\s*export\s+/gm, '')
    .trim()
}

// `AsyncFunction` global is not typed in our TS lib setup.
// Build the constructor from a known async function to keep runtime behavior.
type AsyncFunctionConstructor = new (...args: string[]) => (...args: any[]) => Promise<any>
const AsyncFunctionCtor: AsyncFunctionConstructor = Object.getPrototypeOf(
  async function () {},
).constructor as unknown as AsyncFunctionConstructor

export async function evalMockServer(serverScript: string): Promise<MockServer> {
  if (!serverScript.trim()) {
    return { props: {}, actions: null }
  }
  const stripped = stripServerImports(serverScript)
  const fn = new AsyncFunctionCtor(`
    ${stripped}
    let pgData = undefined
    if (typeof load === 'function') {
      const res = await load({ params: {}, url: new URL('http://playground.local/') })
      if (res && typeof res === 'object' && 'data' in res) pgData = res.data
      else pgData = res
    }
    return {
      props: pgData !== undefined ? { data: pgData } : {},
      actions: typeof actions === 'object' && actions ? actions : null,
    }
  `)
  return (await fn()) as MockServer
}

