import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { collectRouteAvePaths, isRouteAveModule } from './routeModules.js'

describe('collectRouteAvePaths', () => {
  const dir = '/app/src'

  it('resolves static .ave imports from routes.ts', () => {
    const src = `
import Layout from './pages/Layout.ave'
import Home from "./pages/Home.ave"
import { defineRoutes } from '@avedon/server'
`
    const paths = collectRouteAvePaths(src, dir)
    expect(paths.has(path.resolve(dir, 'pages/Layout.ave'))).toBe(true)
    expect(paths.has(path.resolve(dir, 'pages/Home.ave'))).toBe(true)
  })

  it('ignores non-.ave imports', () => {
    const src = `import { docStaticPaths } from './lib/doc-paths.js'\nimport Home from './pages/Home.ave'\n`
    const paths = collectRouteAvePaths(src, dir)
    expect([...paths]).toEqual([path.resolve(dir, 'pages/Home.ave')])
  })

  it('does not mark sibling UI components that are not imported by routes', () => {
    const src = `import Home from './pages/Home.ave'\n`
    const paths = collectRouteAvePaths(src, dir)
    expect(paths.has(path.resolve(dir, 'pages/Counter.ave'))).toBe(false)
  })

  it('classifies basic-app Counter.ave as a UI component (not a route entry)', () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
    const appRoot = path.join(repoRoot, 'examples/basic-app')
    const routesFile = path.join(appRoot, 'src/routes.ts')
    const src = fs.readFileSync(routesFile, 'utf8')
    const routePaths = collectRouteAvePaths(src, path.dirname(routesFile))
    const counter = path.join(appRoot, 'src/pages/Counter.ave')
    const home = path.join(appRoot, 'src/pages/Home.ave')
    expect(isRouteAveModule(home, routePaths, appRoot)).toBe(true)
    expect(isRouteAveModule(counter, routePaths, appRoot)).toBe(false)
  })
})
