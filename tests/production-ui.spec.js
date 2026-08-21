import { test, expect } from '@playwright/test'

const origin = process.env.PRODUCTION_ORIGIN
const password = process.env.DEVELOPER_TEST_PASSWORD

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`${viewport.name} admin dashboard`, async ({ page }) => {
    test.skip(!origin || !password, 'Production UI environment is required')
    await page.setViewportSize(viewport)
    await page.goto(origin, { waitUntil: 'networkidle' })
    const consent = page.getByRole('dialog', { name: 'Cookie consent' })
    if (await consent.isVisible()) await consent.getByRole('button', { name: 'Decline all' }).click()
    await page.getByRole('button', { name: 'Admin', exact: true }).click()
    await page.getByPlaceholder('you@punjabexoticfoods.com').fill('info@kavotech.uk')
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: 'Log In', exact: true }).click()
    await expect(page.getByText('Dashboard', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    const outstanding = page.locator('.ho-stat').filter({ hasText: 'Outstanding Payments' })
    await expect(outstanding.locator('.ho-stat-value')).toHaveText('£37,103.73', { timeout: 20_000 })
    await expect(outstanding).toContainText('152 invoices')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: `test-results/${viewport.name}-dashboard.png`, fullPage: true })
  })
}
