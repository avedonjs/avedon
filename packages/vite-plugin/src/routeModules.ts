import path from 'node:path'

/** Collect absolute paths of `.ave` modules statically imported by `routes.ts`. */
export function collectRouteAvePaths(routesSource: string, routesFileDir: string): Set<string> {
  const out = new Set<string>()
  const re = /from\s+['"]([^'"]+\.ave)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(routesSource))) {
    out.add(path.resolve(routesFileDir, m[1]))
  }
  return out
}

/**
 * Route pages/layouts/error boundaries may keep `<script server>`.
 * Everything else is treated as a UI component (`asUiComponent: true`).
 */
export function isRouteAveModule(
  absAvePath: string,
  routeAvePaths: Set<string>,
  appRoot: string,
): boolean {
  const resolved = path.resolve(absAvePath)
  if (routeAvePaths.has(resolved)) return true
  const rel = path.relative(appRoot, resolved).replace(/\\/g, '/')
  return rel === 'src/error.ave' || rel === 'src/not-found.ave'
}
