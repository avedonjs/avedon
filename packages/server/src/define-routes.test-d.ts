import type { ExtractParams, LoadEvent, MergeParams } from '@avedon/shared'
import { defineRoutes, route } from './types.js'

type Expect<T extends true> = T
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

const stub = { render: () => '' }

// route() — path literal → params.id: string
route('/posts/:id', {
  component: stub,
  guard: (event) => {
    type P = typeof event.params
    type _ok = Expect<Equal<P, { id: string }>>
    const id: string = event.params.id
    return id.length > 0
  },
})

// Nested: parent :userId + child :postId
route('/users/:userId', {
  component: stub,
  children: (r) => [
    r('posts/:postId', {
      component: stub,
      guard: (event) => {
        type P = typeof event.params
        type _ok = Expect<Equal<P, { userId: string; postId: string }>>
        return Boolean(event.params.userId && event.params.postId)
      },
    }),
  ],
})

// Nested static /admin + dashboard → empty params
route('/admin', {
  component: stub,
  children: (r) => [
    r('dashboard', {
      component: stub,
      guard: (event) => {
        type P = typeof event.params
        type _ok = Expect<Equal<P, {}>>
        return Object.keys(event.params).length === 0
      },
    }),
  ],
})

const routes = defineRoutes([
  route('/posts/:id', {
    component: stub,
    guard: (event) => Boolean(event.params.id),
  }),
])
type _path = Expect<Equal<(typeof routes)[0]['path'], '/posts/:id'>>

// LoadEvent helper
type _load = Expect<Equal<LoadEvent<'/posts/:id'>['params'], { id: string }>>
type _merge = Expect<
  Equal<
    MergeParams<ExtractParams<'/users/:userId'>, ExtractParams<'posts/:postId'>>,
    { userId: string; postId: string }
  >
>

void routes
void stub
