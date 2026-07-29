import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isRouteAveModule } from './routeModules.js'

describe('isRouteAveModule', () => {
  it('is true for route imports and global error boundaries', () => {
    const routePaths = new Set([
      path.resolve('/app/src/pages/Home.ave'),
      path.resolve('/app/src/pages/Layout.ave'),
    ])
    expect(
      isRouteAveModule(path.resolve('/app/src/pages/Home.ave'), routePaths, '/app'),
    ).toBe(true)
    expect(
      isRouteAveModule(path.resolve('/app/src/error.ave'), routePaths, '/app'),
    ).toBe(true)
    expect(
      isRouteAveModule(path.resolve('/app/src/not-found.ave'), routePaths, '/app'),
    ).toBe(true)
  })

  it('is false for sibling UI components not listed in routes', () => {
    const routePaths = new Set([path.resolve('/app/src/pages/Home.ave')])
    expect(
      isRouteAveModule(path.resolve('/app/src/pages/Counter.ave'), routePaths, '/app'),
    ).toBe(false)
    expect(
      isRouteAveModule(path.resolve('/app/src/components/Toc.ave'), routePaths, '/app'),
    ).toBe(false)
  })
})
