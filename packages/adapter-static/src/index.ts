import type { AdapterBuilder, AdapterInterface } from '@avedon/shared'
import path from 'node:path'

export type { AdapterBuilder, AdapterInterface }
export type Builder = AdapterBuilder
export type Adapter = AdapterInterface

export type StaticAdapterOptions = {
  out?: string
}

type ManifestRoute = {
  path?: string
  render?: string
  revalidate?: number
  hasActions?: boolean
  hasApi?: boolean
}

export function ssgHtmlPath(clientDir: string, routePath: string): string {
  const normalized = routePath.split('?')[0] || '/'
  if (normalized.includes('\0')) throw new Error('Invalid SSG path')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.some((p) => p === '..' || p === '.')) {
    throw new Error(`Unsafe SSG path: ${routePath}`)
  }
  if (parts.length === 0) return path.join(clientDir, 'index.html')
  return path.join(clientDir, ...parts, 'index.html')
}

export function assertStaticCompatible(manifest: Record<string, unknown>): void {
  const routes = (manifest.routes ?? []) as ManifestRoute[]
  for (const route of routes) {
    const p = route.path ?? '(unknown)'
    const render = route.render ?? 'ssr'
    if (render !== 'ssg') {
      throw new Error(
        `[@avedon/adapter-static] Route ${p} has render: '${render}' — only render: 'ssg' is allowed.`,
      )
    }
    if (route.hasActions) {
      throw new Error(
        `[@avedon/adapter-static] Route ${p} defines actions — not supported for static export.`,
      )
    }
    if (route.hasApi) {
      throw new Error(
        `[@avedon/adapter-static] Route ${p} defines api handlers — not supported for static export.`,
      )
    }
    if (route.revalidate != null) {
      throw new Error(
        `[@avedon/adapter-static] Route ${p} sets revalidate — ISR requires a server adapter.`,
      )
    }
  }
}

export function staticAdapter(options: StaticAdapterOptions = {}): AdapterInterface {
  const out = options.out ?? 'build'
  return {
    name: '@avedon/adapter-static',
    async adapt(builder) {
      assertStaticCompatible(builder.getManifest())

      const pages = builder.getSsgPages()
      if (pages.length === 0) {
        throw new Error(
          '[@avedon/adapter-static] No SSG pages emitted — ensure every route uses render: \'ssg\' and getStaticPaths where needed.',
        )
      }

      const outDir = path.resolve(out)
      const clientDir = path.join(outDir, 'client')
      builder.mkdirp(outDir)
      builder.mkdirp(clientDir)
      builder.writeClient(clientDir)

      for (const page of pages) {
        const file = ssgHtmlPath(clientDir, page.path)
        builder.mkdirp(path.dirname(file))
        builder.writeFile(file, page.html)
      }
    },
  }
}

export default staticAdapter
