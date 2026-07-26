/** Canonical public origin for the docs site (sitemap, robots, OG). */
export const DEFAULT_DOCS_ORIGIN = 'https://avedon.pages.dev'

export function getDocsOrigin(env = process.env) {
  const raw = env.AVEDON_DOCS_ORIGIN?.trim()
  if (!raw) return DEFAULT_DOCS_ORIGIN
  return raw.replace(/\/$/, '')
}
