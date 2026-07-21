import path from 'node:path'
import { formatNextSteps, scaffoldApp } from './index.js'

function main() {
  const name = process.argv[2] ?? 'my-vex-app'
  const dest = path.resolve(name)
  try {
    const result = scaffoldApp(dest, path.basename(dest))
    console.log(formatNextSteps(result))
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

main()
