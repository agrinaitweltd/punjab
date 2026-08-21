import { test, expect } from '@playwright/test'

const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:4174'
const user = {
  id: 'visual-system-developer', role: 'admin', username: 'system.developer',
  email: 'developer@example.test', displayName: 'System Developer',
  isSuperAdmin: true, isSystemDeveloper: true, permissions: { usersManage: true },
}
const session = {
  access_token: 'visual-test-token', refresh_token: 'visual-test-refresh',
  token_type: 'bearer', expires_in: 3600, expires_at: 4102444800,
  user: { id: user.id, email: user.email, app_metadata: { role: 'system_developer' }, user_metadata: {}, aud: 'authenticated', role: 'authenticated' },
}
const overview = {
  health: { database: 'Operational', authentication: 'Operational', environment: 'production', email: 'Configured', whatsapp: 'Configured' },
  counts: { customers: 248, admins: 4, salesUsers: 7, systemDevelopers: 1, disabled: 2 },
  users: [{ id: user.id, name: user.displayName, email: user.email, role: 'System Developer', active: true, createdAt: '2026-08-20T09:00:00Z', lastLoginAt: '2026-08-22T08:30:00Z', invitationStatus: 'Accepted' }],
  logins: [], audit: [{ id: 'audit-1', action: 'admin_invited', target_type: 'admin_staff', target_id: 'staff-4', metadata: {}, created_at: '2026-08-22T08:15:00Z' }], backups: [],
  testMode: false, testModeChangedAt: null, testIsolationReady: false, managedBackupsAvailable: false,
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  test(`${viewport.name} login layout`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.addInitScript(() => localStorage.setItem('punjab-cookie-consent', JSON.stringify({ necessary: true })))
    await page.goto(origin, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: `test-results/${viewport.name}-login.png`, fullPage: true })
  })

  test(`${viewport.name} restricted dashboard layout`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.addInitScript(({ user, session }) => {
      localStorage.setItem('punjab-session-user', JSON.stringify(user))
      localStorage.setItem('punjab-cookie-consent', JSON.stringify({ necessary: true }))
      localStorage.setItem('sb-vqnnlorukpzsftfisjrm-auth-token', JSON.stringify(session))
    }, { user, session })
    await page.route('**/api/admin-security?action=system-overview', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(overview) }))
    await page.route('**/api/admin-security?action=system-mode', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ testMode: false, changedAt: null }) }))
    await page.goto(origin, { waitUntil: 'domcontentloaded' })

    if (viewport.name === 'mobile') await page.getByRole('button', { name: 'Open menu' }).click()
    await page.locator('.pn-parent').filter({ hasText: 'System Management' }).click()
    await page.getByRole('button', { name: 'System Overview', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'System Overview', level: 2 })).toBeVisible()
    await expect(page.getByText('Production systems operational')).toBeVisible()
    await page.waitForTimeout(350)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: `test-results/${viewport.name}-system-dashboard.png`, fullPage: true })
  })
}
