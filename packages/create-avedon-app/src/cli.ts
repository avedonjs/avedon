import path from 'node:path'
import { formatNextSteps, resolveCreateOptions, scaffoldApp } from './index.js'

async function main() {
  try {
    const options = await resolveCreateOptions(process.argv.slice(2))
    const dest = path.resolve(options.name)
    const result = scaffoldApp(dest, options)
    console.log(formatNextSteps(result))
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

main()
