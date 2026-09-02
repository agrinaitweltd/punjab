const handlers = {
  'complete-account-setup': () => import('../server/admin-actions/complete-account-setup.js'),
  'database-reset': () => import('../server/admin-actions/database-reset.js'),
  'application-backup': () => import('../server/admin-actions/application-backup.js'),
  'download-backup': () => import('../server/admin-actions/download-backup.js'),
  'email-imports': () => import('../server/admin-actions/email-imports.js'),
  'invite-admin': () => import('../server/admin-actions/invite-admin.js'),
  'login-activity': () => import('../server/admin-actions/login-activity.js'),
  'invite-customer': () => import('../server/admin-actions/invite-customer.js'),
  'manage-admin': () => import('../server/admin-actions/manage-admin.js'),
  'record-login': () => import('../server/admin-actions/record-login.js'),
  'repair-pdf-backlog': () => import('../server/admin-actions/repair-pdf-backlog.js'),
  'report-error': () => import('../server/admin-actions/report-error.js'),
  'error-log': () => import('../server/admin-actions/error-log.js'),
  'reset-admin-credentials': () => import('../server/admin-actions/reset-admin-credentials.js'),
  'send-reminder': () => import('../server/admin-actions/send-reminder.js'),
  'system-mode': () => import('../server/admin-actions/system-mode.js'),
  'system-overview': () => import('../server/admin-actions/system-overview.js'),
  'test-email-suite': () => import('../server/admin-actions/test-email-suite.js'),
  'verify-sensitive-action': () => import('../server/admin-actions/verify-sensitive-action.js'),
}

export default async function handler(req, res) {
  const action = String(req.query?.action || '')
  const load = handlers[action]
  if (!load) return res.status(404).json({ error: 'Administration endpoint not found.' })
  const module = await load()
  return module.default(req, res)
}
