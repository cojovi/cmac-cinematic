import { expect, test } from 'playwright/test'

const portalRoutes = [
  ['/employee-portal', /Good (morning|afternoon)/],
  ['/employee-portal/leads', 'Lead pipeline'],
  ['/employee-portal/customers', 'Contacts & customers'],
  ['/employee-portal/tasks', 'Follow-up queue'],
  ['/employee-portal/inventory', 'Availability & model selection'],
  ['/employee-portal/marketing', 'Send from your CMAC Gmail'],
  ['/employee-portal/sales/new', 'Build a clean, verifiable sale'],
  ['/employee-portal/deals', 'Deal workspace'],
  ['/employee-portal/quotes', 'Quote records'],
  ['/employee-portal/contracts', 'Contract tracking'],
  ['/employee-portal/documents', 'Transaction template register'],
  ['/employee-portal/admin/employees', 'Employee access'],
  ['/employee-portal/admin/marketing', 'Approved material library'],
] as const

test('public landing and lead form render without overflow', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174/')

  await expect(page).toHaveTitle('CMAC Container Homes | Texas-Built Modular Living')
  await expect(page.getByRole('heading', { name: 'Container Homes', level: 1 })).toBeVisible()
  await expect(page.getByLabel('Full name')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('production login is Google-only and requests the correct callback', async ({ page }) => {
  await page.route('https://*/auth/v1/settings', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ external: { google: true } }),
  }))
  await page.goto('http://127.0.0.1:4174/login')

  const googleButton = page.getByRole('button', { name: 'Continue with Google' })
  await expect(googleButton).toBeVisible()
  await expect(googleButton).toBeEnabled()
  await expect(page.locator('input[type="password"]')).toHaveCount(0)

  await page.route('https://*/auth/v1/authorize**', (route) => route.abort())
  const requestPromise = page.waitForRequest((request) => request.url().includes('/auth/v1/authorize'))
  await googleButton.click()
  const authorizeRequest = await requestPromise
  const authorizeUrl = new URL(authorizeRequest.url())
  expect(authorizeUrl.searchParams.get('provider')).toBe('google')
  expect(authorizeUrl.searchParams.get('redirect_to')).toBe('http://127.0.0.1:4174/auth/callback')
})

test('disabled Google provider is contained in the login UI', async ({ page }) => {
  await page.route('https://*/auth/v1/settings', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ external: { google: false } }),
  }))
  await page.goto('http://127.0.0.1:4174/login')

  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeDisabled()
  await expect(page.getByText('Google Workspace sign-in is not enabled in Supabase yet.')).toBeVisible()
})

test('direct employee routes refresh and interactive navigation works', async ({ page }, testInfo) => {
  await page.goto('/employee-portal/leads')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Lead pipeline' })).toBeVisible()

  const search = page.getByPlaceholder('Search leads')
  await search.fill('Avery')
  await expect(page.locator('.resource-row')).toHaveCount(1)
  await expect(page.getByText('Avery Brooks')).toBeVisible()

  if ((testInfo.project.use.viewport?.width ?? 1440) <= 760) {
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await page.getByRole('link', { name: 'Inventory', exact: true }).click()
  } else {
    await page.getByRole('link', { name: 'Inventory', exact: true }).click()
  }

  await expect(page).toHaveURL(/\/employee-portal\/inventory$/)
  await expect(page.getByText('Inventory unavailable')).toBeVisible()
  await expect(page.getByText('MODEL REFERENCE / MOCK').first()).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('every employee portal destination renders without horizontal overflow', async ({ page }) => {
  for (const [route, heading] of portalRoutes) {
    await page.goto(route)
    await expect(page.getByRole('heading', { name: heading, level: 2 })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  }
})

test('the site is dark-only and exposes no theme control', async ({ page }) => {
  await page.goto('/employee-portal')

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', { name: /Switch to (light|dark) mode/ })).toHaveCount(0)
})

test('DocuSign surfaces an explicit coming-soon state', async ({ page }) => {
  await page.goto('/employee-portal/contracts')

  await expect(page.getByRole('heading', { name: 'Contract tracking' })).toBeVisible()
  await expect(page.getByText('DocuSign contract delivery is paused for this release')).toBeVisible()
  await expect(page.getByText('Deferred', { exact: true })).toBeVisible()
})
