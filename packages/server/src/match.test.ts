import { describe, expect, it } from 'vitest'
import { matchRoute, paramsFromPath } from './match.js'

describe('matchRoute', () => {
  const Home = { render: () => 'home' }
  const Item = { render: () => 'item' }

  it('matches static and params', () => {
    const routes = [
      { path: '/', component: Home },
      { path: '/items/:id', component: Item },
    ]
    expect(matchRoute(routes, '/')?.route.component).toBe(Home)
    const m = matchRoute(routes, '/items/42')
    expect(m?.params.id).toBe('42')
    expect(m?.route.component).toBe(Item)
  })

  it('returns null for unknown', () => {
    expect(matchRoute([{ path: '/', component: Home }], '/nope')).toBeNull()
  })

  it('matches nested children', () => {
    const Child = { render: () => 'child' }
    const routes = [
      {
        path: '/app',
        component: Home,
        children: [{ path: 'dash', component: Child }],
      },
    ]
    const m = matchRoute(routes, '/app/dash')
    expect(m?.route.component).toBe(Child)
    expect(m?.chain).toHaveLength(2)
  })
})

describe('paramsFromPath', () => {
  it('extracts params from pattern', () => {
    expect(paramsFromPath('/posts/:slug', '/posts/hello')).toEqual({ slug: 'hello' })
    expect(paramsFromPath('/posts/:slug', '/other')).toBeNull()
  })
})
