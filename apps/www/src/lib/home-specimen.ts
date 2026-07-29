import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const generated = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../.generated/home-specimen.json',
)

export function loadHomeSpecimenHtml(): string {
  if (!fs.existsSync(generated)) {
    throw new Error('Missing .generated/home-specimen.json — run pnpm -F www generate')
  }
  const data = JSON.parse(fs.readFileSync(generated, 'utf8')) as { html?: string }
  if (typeof data.html !== 'string' || !data.html) {
    throw new Error('home-specimen.json missing html')
  }
  return data.html
}
