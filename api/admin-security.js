const handlers = {
  'complete-account-setup': () => import('../server/admin-actions/complete-account-setup.js'),
  'application-backup': () => import('../server/admin-actions/application-backup.js'),
  'download-backup': () => import('../server/admin-actions/download-backup.js'),
  'invite-admin': () => import('../server/admin-actions/invite-admin.js'),
  'invite-customer': () => import('../server/admin-actions/invite-customer.js'),
  'manage-admin': () => import('../server/admin-actions/manage-admin.js'),
  'system-mode': () => import('../server/admin-actions/system-mode.js'),
  'system-overview': () => import('../server/admin-actions/system-overview.js'),
  'verify-sensitive-action': () => import('../server/admin-actions/verify-sensitive-action.js'),
}

export default async function handler(req, res) {
  const action = String(req.query?.action || '')
  const load = handlers[action]
  if (!load) return res.status(404).json({ error: 'Administration endpoint not found.' })
  const module = await load()
  return module.default(req, res)
}
