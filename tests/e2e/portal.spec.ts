import { expect, test } from 'playwright/test'

const portalRoutes = [
  ['/employee-portal', /Good (morning|afternoon)/],
  ['/employee-portal/leads', 'Lead pipeline'],
  ['/employee-portal/leads/new', 'Create a lead'],
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
  await expect(page.locator('a[href="tel:6822187221"]').first()).toContainText('(682) 218-7221')
  await expect(page.getByText('© 2026 cojovi.com. All rights reserved.')).toBeVisible()

  await page.getByLabel('Full name').fill('Testing Lead')
  await page.getByLabel('Phone').fill('one')
  await page.getByLabel('Email').fill('testing@example.com')
  await page.getByLabel('Project type').selectOption({ label: 'Workforce housing' })
  await page.getByLabel('Project location').fill('Haslet, TX')
  await page.getByLabel('Ideal timing').selectOption({ label: '1–3 months' })
  await page.getByRole('button', { name: 'Start My Project' }).click()
  await expect(page.getByText('Enter a phone number with at least 7 digits.')).toBeVisible()
  await expect(page.getByText('Please correct the highlighted fields, then submit again.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start My Project' })).toBeEnabled()
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
  const redirectUrl = new URL(authorizeUrl.searchParams.get('redirect_to') ?? '')
  expect(redirectUrl.origin + redirectUrl.pathname).toBe('http://127.0.0.1:4174/auth/callback')
  expect(redirectUrl.searchParams.get('sb_flow_id')).toMatch(/^[a-f0-9]{32}$/)
})

test('an OAuth response sent to the site root is recovered by the callback route', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174/?error=access_denied&error_description=Workspace+access+denied')

  await expect(page).toHaveURL(/\/auth\/callback\?error=access_denied/)
  await expect(page.getByRole('heading', { name: 'Sign-in could not be completed' })).toBeVisible()
  await expect(page.getByText('Google could not complete sign-in. Please try again with an authorized CMAC account.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Container Homes', level: 1 })).toHaveCount(0)
})

test('a missing PKCE verifier automatically starts one fresh bounded sign-in', async ({ page }) => {
  await page.route('https://*/auth/v1/settings', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ external: { google: true } }),
  }))
  await page.route('https://*/auth/v1/authorize**', (route) => route.abort())
  const requestPromise = page.waitForRequest((request) => request.url().includes('/auth/v1/authorize'))

  await page.goto('http://127.0.0.1:4174/auth/callback?code=expired-code&sb_flow_id=0123456789abcdef0123456789abcdef')

  const authorizeRequest = await requestPromise
  expect(new URL(authorizeRequest.url()).searchParams.get('provider')).toBe('google')
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
  await expect(page.getByRole('link', { name: 'Add lead' })).toBeVisible()

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

test('manual lead intake and admin lead controls are fully rendered', async ({ page }) => {
  await page.goto('/employee-portal/leads/new')
  await expect(page.getByRole('heading', { name: 'Create a lead' })).toBeVisible()
  await page.getByLabel('First name *').fill('Morgan')
  await page.getByLabel('Last name').fill('Sample')
  await page.getByLabel('Email *').fill('morgan.sample@example.com')
  await page.getByLabel('Phone *').fill('(817) 555-0199')
  await page.getByLabel('Lead source *').selectOption('referral')
  await page.getByLabel('Project type *').selectOption({ label: 'Container home' })
  await page.getByLabel('Ideal timing *').selectOption({ label: '3–6 months' })
  await page.getByLabel('Project location *').fill('Fort Worth, TX')
  await page.getByRole('button', { name: 'Create lead' }).click()
  await expect(page.getByText('Local preview only — the form is valid, but no lead was written to the CRM.')).toBeVisible()

  await page.goto('/employee-portal/leads/preview-lead-2')
  await expect(page.getByRole('heading', { name: 'Avery Brooks' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Edit, assign, and qualify' })).toBeVisible()
  await expect(page.getByLabel('Pipeline status *')).toHaveValue('new')
  await page.getByLabel('Pipeline status *').selectOption('contacted')
  await page.getByRole('button', { name: 'Save lead' }).click()
  await expect(page.getByText('Local preview only — the edit form is valid, but no CRM record was changed.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Convert to deal' })).toBeVisible()
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
