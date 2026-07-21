import type { ExtractParams, JoinPaths, MergeParams } from './index.js'
import type { Equal, Expect } from './type-equal.js'

// ExtractParams
type _id = Expect<Equal<ExtractParams<'/posts/:id'>, { id: string }>>
type _opt = Expect<Equal<ExtractParams<'/posts/:id?'>, { id?: string }>>
type _wildNamed = Expect<Equal<ExtractParams<'/files/*rest'>, { rest: string }>>
type _wildBare = Expect<Equal<ExtractParams<'/files/*'>, { '*': string }>>
type _multi = Expect<
  Equal<ExtractParams<'/users/:userId/posts/:postId'>, { userId: string; postId: string }>
>

// JoinPaths
type _joinRel = Expect<Equal<JoinPaths<'/admin', 'dashboard'>, '/admin/dashboard'>>
type _joinAbs = Expect<Equal<JoinPaths<'/admin', '/dashboard'>, '/admin/dashboard'>>
type _joinRoot = Expect<Equal<JoinPaths<'/', 'about'>, '/about'>>

// MergeParams
type _merge = Expect<
  Equal<
    MergeParams<ExtractParams<'/users/:userId'>, ExtractParams<'posts/:postId'>>,
    { userId: string; postId: string }
  >
>
