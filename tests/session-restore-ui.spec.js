import { test, expect } from '@playwright/test'

const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:4176'

test('stale admin profile returns to login before dashboard access', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('punjab-session-user', JSON.stringify({
      id: 'adm-dev-test', role: 'admin', username: 'system.developer',
      email: 'info@kavotech.uk', displayName: 'System Developer',
      isSuperAdmin: true, isSystemDeveloper: true,
    }))
    localStorage.setItem('punjab-cookie-consent', JSON.stringify({ necessary: true }))
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) localStorage.removeItem(key)
    }
  })
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Admin', exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.topbar-title')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('punjab-session-user'))).toBeNull()
})
