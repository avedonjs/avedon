import { test, expect } from '@playwright/test'

test('home ssg/ssr renders brand', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('avedon')
})

test('post ssr + client like button', async ({ page }) => {
  await page.goto('/posts/1')
  await expect(page.locator('h1')).toHaveText('Hello avedon')
  const likes = page.locator('text=Likes:')
  const before = await likes.textContent()
  await page.getByRole('button', { name: /Optimistic/ }).click()
  await expect(likes).not.toHaveText(before || '')
})

test('client nav does not full-reload', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    ;(window as unknown as { __navMarker: number }).__navMarker = 1
  })
  await page.click('a[href="/posts/1"]')
  await expect(page.locator('h1')).toHaveText('Hello avedon')
  const marker = await page.evaluate(
    () => (window as unknown as { __navMarker?: number }).__navMarker,
  )
  expect(marker).toBe(1)
})

test('form action like updates page', async ({ page }) => {
  await page.goto('/posts/1')
  await page.getByRole('button', { name: 'Like (server action)' }).click()
  await expect(page.locator('h1')).toHaveText('Hello avedon')
})

test('admin guard blocks unauthorized', async ({ request }) => {
  const res = await request.get('/admin')
  expect(res.status()).toBe(403)
})

test('admin guard allows session after login', async ({ request }) => {
  const login = await request.post('/login?_action=login', {
    headers: { origin: 'http://localhost:5173' },
    form: { user: 'admin' },
  })
  expect(login.status()).toBeLessThan(400)
  const admin = await request.get('/admin')
  expect(admin.status()).toBe(200)
  const html = await admin.text()
  expect(html).toContain('data-avedon-csr')
})

test('api_GET via .json', async ({ request }) => {
  const res = await request.get('/posts/1.json')
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.post.id).toBe('1')
})

test('route notFound overrides global when load throws notFound()', async ({ page }) => {
  const res = await page.goto('/error-lab/nf')
  expect(res?.status()).toBe(404)
  await expect(page.locator('[data-error-lab="route-not-found"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Route-specific 404' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Not found' })).toHaveCount(0)
})

test('global notFound when route has no notFound override', async ({ page }) => {
  const res = await page.goto('/error-lab/global-nf')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible()
  await expect(page.locator('[data-error-lab="route-not-found"]')).toHaveCount(0)
})

test('route error overrides global when load throws error()', async ({ page }) => {
  const res = await page.goto('/error-lab/boom')
  expect(res?.status()).toBe(500)
  await expect(page.locator('[data-error-lab="route-error"]')).toHaveText('500: lab-boom')
  await expect(page.getByRole('heading', { name: 'Error 500' })).toHaveCount(0)
})

test('nested route load error uses parent route error boundary', async ({ page }) => {
  const res = await page.goto('/error-lab/nested-boom')
  expect(res?.status()).toBe(500)
  await expect(page.locator('[data-error-lab="route-error"]')).toHaveText('500: nested-lab-boom')
})
