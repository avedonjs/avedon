import { test, expect } from '@playwright/test'

test('login form establishes session and opens admin CSR', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin\/?$/)
  await expect(page.getByRole('heading', { name: 'Admin (CSR)' })).toBeVisible()
  await expect(page.locator('[data-avedon-csr]')).toBeVisible()
})

test('form action without Origin/Referer is rejected (CSRF)', async ({ request }) => {
  const res = await request.post('/posts/1?_action=like', {
    // Intentionally omit origin / referer
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    form: {},
  })
  expect(res.status()).toBe(403)
})

test('form action with matching Origin succeeds', async ({ request }) => {
  const res = await request.post('/posts/1?_action=like', {
    headers: { origin: 'http://localhost:5173' },
    form: {},
  })
  expect(res.status()).toBeLessThan(400)
  const html = await res.text()
  expect(html).toContain('Hello avedon')
})

test('slow stream redirect completes via client navigation', async ({ page }) => {
  test.setTimeout(30_000)
  await page.goto('/stream-redirect/slow', { waitUntil: 'commit' })
  await page.waitForURL(/stream-redirect=ok/, { timeout: 20_000 })
  await expect(page.locator('.brand, [data-starter-stage] .brand')).toContainText('avedon')
})

test('home signal increment updates without full reload', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    ;(window as unknown as { __sigMarker: number }).__sigMarker = 1
  })
  const count = page.locator('.demo-count')
  await expect(count).toHaveText('0')
  await page.getByRole('button', { name: 'Increment' }).click()
  await expect(count).toHaveText('1')
  const marker = await page.evaluate(
    () => (window as unknown as { __sigMarker?: number }).__sigMarker,
  )
  expect(marker).toBe(1)
})

test('keyed each reorders existing DOM nodes', async ({ page }) => {
  await page.goto('/keyed-each-lab')
  const first = page.locator('[data-item-id="1"]')
  await first.evaluate((node) => {
    ;(node as HTMLElement & { __avedonIdentity?: string }).__avedonIdentity = 'kept'
  })

  await page.getByRole('button', { name: 'Reverse' }).click()

  await expect(page.locator('[data-keyed-list] li')).toHaveText(['three', 'two', 'one'])
  expect(
    await page.locator('[data-item-id="1"]').evaluate(
      (node) => (node as HTMLElement & { __avedonIdentity?: string }).__avedonIdentity,
    ),
  ).toBe('kept')
})

test('named slots project header and default content', async ({ page }) => {
  await page.goto('/named-slots-lab')
  await expect(page.locator('[data-card-header]')).toContainText('Header slot')
  await expect(page.locator('[data-card-default]')).toContainText('Default body')
})

test('class: toggles class names on the client', async ({ page }) => {
  await page.goto('/class-directive-lab')
  const target = page.locator('[data-class-target]')
  await expect(target).toHaveClass(/card/)
  await expect(target).toHaveClass(/active/)
  await expect(target).not.toHaveClass(/idle/)

  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveClass(/card/)
  await expect(target).toHaveClass(/idle/)
  await expect(target).not.toHaveClass(/active/)
})

test('style: updates inline styles on the client', async ({ page }) => {
  await page.goto('/style-directive-lab')
  const target = page.locator('[data-style-target]')
  await expect(target).toHaveCSS('font-size', '14px')
  await expect(target).toHaveCSS('opacity', '0.4')

  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveCSS('font-size', '24px')
  await expect(target).toHaveCSS('opacity', '1')
})

test('style:--custom-property updates CSS variables', async ({ page }) => {
  await page.goto('/style-css-var-lab')
  const target = page.locator('[data-css-var-target]')
  await expect(target).toHaveCSS('color', 'rgb(0, 128, 0)')
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveCSS('color', 'rgb(0, 0, 255)')
})

test('bind:checked syncs checkbox state both ways', async ({ page }) => {
  await page.goto('/bind-checked-lab')
  const box = page.locator('[data-bind-checked]')
  await expect(box).toBeChecked()
  await expect(page.locator('[data-bind-state]')).toHaveText('on')

  await box.uncheck()
  await expect(page.locator('[data-bind-state]')).toHaveText('off')

  await box.check()
  await expect(page.locator('[data-bind-state]')).toHaveText('on')
})

test('createEventDispatcher notifies parent on: handlers', async ({ page }) => {
  await page.goto('/event-dispatcher-lab')
  await expect(page.locator('[data-dispatch-result]')).toHaveText('none')
  await page.locator('[data-dispatch-btn]').click()
  await expect(page.locator('[data-dispatch-result]')).toHaveText('pong')
})

test('use: runs element actions and updates params', async ({ page }) => {
  await page.goto('/use-action-lab')
  const target = page.locator('[data-use-target]')
  await expect(target).toHaveAttribute('data-use-applied', '1')
  await expect(target).toHaveAttribute('data-use-label', 'alpha')

  await page.getByRole('button', { name: 'Flip' }).click()
  await expect(target).toHaveAttribute('data-use-label', 'beta')
})

test('portal action moves a node into a host', async ({ page }) => {
  await page.goto('/portal-lab')
  const host = page.locator('[data-portal-host]')
  await expect(host.locator('[data-portaled]')).toHaveText('ported')
  await expect(page.locator('main > [data-portaled]')).toHaveCount(0)
})

test('clickOutside closes when pressing outside the panel', async ({ page }) => {
  await page.goto('/click-outside-lab')
  await expect(page.locator('[data-co-status]')).toHaveText('open')
  await page.locator('[data-inside]').click()
  await expect(page.locator('[data-co-status]')).toHaveText('open')
  await page.locator('[data-outside]').click()
  await expect(page.locator('[data-co-status]')).toHaveText('closed')
})

test('longPress fires after holding the pointer', async ({ page }) => {
  await page.goto('/long-press-lab')
  await expect(page.locator('[data-lp-count]')).toHaveText('0')
  const btn = page.locator('[data-lp]')
  const box = await btn.boundingBox()
  expect(box).toBeTruthy()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(120)
  await page.mouse.up()
  await expect(page.locator('[data-lp-count]')).toHaveText('1')
})

test('holdRepeat increments while the pointer is held', async ({ page }) => {
  await page.goto('/hold-repeat-lab')
  await expect(page.locator('[data-hold-count]')).toHaveText('0')
  const btn = page.locator('[data-hold-repeat]')
  const box = await btn.boundingBox()
  expect(box).toBeTruthy()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await expect
    .poll(async () => page.locator('[data-hold-count]').textContent())
    .toMatch(/^[2-9]$|^[1-9][0-9]+$/)
  await page.mouse.up()
  const after = await page.locator('[data-hold-count]').textContent()
  await page.waitForTimeout(120)
  await expect(page.locator('[data-hold-count]')).toHaveText(after!)
})

test('autofocus focuses the input when it mounts', async ({ page }) => {
  await page.goto('/autofocus-lab')
  await page.locator('[data-open]').click()
  await expect(page.locator('[data-af]')).toBeFocused()
})

test('selectOnFocus selects the input value on focus', async ({ page }) => {
  await page.goto('/select-on-focus-lab')
  await expect(page.locator('[data-sof-state]')).toHaveText('no')
  await page.locator('[data-sof]').focus()
  await expect(page.locator('[data-sof-state]')).toHaveText('yes')
  const range = await page.locator('[data-sof]').evaluate((el: HTMLInputElement) => ({
    start: el.selectionStart,
    end: el.selectionEnd,
    len: el.value.length,
  }))
  expect(range.start).toBe(0)
  expect(range.end).toBe(range.len)
})

test('trim strips whitespace on blur', async ({ page }) => {
  await page.goto('/trim-lab')
  const input = page.locator('[data-trim]')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await input.focus('  avedon  ')
  await input.blur()
  await expect(input).toHaveValue('avedon')
  await expect(page.locator('[data-out]')).toHaveText('avedon')
})

test('trimStart strips leading whitespace on blur', async ({ page }) => {
  await page.goto('/trim-start-lab')
  const input = page.locator('[data-trim-start]')
  await input.fill('  hello  ')
  await input.blur()
  await expect(input).toHaveValue('hello  ')
  await expect(page.locator('[data-out]')).toHaveText('hello  ')
})

test('trimEnd strips trailing whitespace on blur', async ({ page }) => {
  await page.goto('/trim-end-lab')
  const input = page.locator('[data-trim-end]')
  await input.fill('  hello  ')
  await input.blur()
  await expect(input).toHaveValue('  hello')
  await expect(page.locator('[data-out]')).toHaveText('  hello')
})

test('initials converts words to initials on blur', async ({ page }) => {
  await page.goto('/initials-lab')
  const input = page.locator('[data-initials]')
  await input.fill('avedon runtime lab')
  await input.blur()
  await expect(input).toHaveValue('ARL')
  await expect(page.locator('[data-out]')).toHaveText('ARL')
})

test('numeric keeps only digits while typing', async ({ page }) => {
  await page.goto('/numeric-lab')
  const input = page.locator('[data-numeric]')
  await input.fill('a1b2c3')
  await expect(input).toHaveValue('123')
  await expect(page.locator('[data-out]')).toHaveText('123')
})

test('decimal keeps digits and one dot while typing', async ({ page }) => {
  await page.goto('/decimal-lab')
  const input = page.locator('[data-decimal]')
  await input.fill('12a.3.4b')
  await expect(input).toHaveValue('12.34')
  await expect(page.locator('[data-out]')).toHaveText('12.34')
})

test('hex keeps hash and hex digits while typing', async ({ page }) => {
  await page.goto('/hex-lab')
  const input = page.locator('[data-hex]')
  await input.fill('#Ff0GxZ')
  await expect(input).toHaveValue('#ff0')
  await expect(page.locator('[data-out]')).toHaveText('#ff0')
})

test('integer keeps optional minus and digits while typing', async ({ page }) => {
  await page.goto('/integer-lab')
  const input = page.locator('[data-integer]')
  await input.fill('-12a3.x+')
  await expect(input).toHaveValue('-123')
  await expect(page.locator('[data-out]')).toHaveText('-123')
})

test('signedDecimal keeps signed decimals while typing', async ({ page }) => {
  await page.goto('/signed-decimal-lab')
  const input = page.locator('[data-signed-decimal]')
  await input.fill('-12a3.4.5+')
  await expect(input).toHaveValue('-123.45')
  await expect(page.locator('[data-out]')).toHaveText('-123.45')
})

test('phone keeps phone characters while typing', async ({ page }) => {
  await page.goto('/phone-lab')
  const input = page.locator('[data-phone]')
  await input.fill('+1 (555) 123-4567x!')
  await expect(input).toHaveValue('+1 (555) 123-4567')
  await expect(page.locator('[data-out]')).toHaveText('+1 (555) 123-4567')
})

test('email keeps email characters while typing', async ({ page }) => {
  await page.goto('/email-lab')
  const input = page.locator('[data-email]')
  await input.fill('User+Tag@Example.COM!')
  await expect(input).toHaveValue('user+tag@example.com')
  await expect(page.locator('[data-out]')).toHaveText('user+tag@example.com')
})

test('url keeps URL characters while typing', async ({ page }) => {
  await page.goto('/url-lab')
  const input = page.locator('[data-url]')
  await input.fill('HTTPS://Ex.com/a b?q=1|')
  await expect(input).toHaveValue('HTTPS://Ex.com/ab?q=1')
  await expect(page.locator('[data-out]')).toHaveText('HTTPS://Ex.com/ab?q=1')
})

test('username keeps handle characters while typing', async ({ page }) => {
  await page.goto('/username-lab')
  const input = page.locator('[data-username]')
  await input.fill('User_Name-99!')
  await expect(input).toHaveValue('user_name-99')
  await expect(page.locator('[data-out]')).toHaveText('user_name-99')
})

test('creditCard keeps card characters while typing', async ({ page }) => {
  await page.goto('/credit-card-lab')
  const input = page.locator('[data-credit-card]')
  await input.fill('4111-1111 1111-1111x!')
  await expect(input).toHaveValue('4111-1111 1111-1111')
  await expect(page.locator('[data-out]')).toHaveText('4111-1111 1111-1111')
})

test('postalCode keeps postal characters while typing', async ({ page }) => {
  await page.goto('/postal-code-lab')
  const input = page.locator('[data-postal-code]')
  await input.fill('sw1a 1aa!')
  await expect(input).toHaveValue('SW1A 1AA')
  await expect(page.locator('[data-out]')).toHaveText('SW1A 1AA')
})

test('iban keeps IBAN characters while typing', async ({ page }) => {
  await page.goto('/iban-lab')
  const input = page.locator('[data-iban]')
  await input.fill('gb82 west 1234 5698 7654 32!')
  await expect(input).toHaveValue('GB82 WEST 1234 5698 7654 32')
  await expect(page.locator('[data-out]')).toHaveText('GB82 WEST 1234 5698 7654 32')
})

test('cvv keeps up to four digits while typing', async ({ page }) => {
  await page.goto('/cvv-lab')
  const input = page.locator('[data-cvv]')
  await input.fill('12a3456!')
  await expect(input).toHaveValue('1234')
  await expect(page.locator('[data-out]')).toHaveText('1234')
})

test('otp keeps up to six digits while typing', async ({ page }) => {
  await page.goto('/otp-lab')
  const input = page.locator('[data-otp]')
  await input.fill('12a345678!')
  await expect(input).toHaveValue('123456')
  await expect(page.locator('[data-out]')).toHaveText('123456')
})

test('collapseWhitespace collapses spaces on blur', async ({ page }) => {
  await page.goto('/collapse-whitespace-lab')
  const input = page.locator('[data-collapse-whitespace]')
  await input.fill('  hello   world  ')
  await input.blur()
  await expect(input).toHaveValue('hello world')
  await expect(page.locator('[data-out]')).toHaveText('hello world')
})

test('removeWhitespace strips spaces on blur', async ({ page }) => {
  await page.goto('/remove-whitespace-lab')
  const input = page.locator('[data-remove-whitespace]')
  await input.fill(' a b c ')
  await input.blur()
  await expect(input).toHaveValue('abc')
  await expect(page.locator('[data-out]')).toHaveText('abc')
})

test('expiry formats MM/YY while typing', async ({ page }) => {
  await page.goto('/expiry-lab')
  const input = page.locator('[data-expiry]')
  await input.fill('12a3456')
  await expect(input).toHaveValue('12/34')
  await expect(page.locator('[data-out]')).toHaveText('12/34')
})

test('letters keeps only letters while typing', async ({ page }) => {
  await page.goto('/letters-lab')
  const input = page.locator('[data-letters]')
  await input.fill('a1!b2@c')
  await expect(input).toHaveValue('abc')
  await expect(page.locator('[data-out]')).toHaveText('abc')
})

test('pin keeps up to four digits while typing', async ({ page }) => {
  await page.goto('/pin-lab')
  const input = page.locator('[data-pin]')
  await input.fill('12a3456!')
  await expect(input).toHaveValue('1234')
  await expect(page.locator('[data-out]')).toHaveText('1234')
})

test('ascii keeps printable ASCII while typing', async ({ page }) => {
  await page.goto('/ascii-lab')
  const input = page.locator('[data-ascii]')
  await input.fill('a\x01bé')
  await expect(input).toHaveValue('ab')
  await expect(page.locator('[data-out]')).toHaveText('ab')
})

test('removePunct removes punctuation while typing', async ({ page }) => {
  await page.goto('/remove-punct-lab')
  const input = page.locator('[data-remove-punct]')
  await input.fill('a1! b2@ c3')
  await expect(input).toHaveValue('a1 b2 c3')
  await expect(page.locator('[data-out]')).toHaveText('a1 b2 c3')
})

test('removeDiacritics removes accents while typing', async ({ page }) => {
  await page.goto('/remove-diacritics-lab')
  const input = page.locator('[data-remove-diacritics]')
  await input.fill('Héllö Žůlu 123!')
  await expect(input).toHaveValue('Hello Zulu 123!')
  await expect(page.locator('[data-out]')).toHaveText('Hello Zulu 123!')
})

test('currency keeps dollar amounts while typing', async ({ page }) => {
  await page.goto('/currency-lab')
  const input = page.locator('[data-currency]')
  await input.fill('$12a.34x!')
  await expect(input).toHaveValue('$12.34')
  await expect(page.locator('[data-out]')).toHaveText('$12.34')
})

test('percent keeps percentage values while typing', async ({ page }) => {
  await page.goto('/percent-lab')
  const input = page.locator('[data-percent]')
  await input.fill('12a.5%x')
  await expect(input).toHaveValue('12.5%')
  await expect(page.locator('[data-out]')).toHaveText('12.5%')
})

test('alphanumeric keeps only letters and digits while typing', async ({ page }) => {
  await page.goto('/alphanumeric-lab')
  const input = page.locator('[data-alphanumeric]')
  await input.fill('a1!b2@c3')
  await expect(input).toHaveValue('a1b2c3')
  await expect(page.locator('[data-out]')).toHaveText('a1b2c3')
})

test('slugify turns text into a slug on blur', async ({ page }) => {
  await page.goto('/slugify-lab')
  const input = page.locator('[data-slugify]')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await input.fill('Hello World!!')
  await input.blur()
  await expect(input).toHaveValue('hello-world')
  await expect(page.locator('[data-out]')).toHaveText('hello-world')
})

test('capitalize title-cases words on blur', async ({ page }) => {
  await page.goto('/capitalize-lab')
  const input = page.locator('[data-capitalize]')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await input.fill('hello WORLD')
  await input.blur()
  await expect(input).toHaveValue('Hello World')
  await expect(page.locator('[data-out]')).toHaveText('Hello World')
})

test('sentenceCase normalizes sentence casing on blur', async ({ page }) => {
  await page.goto('/sentence-case-lab')
  const input = page.locator('[data-sentence-case]')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await input.fill('hELLO WORLD')
  await input.blur()
  await expect(input).toHaveValue('Hello world')
  await expect(page.locator('[data-out]')).toHaveText('Hello world')
})

test('camelCase converts words on blur', async ({ page }) => {
  await page.goto('/camel-case-lab')
  const input = page.locator('[data-camel-case]')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await input.fill('hello WORLD test')
  await input.blur()
  await expect(input).toHaveValue('helloWorldTest')
  await expect(page.locator('[data-out]')).toHaveText('helloWorldTest')
})

test('snakeCase converts words on blur', async ({ page }) => {
  await page.goto('/snake-case-lab')
  const input = page.locator('[data-snake-case]')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await input.fill('hello WORLD test')
  await input.blur()
  await expect(input).toHaveValue('hello_world_test')
  await expect(page.locator('[data-out]')).toHaveText('hello_world_test')
})

test('kebabCase converts words on blur', async ({ page }) => {
  await page.goto('/kebab-case-lab')
  const input = page.locator('[data-kebab-case]')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await input.fill('hello WORLD test')
  await input.blur()
  await expect(input).toHaveValue('hello-world-test')
  await expect(page.locator('[data-out]')).toHaveText('hello-world-test')
})

test('constantCase converts words on blur', async ({ page }) => {
  await page.goto('/constant-case-lab')
  const input = page.locator('[data-constant-case]')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await input.fill('hello WORLD test')
  await input.blur()
  await expect(input).toHaveValue('HELLO_WORLD_TEST')
  await expect(page.locator('[data-out]')).toHaveText('HELLO_WORLD_TEST')
})

test('pascalCase converts words on blur', async ({ page }) => {
  await page.goto('/pascal-case-lab')
  const input = page.locator('[data-pascal-case]')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await input.fill('hello WORLD test')
  await input.blur()
  await expect(input).toHaveValue('HelloWorldTest')
  await expect(page.locator('[data-out]')).toHaveText('HelloWorldTest')
})

test('dotCase converts words on blur', async ({ page }) => {
  await page.goto('/dot-case-lab')
  const input = page.locator('[data-dot-case]')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await input.fill('hello WORLD test')
  await input.blur()
  await expect(input).toHaveValue('hello.world.test')
  await expect(page.locator('[data-out]')).toHaveText('hello.world.test')
})

test('pathCase converts words on blur', async ({ page }) => {
  await page.goto('/path-case-lab')
  const input = page.locator('[data-path-case]')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await input.fill('hello WORLD test')
  await input.blur()
  await expect(input).toHaveValue('hello/world/test')
  await expect(page.locator('[data-out]')).toHaveText('hello/world/test')
})

test('trainCase converts words on blur', async ({ page }) => {
  await page.goto('/train-case-lab')
  const input = page.locator('[data-train-case]')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await input.fill('hello WORLD test')
  await input.blur()
  await expect(input).toHaveValue('Hello-World-Test')
  await expect(page.locator('[data-out]')).toHaveText('Hello-World-Test')
})

test('swapCase swaps letter casing on blur', async ({ page }) => {
  await page.goto('/swap-case-lab')
  const input = page.locator('[data-swap-case]')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await input.fill('Hello wORLD 123!')
  await input.blur()
  await expect(input).toHaveValue('hELLO World 123!')
  await expect(page.locator('[data-out]')).toHaveText('hELLO World 123!')
})

test('reverse reverses text on blur', async ({ page }) => {
  await page.goto('/reverse-lab')
  const input = page.locator('[data-reverse]')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await input.fill('hello WORLD 123')
  await input.blur()
  await expect(input).toHaveValue('321 DLROW olleh')
  await expect(page.locator('[data-out]')).toHaveText('321 DLROW olleh')
})

test('maxLength clamps value while typing', async ({ page }) => {
  await page.goto('/max-length-lab')
  const input = page.locator('[data-maxlength]')
  await input.fill('abcdef')
  await expect(input).toHaveValue('abcde')
  await expect(page.locator('[data-out]')).toHaveText('abcde')
})

test('lowercase lowercases on blur', async ({ page }) => {
  await page.goto('/lowercase-lab')
  const input = page.locator('[data-lowercase]')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await input.fill('AvedOn')
  await input.blur()
  await expect(input).toHaveValue('avedon')
  await expect(page.locator('[data-out]')).toHaveText('avedon')
})

test('uppercase uppercases on blur', async ({ page }) => {
  await page.goto('/uppercase-lab')
  const input = page.locator('[data-uppercase]')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await input.fill('avedOn')
  await input.blur()
  await expect(input).toHaveValue('AVEDON')
  await expect(page.locator('[data-out]')).toHaveText('AVEDON')
})

test('autoHeight grows the textarea when content wraps', async ({ page }) => {
  await page.goto('/auto-height-lab')
  const ta = page.locator('[data-auto-height]')
  const before = await ta.evaluate((el) => (el as HTMLTextAreaElement).getBoundingClientRect().height)
  await ta.fill('line1\nline2\nline3\nline4')
  await expect
    .poll(async () => ta.evaluate((el) => (el as HTMLTextAreaElement).getBoundingClientRect().height))
    .toBeGreaterThan(before)
})

test('debounce updates after input settles', async ({ page }) => {
  await page.goto('/debounce-lab')
  await expect(page.locator('[data-debounce-out]')).toHaveText('idle')
  await page.locator('[data-debounce]').fill('hello')
  await expect(page.locator('[data-debounce-out]')).toHaveText('hello')
})

test('throttle updates while typing within the wait window', async ({ page }) => {
  await page.goto('/throttle-lab')
  await expect(page.locator('[data-throttle-out]')).toHaveText('idle')
  await page.locator('[data-throttle]').fill('hi')
  await expect(page.locator('[data-throttle-out]')).toHaveText('hi')
})

test('change reports select value', async ({ page }) => {
  await page.goto('/change-lab')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await page.locator('[data-change]').selectOption('beta')
  await expect(page.locator('[data-out]')).toHaveText('beta')
})

test('input reports live typing value', async ({ page }) => {
  await page.goto('/input-lab')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await page.locator('[data-input]').fill('hello')
  await expect(page.locator('[data-out]')).toHaveText('hello')
})

test('submit reports FormData without navigation', async ({ page }) => {
  await page.goto('/submit-lab')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await page.locator('[data-submit] button[type="submit"]').click()
  await expect(page.locator('[data-out]')).toHaveText('avedon')
  await expect(page).toHaveURL(/\/submit-lab/)
})

test('formdata can append entries before submit reads FormData', async ({ page }) => {
  await page.goto('/formdata-lab')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await page.locator('[data-formdata] button[type="submit"]').click()
  await expect(page.locator('[data-out]')).toHaveText('formdata-ok')
  await expect(page).toHaveURL(/\/formdata-lab/)
})

test('reset increments on form reset', async ({ page }) => {
  await page.goto('/reset-lab')
  await expect(page.locator('[data-count]')).toHaveText('0')
  await page.locator('[data-reset] button[type="reset"]').click()
  await expect(page.locator('[data-count]')).toHaveText('1')
})

test('invalid fires on failed constraint validation', async ({ page }) => {
  await page.goto('/invalid-lab')
  await expect(page.locator('[data-msg]')).toHaveText('ok')
  await page.locator('[data-form] button[type="submit"]').click()
  await expect(page.locator('[data-msg]')).toHaveText('invalid')
})

test('copy writes text to the clipboard on click', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/copy-lab')
  await page.locator('[data-copy]').click()
  await expect
    .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('avedon-copy-ok')
})

test('paste reports clipboard text on paste', async ({ page }) => {
  await page.goto('/paste-lab')
  await expect(page.locator('[data-paste-out]')).toHaveText('idle')
  const ta = page.locator('[data-paste]')
  await ta.focus()
  await ta.evaluate((el) => {
    const event = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    })
    event.clipboardData!.setData('text/plain', 'pasted-ok')
    el.dispatchEvent(event)
  })
  await expect(page.locator('[data-paste-out]')).toHaveText('pasted-ok')
})

test('cut reports selected text on cut', async ({ page }) => {
  await page.goto('/cut-lab')
  await expect(page.locator('[data-cut-out]')).toHaveText('idle')
  const ta = page.locator('[data-cut]')
  await ta.focus()
  await ta.evaluate((el) => {
    const input = el as HTMLTextAreaElement
    input.setSelectionRange(0, 6)
    const event = new ClipboardEvent('cut', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    })
    event.clipboardData!.setData('text/plain', 'cut-me')
    el.dispatchEvent(event)
  })
  await expect(page.locator('[data-cut-out]')).toHaveText('cut-me')
})

test('beforeinput reports insertText data', async ({ page }) => {
  await page.goto('/beforeinput-lab')
  await expect(page.locator('[data-last]')).toHaveText('idle')
  await page.locator('[data-beforeinput]').evaluate((el) => {
    const event = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: 'x',
    })
    el.dispatchEvent(event)
  })
  await expect(page.locator('[data-last]')).toHaveText('insertText:x')
})

test('composition reports IME phases', async ({ page }) => {
  await page.goto('/composition-lab')
  await expect(page.locator('[data-last]')).toHaveText('idle')
  const input = page.locator('[data-composition]')
  await input.evaluate((el) => {
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
  })
  await expect(page.locator('[data-last]')).toHaveText('start:-')
  await input.evaluate((el) => {
    el.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: 'か' }))
  })
  await expect(page.locator('[data-last]')).toHaveText('update:か')
  await input.evaluate((el) => {
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'か' }))
  })
  await expect(page.locator('[data-last]')).toHaveText('end:か')
})

test('selectionchange reports selected text range', async ({ page }) => {
  await page.goto('/selectionchange-lab')
  await expect(page.locator('[data-out]')).toHaveText('idle')
  await page.locator('[data-selectionchange]').evaluate((el) => {
    const input = el as HTMLInputElement
    input.focus()
    input.setSelectionRange(1, 4)
    input.dispatchEvent(new Event('select', { bubbles: true }))
  })
  await expect(page.locator('[data-out]')).toHaveText('1-4:bcd')
})

test('hover reports pointer enter and leave', async ({ page }) => {
  await page.goto('/hover-lab')
  await expect(page.locator('[data-hover-state]')).toHaveText('out')
  await page.locator('[data-hover]').hover()
  await expect(page.locator('[data-hover-state]')).toHaveText('in')
  await page.locator('h1').hover()
  await expect(page.locator('[data-hover-state]')).toHaveText('out')
})

test('dblclick increments on double-click', async ({ page }) => {
  await page.goto('/dblclick-lab')
  await expect(page.locator('[data-count]')).toHaveText('0')
  await page.locator('[data-dblclick]').dblclick()
  await expect(page.locator('[data-count]')).toHaveText('1')
})

test('contextmenu increments on right-click', async ({ page }) => {
  await page.goto('/contextmenu-lab')
  await expect(page.locator('[data-count]')).toHaveText('0')
  await page.locator('[data-contextmenu]').click({ button: 'right' })
  await expect(page.locator('[data-count]')).toHaveText('1')
})

test('wheel reports deltaY', async ({ page }) => {
  await page.goto('/wheel-lab')
  await expect(page.locator('[data-delta]')).toHaveText('0')
  await page.locator('[data-wheel]').hover()
  await page.mouse.wheel(0, 80)
  await expect(page.locator('[data-delta]')).toHaveText('80')
})

test('scroll reports scrollTop', async ({ page }) => {
  await page.goto('/scroll-lab')
  await expect(page.locator('[data-y]')).toHaveText('0')
  await page.locator('[data-scroll]').evaluate((el) => {
    el.scrollTop = 60
    el.dispatchEvent(new Event('scroll'))
  })
  await expect(page.locator('[data-y]')).toHaveText('60')
})

test('snap applies scroll-snap styles', async ({ page }) => {
  await page.goto('/snap-lab')
  const type = await page.locator('[data-snap]').evaluate((el) => getComputedStyle(el).scrollSnapType)
  expect(type).toMatch(/x/)
  expect(type).toMatch(/mandatory/)
  await expect
    .poll(async () =>
      page.locator('[data-snap-child]').evaluate((el) => getComputedStyle(el).scrollSnapAlign),
    )
    .toBe('start')
})

test('pressed toggles while the pointer is down', async ({ page }) => {
  await page.goto('/pressed-lab')
  const btn = page.locator('[data-pressed]')
  const state = page.locator('[data-pressed-state]')
  await expect(state).toHaveText('up')
  await btn.hover()
  await page.mouse.down()
  await expect(state).toHaveText('down')
  await expect(btn).toHaveClass(/pressed/)
  await page.mouse.up()
  await expect(state).toHaveText('up')
  await expect(btn).not.toHaveClass(/pressed/)
})

test('focusWithin reports focus enter and leave', async ({ page }) => {
  await page.goto('/focus-within-lab')
  await expect(page.locator('[data-fw-state]')).toHaveText('out')
  await page.locator('[data-inside]').focus()
  await expect(page.locator('[data-fw-state]')).toHaveText('in')
  await page.locator('[data-outside]').focus()
  await expect(page.locator('[data-fw-state]')).toHaveText('out')
})

test('focus reports element focus enter and leave', async ({ page }) => {
  await page.goto('/focus-lab')
  await expect(page.locator('[data-focus-state]')).toHaveText('out')
  await page.locator('[data-focus]').focus()
  await expect(page.locator('[data-focus-state]')).toHaveText('in')
  await page.locator('[data-outside]').focus()
  await expect(page.locator('[data-focus-state]')).toHaveText('out')
})

test('focusVisible applies on keyboard-style focus only', async ({ page }) => {
  await page.goto('/focus-visible-lab')
  const btn = page.locator('[data-focus-visible]')
  const state = page.locator('[data-focus-visible-state]')
  await expect(state).toHaveText('hidden')
  await btn.click()
  await expect(state).toHaveText('hidden')
  await expect(btn).not.toHaveClass(/focus-visible/)
  await btn.evaluate((el) => (el as HTMLElement).blur())
  await btn.evaluate((el) => (el as HTMLElement).focus({ focusVisible: true }))
  await expect(state).toHaveText('visible')
  await expect(btn).toHaveClass(/focus-visible/)
})

test('download triggers a file download on click', async ({ page }) => {
  await page.goto('/download-lab')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-dl]').click(),
  ])
  expect(download.suggestedFilename()).toBe('avedon-download.txt')
  const path = await download.path()
  expect(path).toBeTruthy()
  const text = await download.createReadStream().then(async (stream) => {
    const chunks: Buffer[] = []
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
    return Buffer.concat(chunks).toString('utf8')
  })
  expect(text).toBe('hello-download')
})

test('fullscreen toggles Fullscreen API on click', async ({ page }) => {
  await page.goto('/fullscreen-lab')
  await expect
    .poll(async () => page.evaluate(() => document.fullscreenElement?.getAttribute('data-fs') ?? null))
    .toBe(null)
  await page.locator('[data-fs]').click()
  await expect
    .poll(async () => page.evaluate(() => document.fullscreenElement?.getAttribute('data-fs') ?? null))
    .toBe('')
  await page.locator('[data-fs]').click()
  await expect
    .poll(async () => page.evaluate(() => document.fullscreenElement?.getAttribute('data-fs') ?? null))
    .toBe(null)
})

test('resize reports contentRect width', async ({ page }) => {
  await page.goto('/resize-lab')
  await expect
    .poll(async () => page.locator('[data-rz-width]').textContent())
    .toBe('180')
})

test('swipe reports direction after a pointer drag', async ({ page }) => {
  await page.goto('/swipe-lab')
  await expect(page.locator('[data-swipe-dir]')).toHaveText('none')
  const box = await page.locator('[data-swipe]').boundingBox()
  expect(box).toBeTruthy()
  const y = box!.y + box!.height / 2
  await page.mouse.move(box!.x + box!.width - 10, y)
  await page.mouse.down()
  await page.mouse.move(box!.x + 10, y, { steps: 5 })
  await page.mouse.up()
  await expect(page.locator('[data-swipe-dir]')).toHaveText('left')
})

test('pinch reports scale from two pointers', async ({ page }) => {
  await page.goto('/pinch-lab')
  await expect(page.locator('[data-pinch-scale]')).toHaveText('1.00')
  await page.locator('[data-pinch]').evaluate((el) => {
    const fire = (type: string, init: PointerEventInit) => {
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init }))
    }
    fire('pointerdown', { pointerId: 1, clientX: 10, clientY: 50, pointerType: 'touch' })
    fire('pointerdown', { pointerId: 2, clientX: 110, clientY: 50, pointerType: 'touch' })
    fire('pointermove', { pointerId: 2, clientX: 210, clientY: 50, pointerType: 'touch' })
  })
  await expect(page.locator('[data-pinch-scale]')).toHaveText('2.00')
})

test('tooltip shows content on hover', async ({ page }) => {
  await page.goto('/tooltip-lab')
  await expect(page.locator('[data-avedon-tooltip]')).toHaveCount(0)
  await page.locator('[data-tip]').hover()
  await expect(page.locator('[data-avedon-tooltip]')).toHaveText('Save draft')
  await page.mouse.move(0, 0)
  await expect(page.locator('[data-avedon-tooltip]')).toHaveCount(0)
})

test('mutate reports childList changes', async ({ page }) => {
  await page.goto('/mutate-lab')
  await expect(page.locator('[data-mutate-count]')).toHaveText('0')
  await page.locator('[data-add]').click()
  await expect
    .poll(async () => page.locator('[data-mutate-count]').textContent())
    .toBe('1')
})

test('sticky reports stuck state after scroll', async ({ page }) => {
  await page.goto('/sticky-lab')
  await expect(page.locator('[data-sticky-state]')).toHaveText('free')
  await page.evaluate(() => {
    const el = document.querySelector('[data-sticky]') as HTMLElement | null
    const top = el ? el.getBoundingClientRect().top + window.scrollY : 0
    window.scrollTo(0, top + 40)
  })
  await expect
    .poll(async () => page.locator('[data-sticky-state]').textContent())
    .toBe('stuck')
})

test('drag reports pointer deltas', async ({ page }) => {
  await page.goto('/drag-lab')
  await expect(page.locator('[data-drag-delta]')).toHaveText('0,0')
  const box = await page.locator('[data-drag]').boundingBox()
  expect(box).toBeTruthy()
  const x = box!.x + box!.width / 2
  const y = box!.y + box!.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 40, y + 20, { steps: 4 })
  await page.mouse.up()
  await expect(page.locator('[data-drag-delta]')).toHaveText('40,20')
})

test('dropzone accepts a dropped file', async ({ page }) => {
  await page.goto('/dropzone-lab')
  await expect(page.locator('[data-drop-names]')).toHaveText('none')
  const zone = page.locator('[data-drop]')
  await zone.evaluate((el) => {
    const dt = new DataTransfer()
    dt.items.add(new File(['hello'], 'hello.txt', { type: 'text/plain' }))
    el.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }))
  })
  await expect(page.locator('[data-drop]')).toHaveAttribute('data-active', 'true')
  await zone.evaluate((el) => {
    const dt = new DataTransfer()
    dt.items.add(new File(['hello'], 'hello.txt', { type: 'text/plain' }))
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
  })
  await expect(page.locator('[data-drop-names]')).toHaveText('hello.txt')
  await expect(page.locator('[data-drop]')).toHaveAttribute('data-active', 'false')
})

test('focusTrap cycles Tab within the trapped region', async ({ page }) => {
  await page.goto('/focus-trap-lab')
  await expect(page.locator('[data-trap-a]')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('[data-trap-b]')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('[data-trap-a]')).toBeFocused()
})

test('lockScroll sets document overflow hidden while active', async ({ page }) => {
  await page.goto('/lock-scroll-lab')
  await expect(page.locator('[data-lock-status]')).toHaveText('locked')
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.style.overflow))
    .toBe('hidden')
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(page.locator('[data-lock-status]')).toHaveText('unlocked')
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.style.overflow))
    .toBe('')
})

test('escapeKey closes on Escape', async ({ page }) => {
  await page.goto('/escape-key-lab')
  await expect(page.locator('[data-escape-status]')).toHaveText('open')
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-escape-status]')).toHaveText('closed')
})

test('inView reports when the target scrolls into view', async ({ page }) => {
  await page.goto('/in-view-lab')
  await expect(page.locator('[data-in-view-status]')).toHaveText('hidden')
  await page.locator('[data-in-view-target]').scrollIntoViewIfNeeded()
  await expect(page.locator('[data-in-view-status]')).toHaveText('visible')
})

test('scrollIntoView brings the target into the viewport', async ({ page }) => {
  await page.goto('/scroll-into-view-lab')
  await expect(page.locator('[data-siv-target]')).toHaveCount(0)
  await page.locator('[data-siv-jump]').click()
  const target = page.locator('[data-siv-target]')
  await expect(target).toHaveCount(1)
  await expect
    .poll(async () =>
      target.evaluate((el) => {
        const r = el.getBoundingClientRect()
        return r.top >= 0 && r.bottom <= window.innerHeight
      }),
    )
    .toBe(true)
})

test('infiniteScroll fires when scrolled near the bottom', async ({ page }) => {
  await page.goto('/infinite-scroll-lab')
  await expect(page.locator('[data-inf-loads]')).toHaveText('0')
  await page.locator('[data-inf-scroll]').evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await expect(page.locator('[data-inf-loads]')).toHaveText('1')
})

test('reveal adds a class when scrolled into view', async ({ page }) => {
  await page.goto('/reveal-lab')
  const target = page.locator('[data-reveal]')
  await expect(target).not.toHaveClass(/revealed/)
  await target.scrollIntoViewIfNeeded()
  await expect(target).toHaveClass(/revealed/)
})

test('lazy loads data-src when scrolled into view', async ({ page }) => {
  await page.goto('/lazy-lab')
  const img = page.locator('[data-lazy]')
  await expect(img).not.toHaveAttribute('src')
  await img.scrollIntoViewIfNeeded()
  await expect(img).toHaveAttribute('src', /data:image\/gif/)
  await expect(img).not.toHaveAttribute('data-src')
})

test('scrollspy reports the most visible section id', async ({ page }) => {
  await page.goto('/scrollspy-lab')
  await page.locator('[data-sec="b"]').scrollIntoViewIfNeeded()
  await expect(page.locator('[data-scrollspy-active]')).toHaveText('sec-b')
})

test('hotkey increments on the configured key', async ({ page }) => {
  await page.goto('/hotkey-lab')
  await expect(page.locator('[data-hotkey-count]')).toHaveText('0')
  await page.keyboard.press('k')
  await expect(page.locator('[data-hotkey-count]')).toHaveText('1')
  await page.keyboard.press('k')
  await expect(page.locator('[data-hotkey-count]')).toHaveText('2')
})

test('keydown increments when the focused element receives the key', async ({ page }) => {
  await page.goto('/keydown-lab')
  await expect(page.locator('[data-keydown-count]')).toHaveText('0')
  await page.locator('[data-keydown]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-keydown-count]')).toHaveText('1')
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-keydown-count]')).toHaveText('2')
})

test('keyup increments when the focused element releases the key', async ({ page }) => {
  await page.goto('/keyup-lab')
  await expect(page.locator('[data-keyup-count]')).toHaveText('0')
  await page.locator('[data-keyup]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-keyup-count]')).toHaveText('1')
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-keyup-count]')).toHaveText('2')
})

test('bind:this exposes the element for imperative focus', async ({ page }) => {
  await page.goto('/bind-this-lab')
  await expect(page.locator('[data-bind-this-state]')).toHaveText('idle')
  await page.getByRole('button', { name: 'Focus' }).click()
  await expect(page.locator('[data-bind-this-state]')).toHaveText('focused')
  await expect(page.locator('[data-bind-this]')).toBeFocused()
})

test('bind:group syncs radio selection', async ({ page }) => {
  await page.goto('/bind-group-lab')
  await expect(page.locator('[data-group-a]')).toBeChecked()
  await expect(page.locator('[data-group-state]')).toHaveText('a')

  await page.locator('[data-group-b]').check()
  await expect(page.locator('[data-group-b]')).toBeChecked()
  await expect(page.locator('[data-group-state]')).toHaveText('b')
})

test('bind:group syncs checkbox arrays', async ({ page }) => {
  await page.goto('/bind-group-lab')
  await expect(page.locator('[data-group-x]')).toBeChecked()
  await expect(page.locator('[data-group-y]')).not.toBeChecked()
  await expect(page.locator('[data-group-tags]')).toHaveText('x')

  await page.locator('[data-group-y]').check()
  await expect(page.locator('[data-group-tags]')).toHaveText('x,y')

  await page.locator('[data-group-x]').uncheck()
  await expect(page.locator('[data-group-tags]')).toHaveText('y')
})

test('transition:fade reaches full opacity', async ({ page }) => {
  await page.goto('/transition-fade-lab')
  const target = page.locator('[data-fade-target]')
  await expect(target).toHaveText('Faded in')
  await expect.poll(async () => target.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
})

test('crossfade toggles panels by key', async ({ page }) => {
  await page.goto('/crossfade-lab')
  await expect(page.locator('[data-crossfade-a]')).toHaveText('Panel A')
  await page.locator('[data-crossfade-toggle]').click()
  await expect(page.locator('[data-crossfade-b]')).toHaveText('Panel B', { timeout: 5_000 })
  await expect(page.locator('[data-crossfade-a]')).toHaveCount(0)
})

test('nested layout load merges into page props', async ({ page }) => {
  await page.goto('/nested-load-lab')
  await expect(page.locator('[data-shell-label]')).toHaveText('from-layout')
  await expect(page.locator('[data-page-label]')).toHaveText('from-page')
  await expect(page.locator('[data-merged-shell]')).toHaveText('from-layout')
})

test('component bind:value syncs child input to parent signal', async ({ page }) => {
  await page.goto('/component-bind-lab')
  await expect(page.locator('[data-bind-parent]')).toHaveText('hello')
  await page.locator('[data-bind-child]').fill('world')
  await expect(page.locator('[data-bind-parent]')).toHaveText('world')
})

test('transition delay holds intro before fading in', async ({ page }) => {
  await page.goto('/transition-delay-lab')
  await page.getByRole('button', { name: 'Toggle' }).click()
  const target = page.locator('[data-delay-target]')
  await expect(target).toHaveText('Delayed fade')
  const early = Number(await target.evaluate((el) => getComputedStyle(el).opacity))
  expect(early).toBeLessThan(1)
  await expect
    .poll(async () => target.evaluate((el) => getComputedStyle(el).opacity))
    .toBe('1')
})

test('transition easing applies linear timing function', async ({ page }) => {
  await page.goto('/transition-easing-lab')
  await page.getByRole('button', { name: 'Toggle' }).click()
  const target = page.locator('[data-ease-target]')
  await expect(target).toHaveText('Linear fade')
  await expect
    .poll(async () => {
      const t = await target.evaluate((el) => getComputedStyle(el).transitionTimingFunction)
      return t.includes('linear')
    })
    .toBe(true)
  await expect
    .poll(async () => target.evaluate((el) => getComputedStyle(el).opacity))
    .toBe('1')
})

test('tick resolves after DOM updates from a click handler', async ({ page }) => {
  await page.goto('/tick-lab')
  await expect(page.locator('[data-n]')).toHaveText('0')
  await expect(page.locator('[data-seen]')).toHaveText('before')
  await page.getByRole('button', { name: 'Bump' }).click()
  await expect(page.locator('[data-n]')).toHaveText('1')
  await expect(page.locator('[data-seen]')).toHaveText('1')
})

test('untrack ignores nested signal reads in an effect', async ({ page }) => {
  await page.goto('/untrack-lab')
  await expect(page.locator('[data-untrack-log]')).toHaveText('a=1 b=10')
  await page.getByRole('button', { name: 'Bump B' }).click()
  await expect(page.locator('[data-untrack-log]')).toHaveText('a=1 b=10')
  await page.getByRole('button', { name: 'Bump A' }).click()
  await expect(page.locator('[data-untrack-log]')).toHaveText('a=2 b=11')
})

test('setContext / getContext flows from parent to child', async ({ page }) => {
  await page.goto('/context-lab')
  await expect(page.locator('[data-theme-badge]')).toHaveText('dark')
})

test('getAllContexts merges parent context entries', async ({ page }) => {
  await page.goto('/all-contexts-lab')
  await expect(page.locator('[data-all-ctx]')).toHaveText('locale=tr,theme=dark')
})

test('beforeUpdate / afterUpdate run around DOM updates', async ({ page }) => {
  await page.goto('/update-hooks-lab')
  await expect(page.locator('[data-update-log]')).toHaveText('A')
  await page.getByRole('button', { name: 'Bump' }).click()
  await expect(page.locator('[data-n]')).toHaveText('1')
  await expect(page.locator('[data-update-log]')).toHaveText('ABA')
})

test('mediaQuery signal tracks viewport width', async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 700 })
  await page.goto('/media-query-lab')
  await expect(page.locator('[data-mq]')).toHaveText('narrow')
  await page.setViewportSize({ width: 1000, height: 700 })
  await expect(page.locator('[data-mq]')).toHaveText('wide')
})

test('prefersReducedMotion tracks the reduced-motion media query', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/prefers-reduced-motion-lab')
  await expect(page.locator('[data-prm]')).toHaveText('no-preference')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('[data-prm]')).toHaveText('reduce')
})

test('prefersColorScheme tracks the color-scheme media query', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/prefers-color-scheme-lab')
  await expect(page.locator('[data-pcs]')).toHaveText('light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('[data-pcs]')).toHaveText('dark')
})

test('prefersContrast tracks the contrast media query', async ({ page }) => {
  await page.goto('/prefers-contrast-lab')
  await expect(page.locator('[data-pc]')).toHaveText('no-preference')
  const client = await page.context().newCDPSession(page)
  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-contrast', value: 'more' }],
  })
  await expect(page.locator('[data-pc]')).toHaveText('more')
})

test('prefersReducedTransparency tracks the reduced-transparency media query', async ({ page }) => {
  await page.goto('/prefers-reduced-transparency-lab')
  await expect(page.locator('[data-prt]')).toHaveText('no-preference')
  const client = await page.context().newCDPSession(page)
  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
  })
  await expect(page.locator('[data-prt]')).toHaveText('reduce')
})

test('prefersReducedData tracks the reduced-data media query', async ({ page }) => {
  await page.addInitScript(() => {
    const listeners = new Set()
    let matches = false
    // @ts-expect-error test hook
    window.__setPrefersReducedData = (v) => {
      matches = v
      for (const cb of listeners) cb({ matches: v })
    }
    const original = window.matchMedia.bind(window)
    window.matchMedia = (query) => {
      if (query === '(prefers-reduced-data: reduce)') {
        return {
          get matches() {
            return matches
          },
          media: query,
          addEventListener: (_type, cb) => {
            listeners.add(cb)
          },
          removeEventListener: (_type, cb) => {
            listeners.delete(cb)
          },
          addListener: (cb) => {
            listeners.add(cb)
          },
          removeListener: (cb) => {
            listeners.delete(cb)
          },
          dispatchEvent: () => false,
          onchange: null,
        }
      }
      return original(query)
    }
  })
  await page.goto('/prefers-reduced-data-lab')
  await expect(page.locator('[data-prd]')).toHaveText('no-preference')
  await page.evaluate(() => {
    // @ts-expect-error test hook
    window.__setPrefersReducedData(true)
  })
  await expect(page.locator('[data-prd]')).toHaveText('reduce')
})

test('saveDataSignal tracks navigator.connection.saveData', async ({ page }) => {
  await page.addInitScript(() => {
    const listeners = new Set()
    const connection = {
      saveData: false,
      addEventListener: (_type, cb) => {
        listeners.add(cb)
      },
      removeEventListener: (_type, cb) => {
        listeners.delete(cb)
      },
    }
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      get: () => connection,
    })
    // @ts-expect-error test hook
    window.__setSaveData = (v) => {
      connection.saveData = v
      for (const cb of listeners) cb()
    }
  })
  await page.goto('/save-data-signal-lab')
  await expect(page.locator('[data-save-data]')).toHaveText('off')
  await page.evaluate(() => {
    // @ts-expect-error test hook
    window.__setSaveData(true)
  })
  await expect(page.locator('[data-save-data]')).toHaveText('on')
})

test('connectionEffectiveType tracks navigator.connection.effectiveType', async ({ page }) => {
  await page.addInitScript(() => {
    const listeners = new Set()
    const connection = {
      effectiveType: '4g',
      addEventListener: (_type, cb) => {
        listeners.add(cb)
      },
      removeEventListener: (_type, cb) => {
        listeners.delete(cb)
      },
    }
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      get: () => connection,
    })
    // @ts-expect-error test hook
    window.__setEffectiveType = (v) => {
      connection.effectiveType = v
      for (const cb of listeners) cb()
    }
  })
  await page.goto('/connection-effective-type-lab')
  await expect(page.locator('[data-conn-type]')).toHaveText('4g')
  await page.evaluate(() => {
    // @ts-expect-error test hook
    window.__setEffectiveType('3g')
  })
  await expect(page.locator('[data-conn-type]')).toHaveText('3g')
})

test('connectionDownlink tracks navigator.connection.downlink', async ({ page }) => {
  await page.addInitScript(() => {
    const listeners = new Set()
    const connection = {
      downlink: 10,
      addEventListener: (_type, cb) => {
        listeners.add(cb)
      },
      removeEventListener: (_type, cb) => {
        listeners.delete(cb)
      },
    }
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      get: () => connection,
    })
    // @ts-expect-error test hook
    window.__setDownlink = (v) => {
      connection.downlink = v
      for (const cb of listeners) cb()
    }
  })
  await page.goto('/connection-downlink-lab')
  await expect(page.locator('[data-conn-downlink]')).toHaveText('10')
  await page.evaluate(() => {
    // @ts-expect-error test hook
    window.__setDownlink(1.5)
  })
  await expect(page.locator('[data-conn-downlink]')).toHaveText('1.5')
})

test('connectionRtt tracks navigator.connection.rtt', async ({ page }) => {
  await page.addInitScript(() => {
    const listeners = new Set()
    const connection = {
      rtt: 50,
      addEventListener: (_type, cb) => {
        listeners.add(cb)
      },
      removeEventListener: (_type, cb) => {
        listeners.delete(cb)
      },
    }
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      get: () => connection,
    })
    // @ts-expect-error test hook
    window.__setRtt = (v) => {
      connection.rtt = v
      for (const cb of listeners) cb()
    }
  })
  await page.goto('/connection-rtt-lab')
  await expect(page.locator('[data-conn-rtt]')).toHaveText('50')
  await page.evaluate(() => {
    // @ts-expect-error test hook
    window.__setRtt(200)
  })
  await expect(page.locator('[data-conn-rtt]')).toHaveText('200')
})

test('forcedColors tracks the forced-colors media query', async ({ page }) => {
  await page.addInitScript(() => {
    const listeners = new Set()
    let matches = false
    // @ts-expect-error test hook
    window.__setForcedColors = (v) => {
      matches = v
      for (const cb of listeners) cb({ matches: v })
    }
    const original = window.matchMedia.bind(window)
    window.matchMedia = (query) => {
      if (query === '(forced-colors: active)') {
        return {
          get matches() {
            return matches
          },
          media: query,
          addEventListener: (_type, cb) => {
            listeners.add(cb)
          },
          removeEventListener: (_type, cb) => {
            listeners.delete(cb)
          },
          addListener: (cb) => {
            listeners.add(cb)
          },
          removeListener: (cb) => {
            listeners.delete(cb)
          },
          dispatchEvent: () => false,
          onchange: null,
        }
      }
      return original(query)
    }
  })
  await page.goto('/forced-colors-lab')
  await expect(page.locator('[data-fc]')).toHaveText('none')
  await page.evaluate(() => {
    // @ts-expect-error test hook
    window.__setForcedColors(true)
  })
  await expect(page.locator('[data-fc]')).toHaveText('active')
})

test('invertedColors tracks the inverted-colors media query', async ({ page }) => {
  await page.addInitScript(() => {
    const listeners = new Set()
    let matches = false
    // @ts-expect-error test hook
    window.__setInvertedColors = (v) => {
      matches = v
      for (const cb of listeners) cb({ matches: v })
    }
    const original = window.matchMedia.bind(window)
    window.matchMedia = (query) => {
      if (query === '(inverted-colors: inverted)') {
        return {
          get matches() {
            return matches
          },
          media: query,
          addEventListener: (_type, cb) => {
            listeners.add(cb)
          },
          removeEventListener: (_type, cb) => {
            listeners.delete(cb)
          },
          addListener: (cb) => {
            listeners.add(cb)
          },
          removeListener: (cb) => {
            listeners.delete(cb)
          },
          dispatchEvent: () => false,
          onchange: null,
        }
      }
      return original(query)
    }
  })
  await page.goto('/inverted-colors-lab')
  await expect(page.locator('[data-ic]')).toHaveText('none')
  await page.evaluate(() => {
    // @ts-expect-error test hook
    window.__setInvertedColors(true)
  })
  await expect(page.locator('[data-ic]')).toHaveText('inverted')
})

test('windowSize signal tracks viewport dimensions', async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 700 })
  await page.goto('/window-size-lab')
  await expect(page.locator('[data-win-w]')).toHaveText('500')
  await expect(page.locator('[data-win-h]')).toHaveText('700')
  await page.setViewportSize({ width: 1000, height: 640 })
  await expect(page.locator('[data-win-w]')).toHaveText('1000')
  await expect(page.locator('[data-win-h]')).toHaveText('640')
})

test('pageScroll signal tracks window scroll offsets', async ({ page }) => {
  await page.goto('/page-scroll-lab')
  await expect(page.locator('[data-scroll-y]')).toHaveText('0')
  await page.evaluate(() => window.scrollTo(0, 240))
  await expect(page.locator('[data-scroll-y]')).toHaveText('240')
})

test('devicePixelRatio signal reports window.devicePixelRatio', async ({ page }) => {
  await page.goto('/device-pixel-ratio-lab')
  const expected = await page.evaluate(() => String(window.devicePixelRatio))
  await expect(page.locator('[data-dpr]')).toHaveText(expected)
})

test('persistedSignal survives a reload', async ({ page }) => {
  await page.goto('/persisted-signal-lab')
  await page.evaluate(() => {
    localStorage.removeItem('avedon-persist-lab')
    sessionStorage.removeItem('avedon-session-lab')
  })
  await page.reload()
  await expect(page.locator('[data-persist-name]')).toHaveText('guest')
  await expect(page.locator('[data-session-name]')).toHaveText('fresh')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('[data-persist-name]')).toHaveText('ada')
  await page.reload()
  await expect(page.locator('[data-persist-name]')).toHaveText('ada')
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(page.locator('[data-persist-name]')).toHaveText('guest')
})

test('persistedSignal session storage survives reload in the same tab', async ({ page }) => {
  await page.goto('/persisted-signal-lab')
  await page.evaluate(() => sessionStorage.removeItem('avedon-session-lab'))
  await page.reload()
  await expect(page.locator('[data-session-name]')).toHaveText('fresh')
  await page.getByRole('button', { name: 'Save tab' }).click()
  await expect(page.locator('[data-session-name]')).toHaveText('sticky')
  await page.reload()
  await expect(page.locator('[data-session-name]')).toHaveText('sticky')
})

test('onlineSignal reflects navigator.onLine and offline events', async ({ page }) => {
  await page.goto('/online-signal-lab')
  await expect(page.locator('[data-online]')).toHaveText('online')
  await page.context().setOffline(true)
  await expect(page.locator('[data-online]')).toHaveText('offline')
  await page.context().setOffline(false)
  await expect(page.locator('[data-online]')).toHaveText('online')
})

test('nowSignal ticks over time', async ({ page }) => {
  await page.goto('/now-signal-lab')
  const first = await page.locator('[data-now]').textContent()
  expect(first).toMatch(/^\d+$/)
  await expect
    .poll(async () => page.locator('[data-now]').textContent())
    .not.toBe(first)
})

test('idleSignal becomes idle then active on activity', async ({ page }) => {
  await page.goto('/idle-signal-lab')
  await expect(page.locator('[data-idle]')).toHaveText('active')
  await expect(page.locator('[data-idle]')).toHaveText('idle', { timeout: 5_000 })
  await page.mouse.move(40, 40)
  await expect(page.locator('[data-idle]')).toHaveText('active')
})

test('localeSignal shows navigator.language', async ({ page }) => {
  await page.goto('/locale-signal-lab')
  const expected = await page.evaluate(() => navigator.language)
  await expect(page.locator('[data-locale]')).toHaveText(expected || 'unknown')
})

test('localesSignal shows navigator.languages', async ({ page }) => {
  await page.goto('/locales-signal-lab')
  const expected = await page.evaluate(() => {
    const list = Array.from(navigator.languages)
    return list.length ? list.join(', ') : 'none'
  })
  await expect(page.locator('[data-locales]')).toHaveText(expected)
})

test('timeZoneSignal shows host IANA time zone', async ({ page }) => {
  await page.goto('/time-zone-signal-lab')
  const expected = await page.evaluate(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
  )
  await expect(page.locator('[data-timezone]')).toHaveText(expected)
})

test('hardwareConcurrencySignal shows navigator.hardwareConcurrency', async ({ page }) => {
  await page.goto('/hardware-concurrency-lab')
  const expected = await page.evaluate(() => {
    const n = navigator.hardwareConcurrency
    return typeof n === 'number' && n > 0 ? String(n) : 'unknown'
  })
  await expect(page.locator('[data-cores]')).toHaveText(expected)
})

test('deviceMemorySignal shows navigator.deviceMemory', async ({ page }) => {
  await page.goto('/device-memory-lab')
  const expected = await page.evaluate(() => {
    const n = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    return typeof n === 'number' && n > 0 ? String(n) : 'unknown'
  })
  await expect(page.locator('[data-memory]')).toHaveText(expected)
})

test('userAgentSignal shows navigator.userAgent', async ({ page }) => {
  await page.goto('/user-agent-lab')
  const expected = await page.evaluate(() => navigator.userAgent || 'unknown')
  await expect(page.locator('[data-ua]')).toHaveText(expected)
})

test('doNotTrackSignal shows normalized navigator.doNotTrack', async ({ page }) => {
  await page.goto('/do-not-track-lab')
  const expected = await page.evaluate(() => {
    const raw = navigator.doNotTrack
    if (raw === '1' || raw === 'yes') return '1'
    if (raw === '0' || raw === 'no') return '0'
    return 'unspecified'
  })
  await expect(page.locator('[data-dnt]')).toHaveText(expected)
})

test('vendorSignal shows navigator.vendor', async ({ page }) => {
  await page.goto('/vendor-lab')
  const expected = await page.evaluate(() => navigator.vendor || 'unknown')
  await expect(page.locator('[data-vendor]')).toHaveText(expected)
})

test('appVersionSignal shows navigator.appVersion', async ({ page }) => {
  await page.goto('/app-version-lab')
  const expected = await page.evaluate(() => navigator.appVersion || 'unknown')
  await expect(page.locator('[data-app-version]')).toHaveText(expected)
})

test('productSignal shows navigator.product', async ({ page }) => {
  await page.goto('/product-lab')
  const expected = await page.evaluate(() => navigator.product || 'unknown')
  await expect(page.locator('[data-product]')).toHaveText(expected)
})

test('appNameSignal shows navigator.appName', async ({ page }) => {
  await page.goto('/app-name-lab')
  const expected = await page.evaluate(() => navigator.appName || 'unknown')
  await expect(page.locator('[data-app-name]')).toHaveText(expected)
})

test('platformSignal shows navigator.platform', async ({ page }) => {
  await page.goto('/platform-lab')
  const expected = await page.evaluate(() => navigator.platform || 'unknown')
  await expect(page.locator('[data-platform]')).toHaveText(expected)
})

test('appCodeNameSignal shows navigator.appCodeName', async ({ page }) => {
  await page.goto('/app-code-name-lab')
  const expected = await page.evaluate(() => navigator.appCodeName || 'unknown')
  await expect(page.locator('[data-app-code-name]')).toHaveText(expected)
})

test('maxTouchPointsSignal shows navigator.maxTouchPoints', async ({ page }) => {
  await page.goto('/max-touch-points-lab')
  const expected = await page.evaluate(() => String(navigator.maxTouchPoints ?? 0))
  await expect(page.locator('[data-points]')).toHaveText(expected)
})

test('cookieEnabledSignal shows navigator.cookieEnabled', async ({ page }) => {
  await page.goto('/cookie-enabled-lab')
  const expected = await page.evaluate(() => (navigator.cookieEnabled ? 'yes' : 'no'))
  await expect(page.locator('[data-cookies]')).toHaveText(expected)
})

test('pdfViewerEnabledSignal shows navigator.pdfViewerEnabled', async ({ page }) => {
  await page.goto('/pdf-viewer-enabled-lab')
  const expected = await page.evaluate(() =>
    (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled ? 'yes' : 'no',
  )
  await expect(page.locator('[data-pdf]')).toHaveText(expected)
})

test('webdriverSignal shows navigator.webdriver', async ({ page }) => {
  await page.goto('/webdriver-lab')
  const expected = await page.evaluate(() => (navigator.webdriver ? 'yes' : 'no'))
  await expect(page.locator('[data-webdriver]')).toHaveText(expected)
})

test('storageEstimateSignal resolves usage/quota', async ({ page }) => {
  await page.goto('/storage-estimate-lab')
  await expect
    .poll(async () => page.locator('[data-estimate]').textContent())
    .toMatch(/^\d+\/\d+$/)
})

test('storagePersistedSignal resolves persisted flag', async ({ page }) => {
  await page.goto('/storage-persisted-lab')
  await expect
    .poll(async () => page.locator('[data-persisted]').textContent())
    .toMatch(/^(yes|no)$/)
})

test('hashSignal syncs with location.hash', async ({ page }) => {
  await page.goto('/hash-signal-lab')
  await expect(page.locator('[data-hash]')).toHaveText('none')
  await page.locator('[data-go-a]').click()
  await expect(page.locator('[data-hash]')).toHaveText('#a')
  await expect.poll(async () => page.evaluate(() => location.hash)).toBe('#a')
  await page.locator('[data-go-b]').click()
  await expect(page.locator('[data-hash]')).toHaveText('#b')
  await expect.poll(async () => page.evaluate(() => location.hash)).toBe('#b')
})

test('searchParamsSignal syncs with location.search', async ({ page }) => {
  await page.goto('/search-params-signal-lab')
  await expect(page.locator('[data-search]')).toHaveText('none')
  await page.locator('[data-set]').click()
  await expect(page.locator('[data-search]')).toHaveText('?q=avedon')
  await expect.poll(async () => page.evaluate(() => location.search)).toBe('?q=avedon')
  await page.locator('[data-clear]').click()
  await expect(page.locator('[data-search]')).toHaveText('none')
  await expect.poll(async () => page.evaluate(() => location.search)).toBe('')
  await page.locator('[data-history]').click()
  await expect(page.locator('[data-search]')).toHaveText('?from=history')
  await expect.poll(async () => page.evaluate(() => location.search)).toBe('?from=history')
})

test('pathnameSignal syncs with location.pathname', async ({ page }) => {
  await page.goto('/pathname-signal-lab')
  await expect(page.locator('[data-path]')).toHaveText('/pathname-signal-lab')
  await page.locator('[data-extra]').click()
  await expect(page.locator('[data-path]')).toHaveText('/pathname-signal-lab/x')
  await expect
    .poll(async () => page.evaluate(() => location.pathname))
    .toBe('/pathname-signal-lab/x')
  await page.locator('[data-lab]').click()
  await expect(page.locator('[data-path]')).toHaveText('/pathname-signal-lab')
})

test('documentTitleSignal syncs with document.title', async ({ page }) => {
  await page.goto('/document-title-signal-lab')
  await page.locator('[data-alpha]').click()
  await expect(page.locator('[data-doc-title]')).toHaveText('Alpha Title')
  await expect.poll(async () => page.title()).toBe('Alpha Title')
  await page.locator('[data-beta]').click()
  await expect(page.locator('[data-doc-title]')).toHaveText('Beta Title')
  await expect.poll(async () => page.title()).toBe('Beta Title')
})

test('htmlLangSignal syncs with documentElement.lang', async ({ page }) => {
  await page.goto('/html-lang-signal-lab')
  await page.locator('[data-lang-tr]').click()
  await expect(page.locator('[data-html-lang]')).toHaveText('tr')
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.lang))
    .toBe('tr')
  await page.locator('[data-lang-en]').click()
  await expect(page.locator('[data-html-lang]')).toHaveText('en')
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.lang))
    .toBe('en')
})

test('htmlDirSignal syncs with documentElement.dir', async ({ page }) => {
  await page.goto('/html-dir-signal-lab')
  await page.locator('[data-dir-rtl]').click()
  await expect(page.locator('[data-html-dir]')).toHaveText('rtl')
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.dir))
    .toBe('rtl')
  await page.locator('[data-dir-ltr]').click()
  await expect(page.locator('[data-html-dir]')).toHaveText('ltr')
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.dir))
    .toBe('ltr')
})

test('visibilitySignal tracks document.visibilityState', async ({ page }) => {
  await page.goto('/visibility-signal-lab')
  await expect(page.locator('[data-visibility]')).toHaveText('visible')
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.locator('[data-visibility]')).toHaveText('hidden')
})

test('activeElement tracks document focus', async ({ page }) => {
  await page.goto('/active-element-lab')
  await expect(page.locator('[data-active]')).toHaveText('none')
  await page.locator('[data-focus="a"]').focus()
  await expect(page.locator('[data-active]')).toHaveText('a')
  await page.locator('[data-focus="b"]').focus()
  await expect(page.locator('[data-active]')).toHaveText('b')
})

test('soft hydrate restores autofocus after remount', async ({ page }) => {
  await page.goto('/soft-hydrate-focus-lab')
  await expect(page.locator('[data-focus-target]')).toBeFocused()
})

test('form state capture/restore round-trips typed values', async ({ page }) => {
  await page.goto('/soft-hydrate-form-lab')
  await expect(page.locator('[data-form-status]')).toHaveText('ok')
  await expect(page.locator('[data-form-input]')).toHaveValue('typed-before-swap')
})

test('scroll state capture/restore round-trips offsets', async ({ page }) => {
  await page.goto('/soft-hydrate-scroll-lab')
  await expect(page.locator('[data-scroll-status]')).toHaveText('ok')
})

test('batch coalesces multiple signal writes into one effect run', async ({ page }) => {
  await page.goto('/batch-lab')
  await expect(page.locator('[data-batch-status]')).toHaveText('ok')
})

test('readonly rejects writes but mirrors source updates', async ({ page }) => {
  await page.goto('/readonly-lab')
  await expect(page.locator('[data-ro-status]')).toHaveText('ok')
  await expect(page.locator('[data-ro-view]')).toHaveText('3')
})

test('tweened interpolates toward the target value', async ({ page }) => {
  await page.goto('/tweened-lab')
  await expect(page.locator('[data-tween]')).toHaveText('0')
  await page.locator('[data-go]').click()
  await expect.poll(async () => page.locator('[data-tween]').textContent()).toBe('100')
  await page.locator('[data-snap]').click()
  await expect(page.locator('[data-tween]')).toHaveText('0')
})

test('spring settles toward the target value', async ({ page }) => {
  await page.goto('/spring-lab')
  await expect(page.locator('[data-spring]')).toHaveText('0')
  await page.locator('[data-go]').click()
  await expect.poll(async () => page.locator('[data-spring]').textContent()).toBe('100')
  await page.locator('[data-snap]').click()
  await expect(page.locator('[data-spring]')).toHaveText('0')
})

test('open state capture/restore round-trips details', async ({ page }) => {
  await page.goto('/soft-hydrate-open-lab')
  await expect(page.locator('[data-open-status]')).toHaveText('ok')
  await expect(page.locator('[data-open-details]')).toHaveAttribute('open', '')
})

test('onMount runs after mount', async ({ page }) => {
  await page.goto('/lifecycle-lab')
  await expect(page.locator('[data-life-target]')).toHaveAttribute('data-life-status', 'mounted')
})

test('pageTitle sets and restores document.title', async ({ page }) => {
  await page.goto('/page-title-lab')
  await expect(page.locator('[data-pt]')).toHaveText('ready')
  await expect.poll(async () => page.title()).toBe('avedon-page-title-lab')
  await page.locator('[data-pt-nav]').click()
  await expect(page.locator('[data-life-target]')).toHaveAttribute('data-life-status', 'mounted')
  await expect.poll(async () => page.title()).not.toBe('avedon-page-title-lab')
})

test('nested component destroy runs when {#if} removes it', async ({ page }) => {
  await page.goto('/component-destroy-lab')
  await expect(page.locator('[data-child]')).toHaveText('alive')
  await expect(page.locator('[data-destroy-log]')).toHaveText('pending')
  await page.locator('[data-hide]').click()
  await expect(page.locator('[data-child]')).toHaveCount(0)
  await expect(page.locator('[data-destroy-log]')).toHaveText('cleaned')
})

test('signal updates from onMount refresh the template', async ({ page }) => {
  await page.goto('/signal-effect-lab')
  await expect(page.locator('[data-sig-effect]')).toHaveText('7')
})

test('{:else if} switches among branches', async ({ page }) => {
  await page.goto('/else-if-lab')
  await expect(page.locator('[data-elseif]')).toHaveText('alpha')
  await page.getByRole('button', { name: 'Cycle' }).click()
  await expect(page.locator('[data-elseif]')).toHaveText('beta')
  await page.getByRole('button', { name: 'Cycle' }).click()
  await expect(page.locator('[data-elseif]')).toHaveText('gamma')
})

test('{#each} {:else} shows empty state', async ({ page }) => {
  await page.goto('/each-else-lab')
  await expect(page.locator('[data-empty]')).toHaveText('empty')
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(page.locator('[data-item]')).toHaveCount(2)
  await expect(page.locator('[data-empty]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(page.locator('[data-empty]')).toHaveText('empty')
})

test('{@const} binds locals in each rows', async ({ page }) => {
  await page.goto('/const-lab')
  await expect(page.locator('[data-const-row="1"]')).toHaveText('25')
  await expect(page.locator('[data-const-row="2"]')).toHaveText('14')
  await page.getByRole('button', { name: 'Bump' }).click()
  await expect(page.locator('[data-const-row="1"]')).toHaveText('27')
  await expect(page.locator('[data-const-row="2"]')).toHaveText('16')
})

test('{#await} shows pending then settles', async ({ page }) => {
  await page.goto('/await-pending-lab')
  // Soft hydrate remounts with a browser-only pending promise.
  await expect(page.locator('[data-await-pending]')).toHaveText('loading')
  await page.getByRole('button', { name: 'Finish' }).click()
  await expect(page.locator('[data-await-then]')).toHaveText('ready')
  await expect(page.locator('[data-await-pending]')).toHaveCount(0)
})

test('on:submit|preventDefault keeps the page on the lab', async ({ page }) => {
  await page.goto('/event-modifiers-lab')
  await expect(page.locator('[data-mod-log]')).toHaveText('idle')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page).toHaveURL(/\/event-modifiers-lab\/?$/)
  await expect(page.locator('[data-mod-log]')).toHaveText('saved')
})

test('on:click|stopImmediatePropagation blocks parent handlers', async ({ page }) => {
  await page.goto('/event-modifiers-lab')
  await expect(page.locator('[data-mod-outer-flag]')).toHaveText('no')
  await expect(page.locator('[data-mod-inner-flag]')).toHaveText('no')
  await page.locator('[data-mod-inner]').click()
  await expect(page.locator('[data-mod-inner-flag]')).toHaveText('yes')
  await expect(page.locator('[data-mod-outer-flag]')).toHaveText('no')
})

test('on:wheel|nonpassive runs preventDefault without throwing', async ({ page }) => {
  await page.goto('/event-modifiers-lab')
  await expect(page.locator('[data-mod-wheel-log]')).toHaveText('idle')
  await page.locator('[data-mod-wheel]').dispatchEvent('wheel', { deltaY: 40 })
  await expect(page.locator('[data-mod-wheel-log]')).toHaveText('wheel')
})

test('HTML comments are stripped from the page', async ({ page }) => {
  await page.goto('/comment-lab')
  await expect(page.locator('[data-comment-lab]')).toHaveText('visible')
  const html = await page.content()
  expect(html).not.toContain('should not appear')
  expect(html).not.toContain('trailing')
  const commentNodes = await page.locator('main').evaluate((main) => {
    const out: string[] = []
    const walk = (n: Node) => {
      if (n.nodeType === Node.COMMENT_NODE) out.push(n.textContent ?? '')
      n.childNodes.forEach(walk)
    }
    walk(main)
    return out
  })
  expect(commentNodes).toEqual([])
})

test('{#await p then v} shorthand settles', async ({ page }) => {
  await page.goto('/await-then-lab')
  await expect(page.locator('[data-await-then-short]')).toHaveText('ready')
})

test('disabled={…} toggles as a real boolean', async ({ page }) => {
  await page.goto('/boolean-attr-lab')
  const btn = page.locator('[data-bool-target]')
  await expect(btn).toBeDisabled()
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(btn).toBeEnabled()
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(btn).toBeDisabled()
})

test('select bind:value syncs on change', async ({ page }) => {
  await page.goto('/select-bind-lab')
  await expect(page.locator('[data-select-value]')).toHaveText('b')
  await expect(page.locator('[data-select]')).toHaveValue('b')
  await page.locator('[data-select]').selectOption('c')
  await expect(page.locator('[data-select-value]')).toHaveText('c')
})

test('number/range bind:value stays numeric', async ({ page }) => {
  await page.goto('/number-bind-lab')
  await expect(page.locator('[data-num-val]')).toHaveText('3')
  await expect(page.locator('[data-num-type]')).toHaveText('number')
  await page.locator('[data-num]').fill('7')
  await expect(page.locator('[data-num-val]')).toHaveText('7')
  await expect(page.locator('[data-num-type]')).toHaveText('number')
  await page.getByRole('button', { name: 'Bump' }).click()
  await expect(page.locator('[data-num-val]')).toHaveText('8')
  await expect(page.locator('[data-range-type]')).toHaveText('number')
  await page.locator('[data-range]').fill('9')
  await expect(page.locator('[data-range-val]')).toHaveText('9')
  await expect(page.locator('[data-range-type]')).toHaveText('number')
})

test('multi-select bind:value syncs a string array', async ({ page }) => {
  await page.goto('/multi-select-bind-lab')
  await expect(page.locator('[data-multi-value]')).toHaveText('b,c')
  await page.locator('[data-multi]').selectOption(['a', 'b'])
  await expect(page.locator('[data-multi-value]')).toHaveText('a,b')
  await page.getByRole('button', { name: 'All' }).click()
  await expect(page.locator('[data-multi-value]')).toHaveText('a,b,c')
  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page.locator('[data-multi-value]')).toHaveText('')
})

test('transition:fade outro removes the node after fade', async ({ page }) => {
  await page.goto('/fade-outro-lab')
  await expect(page.locator('[data-fade-outro]')).toHaveText('Hello')
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(page.locator('[data-fade-outro]')).toHaveCount(0, { timeout: 5_000 })
})

test('reduced motion forces transition duration to zero', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/reduced-motion-transition-lab')
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(page.locator('[data-rm-fade]')).toHaveText('Hello', { timeout: 500 })
  await expect(page.locator('[data-rm-fade]')).toHaveCSS('opacity', '1')
})

test('keyed each fade outro removes dropped items', async ({ page }) => {
  await page.goto('/keyed-outro-lab')
  await expect(page.locator('[data-item-id]')).toHaveCount(2)
  await page.getByRole('button', { name: 'Drop' }).click()
  await expect(page.locator('[data-item-id="1"]')).toHaveCount(1)
  await expect(page.locator('[data-item-id="2"]')).toHaveCount(0, { timeout: 5_000 })
})

test('transition:fly reaches rest transform', async ({ page }) => {
  await page.goto('/fly-lab')
  const target = page.locator('[data-fly-target]')
  await expect(target).toHaveText('Lifted in')
  await expect
    .poll(async () => target.evaluate((el) => getComputedStyle(el).opacity))
    .toBe('1')
  await expect
    .poll(async () => {
      const t = await target.evaluate((el) => getComputedStyle(el).transform)
      return t === 'none' || t.includes('matrix(1, 0, 0, 1, 0, 0)')
    })
    .toBe(true)
})

test('in:fade intro and out:fade outro', async ({ page }) => {
  await page.goto('/in-out-lab')
  const inOnly = page.locator('[data-in-only]')
  const outOnly = page.locator('[data-out-only]')
  await expect(inOnly).toHaveText('In only')
  await expect
    .poll(async () => inOnly.evaluate((el) => getComputedStyle(el).opacity))
    .toBe('1')
  await expect(outOnly).toHaveText('Out only')
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(outOnly).toHaveCount(0, { timeout: 5_000 })
  await expect(inOnly).toHaveCount(0, { timeout: 5_000 })
})

test('transition:slide intro then outro remove', async ({ page }) => {
  await page.goto('/slide-lab')
  const target = page.locator('[data-slide-target]')
  await expect(target).toHaveText('Slides in')
  await expect
    .poll(async () => target.evaluate((el) => getComputedStyle(el).opacity))
    .toBe('1')
  await expect
    .poll(async () =>
      target.evaluate((el) => {
        const h = getComputedStyle(el).height
        return h !== '0px' && h !== ''
      }),
    )
    .toBe(true)
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveCount(0, { timeout: 5_000 })
})

test('transition:slideX intro then outro remove', async ({ page }) => {
  await page.goto('/slidex-lab')
  const target = page.locator('[data-slidex-target]')
  await expect(target).toHaveText('Slides sideways')
  await expect
    .poll(async () => target.evaluate((el) => getComputedStyle(el).opacity))
    .toBe('1')
  await expect
    .poll(async () =>
      target.evaluate((el) => {
        const w = getComputedStyle(el).width
        return w !== '0px' && w !== ''
      }),
    )
    .toBe(true)
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveCount(0, { timeout: 5_000 })
})

test('transition:scale reaches rest transform', async ({ page }) => {
  await page.goto('/scale-lab')
  const target = page.locator('[data-scale-target]')
  await expect(target).toHaveText('Scaled in')
  await expect
    .poll(async () => target.evaluate((el) => getComputedStyle(el).opacity))
    .toBe('1')
  await expect
    .poll(async () => {
      const t = await target.evaluate((el) => getComputedStyle(el).transform)
      return t === 'none' || t.includes('matrix(1, 0, 0, 1, 0, 0)')
    })
    .toBe(true)
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveCount(0, { timeout: 5_000 })
})

test('transition:spin reaches rest transform', async ({ page }) => {
  await page.goto('/spin-lab')
  const target = page.locator('[data-spin-target]')
  await expect(target).toHaveText('Spun in')
  await expect
    .poll(async () => target.evaluate((el) => getComputedStyle(el).opacity))
    .toBe('1')
  await expect
    .poll(async () => {
      const t = await target.evaluate((el) => getComputedStyle(el).transform)
      return t === 'none' || t.includes('matrix(1, 0, 0, 1, 0, 0)')
    })
    .toBe(true)
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveCount(0, { timeout: 5_000 })
})

test('transition:pop reaches rest transform', async ({ page }) => {
  await page.goto('/pop-lab')
  const target = page.locator('[data-pop-target]')
  await expect(target).toHaveText('Popped in')
  await expect
    .poll(async () => target.evaluate((el) => getComputedStyle(el).opacity))
    .toBe('1')
  await expect
    .poll(async () => {
      const t = await target.evaluate((el) => getComputedStyle(el).transform)
      return t === 'none' || t.includes('matrix(1, 0, 0, 1, 0, 0)')
    })
    .toBe(true)
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveCount(0, { timeout: 5_000 })
})

test('transition:bounce reaches rest transform', async ({ page }) => {
  await page.goto('/bounce-lab')
  const target = page.locator('[data-bounce-target]')
  await expect(target).toHaveText('Bounced in')
  await expect
    .poll(async () => target.evaluate((el) => getComputedStyle(el).opacity))
    .toBe('1')
  await expect
    .poll(async () => {
      const t = await target.evaluate((el) => getComputedStyle(el).transform)
      return t === 'none' || t.includes('matrix(1, 0, 0, 1, 0, 0)')
    })
    .toBe(true)
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveCount(0, { timeout: 5_000 })
})

test('transition:drop reaches rest transform', async ({ page }) => {
  await page.goto('/drop-lab')
  const target = page.locator('[data-drop-target]')
  await expect(target).toHaveText('Dropped in')
  await expect
    .poll(async () => target.evaluate((el) => getComputedStyle(el).opacity))
    .toBe('1')
  await expect
    .poll(async () => {
      const t = await target.evaluate((el) => getComputedStyle(el).transform)
      return t === 'none' || t.includes('matrix(1, 0, 0, 1, 0, 0)')
    })
    .toBe(true)
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveCount(0, { timeout: 5_000 })
})

test('transition:shake reaches rest transform', async ({ page }) => {
  await page.goto('/shake-lab')
  const target = page.locator('[data-shake-target]')
  await expect(target).toHaveText('Shaken in')
  await expect
    .poll(async () => target.evaluate((el) => getComputedStyle(el).opacity))
    .toBe('1')
  await expect
    .poll(async () => {
      const t = await target.evaluate((el) => getComputedStyle(el).transform)
      return t === 'none' || t.includes('matrix(1, 0, 0, 1, 0, 0)')
    })
    .toBe(true)
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveCount(0, { timeout: 5_000 })
})

test('transition:flip reaches rest transform', async ({ page }) => {
  await page.goto('/flip-lab')
  const target = page.locator('[data-flip-target]')
  await expect(target).toHaveText('Flipped in')
  await expect
    .poll(async () => target.evaluate((el) => getComputedStyle(el).opacity))
    .toBe('1')
  await expect
    .poll(async () => {
      const t = await target.evaluate((el) => getComputedStyle(el).transform)
      // perspective(N) rotateY(0) → matrix3d identity with a small m[11] ≈ -1/N
      return (
        t === 'none' ||
        t.startsWith('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1')
      )
    })
    .toBe(true)
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveCount(0, { timeout: 5_000 })
})

test('transition:pulse reaches rest transform', async ({ page }) => {
  await page.goto('/pulse-lab')
  const target = page.locator('[data-pulse-target]')
  await expect(target).toHaveText('Pulsed in')
  await expect
    .poll(async () => target.evaluate((el) => getComputedStyle(el).opacity))
    .toBe('1')
  await expect
    .poll(async () => {
      const t = await target.evaluate((el) => getComputedStyle(el).transform)
      return t === 'none' || t.includes('matrix(1, 0, 0, 1, 0, 0)')
    })
    .toBe(true)
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveCount(0, { timeout: 5_000 })
})

test('transition:wipe reaches rest clip-path', async ({ page }) => {
  await page.goto('/wipe-lab')
  const target = page.locator('[data-wipe-target]')
  await expect(target).toHaveText('Wiped in')
  await expect
    .poll(async () => {
      const c = await target.evaluate((el) => getComputedStyle(el).clipPath)
      return c === 'none' || c.includes('inset(0px') || c.includes('inset(0 ')
    })
    .toBe(true)
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveCount(0, { timeout: 5_000 })
})

test('transition:skew reaches rest transform', async ({ page }) => {
  await page.goto('/skew-lab')
  const target = page.locator('[data-skew-target]')
  await expect(target).toHaveText('Skewed in')
  await expect
    .poll(async () => target.evaluate((el) => getComputedStyle(el).opacity))
    .toBe('1')
  await expect
    .poll(async () => {
      const t = await target.evaluate((el) => getComputedStyle(el).transform)
      return t === 'none' || t.includes('matrix(1, 0, 0, 1, 0, 0)')
    })
    .toBe(true)
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveCount(0, { timeout: 5_000 })
})

test('transition:roll reaches rest transform', async ({ page }) => {
  await page.goto('/roll-lab')
  const target = page.locator('[data-roll-target]')
  await expect(target).toHaveText('Rolled in')
  await expect
    .poll(async () => target.evaluate((el) => getComputedStyle(el).opacity))
    .toBe('1')
  await expect
    .poll(async () => {
      const t = await target.evaluate((el) => getComputedStyle(el).transform)
      return (
        t === 'none' ||
        t.startsWith('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1')
      )
    })
    .toBe(true)
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveCount(0, { timeout: 5_000 })
})

test('transition:zoom reaches rest transform', async ({ page }) => {
  await page.goto('/zoom-lab')
  const target = page.locator('[data-zoom-target]')
  await expect(target).toHaveText('Zoomed in')
  await expect
    .poll(async () => target.evaluate((el) => getComputedStyle(el).opacity))
    .toBe('1')
  await expect
    .poll(async () => {
      const t = await target.evaluate((el) => getComputedStyle(el).transform)
      return t === 'none' || t.includes('matrix(1, 0, 0, 1, 0, 0)')
    })
    .toBe(true)
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveCount(0, { timeout: 5_000 })
})

test('transition:blur reaches rest filter', async ({ page }) => {
  await page.goto('/blur-lab')
  const target = page.locator('[data-blur-target]')
  await expect(target).toHaveText('Blurred in')
  await expect
    .poll(async () => target.evaluate((el) => getComputedStyle(el).opacity))
    .toBe('1')
  await expect
    .poll(async () => {
      const f = await target.evaluate((el) => getComputedStyle(el).filter)
      return f === 'none' || f.includes('blur(0px)')
    })
    .toBe(true)
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveCount(0, { timeout: 5_000 })
})

test('transition:draw reaches zero dashoffset then outro', async ({ page }) => {
  await page.goto('/draw-lab')
  const target = page.locator('[data-draw-target]')
  await expect(target).toHaveCount(1)
  await expect
    .poll(async () =>
      target.evaluate((el) => {
        const path = el as SVGPathElement
        return path.namespaceURI === 'http://www.w3.org/2000/svg' && path.getTotalLength() > 0
      }),
    )
    .toBe(true)
  await expect
    .poll(async () => target.evaluate((el) => (el as SVGPathElement).style.strokeDashoffset))
    .toBe('0')
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect(target).toHaveCount(0, { timeout: 5_000 })
})

test('spread attributes apply and update', async ({ page }) => {
  await page.goto('/spread-lab')
  const target = page.locator('[data-spread]')
  await expect(target).toHaveText('Spread target')
  await expect(target).toHaveAttribute('data-spread', 'a')
  await expect(target).toHaveAttribute('title', 'hello')
  await page.getByRole('button', { name: 'Bump' }).click()
  await expect(target).toHaveAttribute('data-spread', 'b')
  await expect(target).toHaveAttribute('title', 'world')
})

test('component {...props} spread applies and updates', async ({ page }) => {
  await page.goto('/comp-spread-lab')
  const target = page.locator('[data-comp-spread]')
  await expect(target).toHaveText('alpha')
  await expect(target).toHaveAttribute('data-tone', 'ok')
  await page.getByRole('button', { name: 'Bump' }).click()
  await expect(target).toHaveText('beta')
  await expect(target).toHaveAttribute('data-tone', 'warn')
})

test('bind:files updates from file input', async ({ page }) => {
  await page.goto('/files-bind-lab')
  await expect(page.locator('[data-file-name]')).toHaveText('(none)')
  await page.locator('[data-file-input]').setInputFiles({
    name: 'hello.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hi'),
  })
  await expect(page.locator('[data-file-name]')).toHaveText('hello.txt')
})

test('bind:clientWidth reports element width', async ({ page }) => {
  await page.goto('/dimension-bind-lab')
  await expect
    .poll(async () => page.locator('[data-dim-width]').textContent())
    .toBe('200')
})

test('bind:scrollTop jumps and reports scroll', async ({ page }) => {
  await page.goto('/scroll-bind-lab')
  await expect(page.locator('[data-scroll-top]')).toHaveText('0')
  await page.getByRole('button', { name: 'Jump' }).click()
  await expect
    .poll(async () => page.locator('[data-scroll-top]').textContent())
    .toBe('80')
  await expect
    .poll(async () =>
      page.locator('[data-scroll-box]').evaluate((el) => (el as HTMLElement).scrollTop),
    )
    .toBe(80)
})

test('bind:selectionStart/End sets caret range', async ({ page }) => {
  await page.goto('/selection-bind-lab')
  await expect(page.locator('[data-sel-start]')).toHaveText('0')
  await expect(page.locator('[data-sel-end]')).toHaveText('0')
  await page.getByRole('button', { name: 'Select word' }).click()
  await expect(page.locator('[data-sel-start]')).toHaveText('6')
  await expect(page.locator('[data-sel-end]')).toHaveText('11')
  await expect
    .poll(async () =>
      page.locator('[data-sel]').evaluate((el) => {
        const input = el as HTMLInputElement
        return `${input.selectionStart}:${input.selectionEnd}`
      }),
    )
    .toBe('6:11')
})

test('bind:indeterminate toggles the checkbox property', async ({ page }) => {
  await page.goto('/indeterminate-bind-lab')
  const box = page.locator('[data-indeterminate]')
  await expect
    .poll(async () => box.evaluate((el) => (el as HTMLInputElement).indeterminate))
    .toBe(true)
  await page.getByRole('button', { name: 'Toggle' }).click()
  await expect
    .poll(async () => box.evaluate((el) => (el as HTMLInputElement).indeterminate))
    .toBe(false)
  await expect(page.locator('[data-indeterminate-flag]')).toHaveText('no')
})

test('bind:open syncs details open state', async ({ page }) => {
  await page.goto('/open-bind-lab')
  const details = page.locator('[data-open-details]')
  await expect(page.locator('[data-open-flag]')).toHaveText('no')
  await expect
    .poll(async () => details.evaluate((el) => (el as HTMLDetailsElement).open))
    .toBe(false)
  await page.getByRole('button', { name: 'Open' }).click()
  await expect(page.locator('[data-open-flag]')).toHaveText('yes')
  await expect
    .poll(async () => details.evaluate((el) => (el as HTMLDetailsElement).open))
    .toBe(true)
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.locator('[data-open-flag]')).toHaveText('no')
  await expect
    .poll(async () => details.evaluate((el) => (el as HTMLDetailsElement).open))
    .toBe(false)
})

test('bind:muted toggles the media muted property', async ({ page }) => {
  await page.goto('/media-bind-lab')
  const media = page.locator('[data-media]')
  await expect(page.locator('[data-muted-flag]')).toHaveText('no')
  await expect
    .poll(async () => media.evaluate((el) => (el as HTMLMediaElement).muted))
    .toBe(false)
  await page.getByRole('button', { name: 'Toggle mute' }).click()
  await expect(page.locator('[data-muted-flag]')).toHaveText('yes')
  await expect
    .poll(async () => media.evaluate((el) => (el as HTMLMediaElement).muted))
    .toBe(true)
})

test('bind:ended and bind:seeking track media events', async ({ page }) => {
  await page.goto('/media-ended-lab')
  const media = page.locator('[data-media-ended]')
  await expect(page.locator('[data-ended-flag]')).toHaveText('no')
  await expect(page.locator('[data-seeking-flag]')).toHaveText('no')
  await media.evaluate((el) => {
    el.dispatchEvent(new Event('ended'))
  })
  await expect(page.locator('[data-ended-flag]')).toHaveText('yes')
  await media.evaluate((el) => {
    el.dispatchEvent(new Event('seeking'))
  })
  await expect(page.locator('[data-seeking-flag]')).toHaveText('yes')
  await media.evaluate((el) => {
    el.dispatchEvent(new Event('seeked'))
  })
  await expect(page.locator('[data-seeking-flag]')).toHaveText('no')
})

test('bind:played and bind:buffered track media TimeRanges', async ({ page }) => {
  await page.goto('/media-played-lab')
  const media = page.locator('[data-media-played]')
  await expect(page.locator('[data-played-end]')).toHaveText('0')
  await expect(page.locator('[data-buffered-end]')).toHaveText('0')
  await media.evaluate((el) => {
    Object.defineProperty(el, 'played', {
      configurable: true,
      get: () => ({ length: 1, end: (i: number) => (i === 0 ? 12.5 : 0) }),
    })
    el.dispatchEvent(new Event('timeupdate'))
  })
  await expect(page.locator('[data-played-end]')).toHaveText('12.5')
  await media.evaluate((el) => {
    Object.defineProperty(el, 'buffered', {
      configurable: true,
      get: () => ({ length: 1, end: (i: number) => (i === 0 ? 30 : 0) }),
    })
    el.dispatchEvent(new Event('progress'))
  })
  await expect(page.locator('[data-buffered-end]')).toHaveText('30')
})

test('bind:seekable tracks media TimeRanges', async ({ page }) => {
  await page.goto('/media-seekable-lab')
  const media = page.locator('[data-media-seekable]')
  await expect(page.locator('[data-seekable-end]')).toHaveText('0')
  await media.evaluate((el) => {
    Object.defineProperty(el, 'seekable', {
      configurable: true,
      get: () => ({ length: 1, end: (i: number) => (i === 0 ? 45 : 0) }),
    })
    el.dispatchEvent(new Event('durationchange'))
  })
  await expect(page.locator('[data-seekable-end]')).toHaveText('45')
})

test('bind:readyState tracks media readyState', async ({ page }) => {
  await page.goto('/media-ready-state-lab')
  const media = page.locator('[data-media-ready]')
  await media.evaluate((el) => {
    Object.defineProperty(el, 'readyState', { configurable: true, get: () => 4 })
    el.dispatchEvent(new Event('canplaythrough'))
  })
  await expect(page.locator('[data-ready-state]')).toHaveText('4')
})

test('bind:networkState tracks media networkState', async ({ page }) => {
  await page.goto('/media-network-state-lab')
  const media = page.locator('[data-media-network]')
  await media.evaluate((el) => {
    Object.defineProperty(el, 'networkState', { configurable: true, get: () => 2 })
    el.dispatchEvent(new Event('progress'))
  })
  await expect(page.locator('[data-network-state]')).toHaveText('2')
})

test('bind:videoWidth and bind:videoHeight track video metrics', async ({ page }) => {
  await page.goto('/media-video-size-lab')
  const media = page.locator('[data-media-video]')
  await media.evaluate((el) => {
    Object.defineProperty(el, 'videoWidth', { configurable: true, get: () => 1280 })
    Object.defineProperty(el, 'videoHeight', { configurable: true, get: () => 720 })
    el.dispatchEvent(new Event('loadedmetadata'))
  })
  await expect(page.locator('[data-video-w]')).toHaveText('1280')
  await expect(page.locator('[data-video-h]')).toHaveText('720')
})

test('bind:naturalWidth and bind:naturalHeight track image metrics', async ({ page }) => {
  await page.goto('/image-natural-size-lab')
  const img = page.locator('[data-img-natural]')
  await img.evaluate((el) => {
    Object.defineProperty(el, 'naturalWidth', { configurable: true, get: () => 320 })
    Object.defineProperty(el, 'naturalHeight', { configurable: true, get: () => 200 })
    el.dispatchEvent(new Event('load'))
  })
  await expect(page.locator('[data-nat-w]')).toHaveText('320')
  await expect(page.locator('[data-nat-h]')).toHaveText('200')
})

test('bind:volume updates the media volume property', async ({ page }) => {
  await page.goto('/media-bind-lab')
  const media = page.locator('[data-media]')
  await expect
    .poll(async () => media.evaluate((el) => (el as HTMLMediaElement).volume))
    .toBeCloseTo(0.4, 1)
  await page.getByRole('button', { name: 'Louder' }).click()
  await expect
    .poll(async () => media.evaluate((el) => (el as HTMLMediaElement).volume))
    .toBeCloseTo(0.9, 1)
  await expect(page.locator('[data-volume]')).toHaveText('0.9')
})

test('bind:playbackRate updates the media rate', async ({ page }) => {
  await page.goto('/media-bind-lab')
  const media = page.locator('[data-media]')
  await expect
    .poll(async () => media.evaluate((el) => (el as HTMLMediaElement).playbackRate))
    .toBe(1)
  await page.getByRole('button', { name: 'Faster' }).click()
  await expect
    .poll(async () => media.evaluate((el) => (el as HTMLMediaElement).playbackRate))
    .toBe(1.5)
  await expect(page.locator('[data-rate]')).toHaveText('1.5')
})

test('bind:textContent syncs contenteditable', async ({ page }) => {
  await page.goto('/textcontent-bind-lab')
  const editable = page.locator('[data-editable]')
  await expect(page.locator('[data-text]')).toHaveText('hello')
  await expect(editable).toHaveText('hello')
  await page.getByRole('button', { name: 'Shout' }).click()
  await expect(page.locator('[data-text]')).toHaveText('HELLO')
  await expect(editable).toHaveText('HELLO')
  await editable.click()
  await page.keyboard.type('!')
  await expect
    .poll(async () => page.locator('[data-text]').textContent())
    .toBe('HELLO!')
})

test('bind:innerText syncs contenteditable', async ({ page }) => {
  await page.goto('/innertext-bind-lab')
  const editable = page.locator('[data-editable]')
  await expect(page.locator('[data-text]')).toHaveText('hello')
  await expect(editable).toHaveText('hello')
  await page.getByRole('button', { name: 'Shout' }).click()
  await expect(page.locator('[data-text]')).toHaveText('HELLO')
  await expect(editable).toHaveText('HELLO')
  await editable.click()
  await page.keyboard.type('!')
  await expect
    .poll(async () => page.locator('[data-text]').textContent())
    .toBe('HELLO!')
})

test('claim hydrate preserves SSR node identity for focus, media, slots, {@html}', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as { __avedonClaimSnap?: Record<string, Element | null> }).__avedonClaimSnap =
      undefined
    const mark = () => {
      const w = window as unknown as { __avedonClaimSnap?: Record<string, Element | null> }
      if (w.__avedonClaimSnap) return
      const input = document.querySelector('[data-focus-target]')
      if (!input) return
      w.__avedonClaimSnap = {
        input,
        media: document.querySelector('[data-media-target]'),
        slotBtn: document.querySelector('[data-slot-btn]'),
        html: document.querySelector('[data-html-island]'),
      }
    }
    const obs = new MutationObserver(mark)
    obs.observe(document.documentElement, { childList: true, subtree: true })
    document.addEventListener('DOMContentLoaded', mark)
  })

  await page.goto('/claim-identity-lab')
  await expect(page.locator('[data-claim-identity-lab]')).toBeVisible()
  await expect(page.locator('[data-html-island]')).toHaveText('trusted')
  await expect(page.locator('[data-slot-header]')).toHaveText('Header')
  await page.locator('[data-inc]').click()
  await expect(page.locator('[data-likes]')).toHaveText('Likes: 1')

  const identity = await page.evaluate(() => {
    const w = window as unknown as { __avedonClaimSnap?: Record<string, Element | null> }
    const snap = w.__avedonClaimSnap
    if (!snap) return { ok: false, reason: 'no-snap' }
    return {
      ok: true,
      input: snap.input === document.querySelector('[data-focus-target]'),
      media: snap.media === document.querySelector('[data-media-target]'),
      slotBtn: snap.slotBtn === document.querySelector('[data-slot-btn]'),
      html: snap.html === document.querySelector('[data-html-island]'),
    }
  })
  expect(identity).toEqual({
    ok: true,
    input: true,
    media: true,
    slotBtn: true,
    html: true,
  })
})
