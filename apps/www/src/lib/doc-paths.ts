/** Keep in sync with `scripts/generate-docs.mjs` SLUGS. */
export const DOC_SLUGS = [
  'guide',
  'avedon-components',
  'routing',
  'rendering',
  'middleware',
  'session',
  'security',
  'packages',
] as const

export function docStaticPaths(): string[] {
  return DOC_SLUGS.map((slug) => `/docs/${slug}`)
}
