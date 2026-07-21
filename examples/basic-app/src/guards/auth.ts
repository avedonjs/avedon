import type { GuardFn } from '@avedon/server'

/** Demo guard for `/admin`: session or `?auth=1` (see AdminError.avedon). */
export const requireAuth: GuardFn = (event) => {
  if (event.url.searchParams.get('auth') === '1') return true
  if (event.session?.data != null) return true
  return false
}
