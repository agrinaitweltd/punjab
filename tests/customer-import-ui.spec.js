import { test, expect } from '@playwright/test'

const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:4174'

for (const scenario of [
  { name: 'system developer desktop', width: 1440, height: 900, superAdmin: true, systemDeveloper: true },
  { name: 'delegated admin mobile', width: 390, height: 844, superAdmin: false, systemDeveloper: false },
]) {
  test(`${scenario.name} can open number-free credit note import`, async ({ page }) => {
    const user = {
      id: `import-${scenario.name}`, role: 'admin', username: 'admin', email: 'admin@example.test', displayName: 'Admin',
      isSuperAdmin: scenario.superAdmin, isSystemDeveloper: scenario.systemDeveloper,
      permissions: { customersCreate: true },
    }
    const session = {
      access_token: 'ui-test-token', refresh_token: 'ui-test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800,
      user: { id: user.id, email: user.email, app_metadata: { role: 'admin' }, user_metadata: {}, aud: 'authenticated', role: 'authenticated' },
    }
    await page.setViewportSize({ width: scenario.width, height: scenario.height })
    await page.addInitScript(({ user, session }) => {
      localStorage.setItem('punjab-session-user', JSON.stringify(user))
      localStorage.setItem('punjab-cookie-consent', JSON.stringify({ necessary: true }))
      localStorage.setItem('sb-vqnnlorukpzsftfisjrm-auth-token', JSON.stringify(session))
    }, { user, session })
    await page.route('**/rest/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]', headers: { 'content-range': '0-0/0' } }))
    await page.route('**/api/admin-security?action=system-mode', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ testMode: false, changedAt: null }) }))
    await page.goto(origin, { waitUntil: 'domcontentloaded' })
    if (scenario.width < 600) await page.getByRole('button', { name: 'Open menu' }).click()
    await page.locator('.pn-parent').filter({ hasText: 'Customers' }).click()
    await page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: 'Add Customer', exact: true }).click()
    await page.getByRole('button', { name: 'Credit Note', exact: true }).click()
    await expect(page.getByText('Upload Credit Note', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Credit Note Number')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  })
}
