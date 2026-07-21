import type { RouteConfig, Routes } from './types.js'

export interface MatchResult {
  route: RouteConfig
  params: Record<string, string>
  chain: RouteConfig[]
}

export function matchRoute(routes: Routes, pathname: string): MatchResult | null {
  const normalized = stripTrailingSlashes(pathname) || '/'
  return matchList(routes, normalized, [], {})
}

function matchList(
  routes: Routes,
  pathname: string,
  chain: RouteConfig[],
  parentParams: Record<string, string>,
): MatchResult | null {
  for (const route of routes) {
    const m = matchPath(route.path, pathname)
    if (!m) continue
    const params = { ...parentParams, ...m.params }
    const nextChain = [...chain, route]
    if (route.children?.length) {
      const rest = m.rest || '/'
      const child = matchList(route.children, rest, nextChain, params)
      if (child) return child
      // if path fully consumed and no child matched, still ok if no remaining
      if (!m.rest || m.rest === '/') {
        return { route, params, chain: nextChain }
      }
      continue
    }
    if (m.rest && m.rest !== '/') continue
    return { route, params, chain: nextChain }
  }
  return null
}

function matchPath(
  pattern: string,
  pathname: string,
): { params: Record<string, string>; rest: string } | null {
  const patternParts = split(pattern)
  const pathParts = split(pathname)
  const params: Record<string, string> = {}
  let i = 0
  for (; i < patternParts.length; i++) {
    const pp = patternParts[i]
    const vp = pathParts[i]
    if (pp === '*') {
      params['*'] = pathParts.slice(i).join('/')
      return { params, rest: '/' }
    }
    if (pp.startsWith(':')) {
      if (vp == null) return null
      params[pp.slice(1)] = decodeURIComponent(vp)
      continue
    }
    if (pp !== vp) return null
  }
  const restParts = pathParts.slice(i)
  const rest = restParts.length ? '/' + restParts.join('/') : '/'
  return { params, rest }
}

function split(path: string): string[] {
  const trimmed = stripTrailingSlashes(stripLeadingSlashes(path))
  if (!trimmed) return []
  return trimmed.split('/').filter(Boolean)
}

function stripTrailingSlashes(path: string): string {
  let end = path.length
  while (end > 0 && path.charCodeAt(end - 1) === 47 /* / */) end--
  return end === path.length ? path : path.slice(0, end)
}

function stripLeadingSlashes(path: string): string {
  let start = 0
  while (start < path.length && path.charCodeAt(start) === 47 /* / */) start++
  return start === 0 ? path : path.slice(start)
}

/** Extract params by matching a concrete pathname against a route pattern. */
export function paramsFromPath(pattern: string, pathname: string): Record<string, string> | null {
  const m = matchPath(pattern, stripTrailingSlashes(pathname) || '/')
  if (!m) return null
  if (m.rest && m.rest !== '/') return null
  return m.params
}
