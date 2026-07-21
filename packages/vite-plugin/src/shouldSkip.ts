/** Paths that must reach Vite (modules/assets), not the page middleware. */
export function shouldSkip(pathname: string): boolean {
  if (pathname.startsWith('/@') || pathname.startsWith('/node_modules')) return true
  // Source modules under /src/ (including .avedon) — Vite must transform these
  if (pathname.startsWith('/src/') && /\.\w+$/.test(pathname)) return true
  if (/\.(js|ts|tsx|css|map|svg|png|jpg|jpeg|gif|webp|ico|woff2?|avedon)(\?|$)/.test(pathname)) {
    return true
  }
  return false
}
