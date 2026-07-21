import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  webServer: {
    command: 'node ../../packages/cli/dist/cli.js dev',
    cwd: 'examples/basic-app',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Desktop Chrome'],
  },
})
