import { test, expect } from '@playwright/test'

const origin = process.env.PRODUCTION_ORIGIN
const password = process.env.DEVELOPER_TEST_PASSWORD

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`${viewport.name} admin dashboard`, async ({ page }) => {
    test.setTimeout(60_000)
    test.skip(!origin || !password, 'Production UI environment is required')
    await page.setViewportSize(viewport)
    await page.goto(origin, { waitUntil: 'domcontentloaded' })
    const consent = page.getByRole('dialog', { name: 'Cookie consent' })
    if (await consent.isVisible()) await consent.getByRole('button', { name: 'Decline all' }).click()
    await page.getByRole('button', { name: 'Admin', exact: true }).click()
    await page.getByPlaceholder('you@punjabexoticfoods.com').fill('info@kavotech.uk')
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: /Log in/i }).click()
    await expect(page.locator('.topbar-title')).toHaveText('Overview', { timeout: 45_000 })
    const outstanding = page.locator('.ho-stat').filter({ hasText: 'Outstanding Payments' })
    await expect(outstanding.locator('.ho-stat-value')).toHaveText('£0.00', { timeout: 20_000 })
    await expect(outstanding).toContainText('0 invoices')

    const sidebarParent = name => page.locator('.pn-parent').filter({ hasText: name })
    if (viewport.name === 'desktop') {
      await sidebarParent('Customers').click()
      await expect(page.getByRole('button', { name: 'Add Customer', exact: true })).toBeVisible()
      await sidebarParent('Payments').click()
      await expect(page.getByRole('button', { name: 'Add Customer', exact: true })).toHaveCount(0)
      await page.getByRole('button', { name: 'Expenses', exact: true }).click()
      await expect(page.locator('.topbar-title')).toHaveText('Expenses')
      await page.getByRole('button', { name: 'Collapse navigation' }).click()
      await expect(page.locator('.pn-panel')).toHaveCSS('width', '0px')
      await page.locator('.pn-rail-button[aria-label="Customers"]').click()
      await expect(page.getByRole('button', { name: 'All Customers', exact: true })).toBeVisible()
      await page.locator('.pn-parent').filter({ hasText: 'Dashboard' }).click()
    } else {
      await page.getByRole('button', { name: 'Open menu' }).click()
      await sidebarParent('Invoices').click()
      await expect(page.getByRole('button', { name: 'Invoice History', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Invoice History', exact: true }).click()
      await expect(page.locator('.sidebar-overlay')).toHaveCount(0)
      await expect(page.locator('.topbar-title')).toHaveText('Invoices')
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: `test-results/${viewport.name}-dashboard.png`, fullPage: true })
  })
}
