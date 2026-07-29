import { test, expect } from '@playwright/test'

test('landing shows brand and docs CTA', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.brand')).toHaveText('avedon')
  await expect(page.getByRole('link', { name: 'Get started' })).toHaveAttribute(
    'href',
    '/docs/quick-start/',
  )
})

test('docs hub loads', async ({ page }) => {
  await page.goto('/docs/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
})

test('quick start doc renders', async ({ page }) => {
  await page.goto('/docs/quick-start/')
  await expect(page.getByRole('heading', { name: 'Quick start' })).toBeVisible()
})

test('robots.txt is plain text with sitemap', async ({ request }) => {
  const res = await request.get('/robots.txt')
  expect(res.ok()).toBeTruthy()
  expect(res.headers()['content-type'] || '').toMatch(/text\/plain/)
  const body = await res.text()
  expect(body).toContain('User-agent:')
  expect(body).toContain('Sitemap:')
  expect(body).not.toMatch(/<!doctype html>/i)
})

test('playground runs counter preset', async ({ page }) => {
  await page.goto('/playground?e=counter')
  await expect(page.locator('[data-playground]')).toBeVisible()
  const frame = page.frameLocator('iframe[title="Playground preview"]')
  await expect(frame.locator('button', { hasText: 'Increment' })).toBeVisible({ timeout: 15_000 })
  await expect(frame.locator('text=Count: 0')).toBeVisible()
  await frame.locator('button', { hasText: 'Increment' }).click()
  await expect(frame.locator('text=Count: 1')).toBeVisible()
})

test('playground loads mock load() data', async ({ page }) => {
  await page.goto('/playground?e=load-data')
  await expect(page.locator('[data-playground]')).toBeVisible()
  const frame = page.frameLocator('iframe[title="Playground preview"]')
  await expect(frame.locator('text=Hello from mock load()')).toBeVisible({ timeout: 15_000 })
  await expect(frame.locator('text=Signals')).toBeVisible({ timeout: 15_000 })
})

test('playground form action mock increments count', async ({ page }) => {
  await page.goto('/playground?e=form-action')
  await expect(page.locator('[data-playground]')).toBeVisible()
  const frame = page.frameLocator('iframe[title="Playground preview"]')
  const button = frame.locator('button', { hasText: 'Increment (action)' })

  await expect(frame.locator('text=Count: 0')).toBeVisible({ timeout: 15_000 })
  await button.click()
  await expect(frame.locator('text=Count: 1')).toBeVisible({ timeout: 15_000 })
  await button.click()
  await expect(frame.locator('text=Count: 2')).toBeVisible({ timeout: 15_000 })
})

test('playground two-way bind updates input', async ({ page }) => {
  await page.goto('/playground?e=bind-value')
  const frame = page.frameLocator('iframe[title="Playground preview"]')
  const input = frame.locator('input')

  await expect(input).toHaveValue('avedon', { timeout: 15_000 })
  await input.fill('anilo')
  await expect(frame.locator('text=Hello, anilo!')).toBeVisible({ timeout: 15_000 })
})

test('playground checkbox group updates selected', async ({ page }) => {
  await page.goto('/playground?e=checkbox-group')
  const frame = page.frameLocator('iframe[title="Playground preview"]')

  const checkboxes = frame.locator('input[type="checkbox"]')
  const docs = checkboxes.nth(0)
  const playground = checkboxes.nth(1)

  await expect(checkboxes).toHaveCount(3, { timeout: 15_000 })

  await playground.click()

  const selected = frame.locator('p').filter({ hasText: 'Selected:' })
  await expect(selected).toContainText('playground', { timeout: 15_000 })
  await expect(playground).toBeChecked({ timeout: 15_000 })
})

test('playground todo preset adds items', async ({ page }) => {
  await page.goto('/playground?e=todo')
  const frame = page.frameLocator('iframe[title="Playground preview"]')

  await expect(frame.locator('li')).toHaveCount(2, { timeout: 15_000 })

  const input = frame.locator('input[placeholder="New todo"]')
  await input.fill('Ship it')
  await frame.locator('button', { hasText: 'Add' }).click()

  await expect(frame.locator('li')).toHaveCount(3, { timeout: 15_000 })
  await expect(frame.locator('li', { hasText: 'Ship it' })).toBeVisible({ timeout: 15_000 })
})

test('playground class: directive toggles classes', async ({ page }) => {
  await page.goto('/playground?e=class-directive')
  const frame = page.frameLocator('iframe[title="Playground preview"]')

  const btn = frame.locator('button').first()
  await expect(btn).toHaveText(/Inactive/, { timeout: 15_000 })
  await expect(btn).not.toHaveClass(/primary/, { timeout: 15_000 })

  await btn.click()
  await expect(btn).toHaveText(/Active/, { timeout: 15_000 })
  await expect(btn).toHaveClass(/primary/, { timeout: 15_000 })

  await btn.click()
  await expect(btn).toHaveText(/Inactive/, { timeout: 15_000 })
  await expect(btn).not.toHaveClass(/primary/, { timeout: 15_000 })
})
