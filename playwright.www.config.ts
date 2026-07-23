import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const clientDir = path.join(root, 'apps/www/build/client')
const port = 8791
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/www.spec.ts',
  timeout: 60_000,
  fullyParallel: true,
  workers: 2,
  webServer: {
    command: `pnpm -F www build && python3 -m http.server ${port} --directory "${clientDir}"`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
  },
})
