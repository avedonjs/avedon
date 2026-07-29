import fs from 'node:fs'
import path from 'node:path'

/** Clear previous build artifacts so Vite does not dep-scan stale HTML under `build/`. */
export function prepareBuildDirs(root: string): void {
  for (const dir of ['.avedon', 'build']) {
    fs.rmSync(path.join(root, dir), { recursive: true, force: true })
  }
}
