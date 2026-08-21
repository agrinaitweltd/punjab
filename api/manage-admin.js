import { guardApi, safeError } from '../server/security.js'
import { requireSensitiveStaff, writeSystemAudit } from '../server/sensitive-actions.js'

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 32_000, limit: 12, windowMs: 15 * 60_000 })) return
  const context = await requireSensitiveStaff(req, res)
  if (!context) return
  const { user, staff, admin } = context
  const id = String(req.body?.id || '')
  const action = String(req.body?.action || '')
  if (!id || !['update', 'set_active', 'remove'].includes(action)) return res.status(400).json({ error: 'Invalid administration request.' })
  try {
    const target = await admin.from('admin_staff').select('id,name,email,role,active,is_super_admin,auth_user_id').eq('id', id).maybeSingle()
    if (target.error || !target.data) return res.status(404).json({ error: 'Account not found.' })
    if (target.data.id === staff.id) return res.status(400).json({ error: 'You cannot disable or remove your own account here.' })
    if (target.data.role === 'System Developer' && staff.role !== 'System Developer') return res.status(403).json({ error: 'System Developer access required.' })

    if (action === 'update') {
      const patch = req.body?.data || {}
      const role = String(patch.role || target.data.role)
      if (!['Staff', 'Manager', 'Supervisor', 'Owner', 'System Developer'].includes(role)) return res.status(400).json({ error: 'Invalid administrator role.' })
      if (role === 'System Developer' && staff.role !== 'System Developer') return res.status(403).json({ error: 'System Developer access required.' })
      const update = await admin.from('admin_staff').update({
        name: String(patch.name || target.data.name).trim().slice(0, 120), role,
        job_title: String(patch.jobTitle || '').trim().slice(0, 120),
        permissions: patch.permissions && typeof patch.permissions === 'object' ? patch.permissions : {},
        is_salesman: Boolean(patch.isSalesman), salesman_ids: Array.isArray(patch.salesmanIds) ? patch.salesmanIds.map(String).slice(0, 50) : [],
      }).eq('id', id)
      if (update.error) throw update.error
      if (target.data.auth_user_id) {
        const authUpdate = await admin.auth.admin.updateUserById(target.data.auth_user_id, { app_metadata: { role: role === 'System Developer' ? 'system_developer' : 'admin' } })
        if (authUpdate.error) throw authUpdate.error
      }
      await writeSystemAudit(admin, user.id, 'admin_role_or_permissions_updated', 'admin_staff', id, { role })
    } else {
      const active = action === 'set_active' ? Boolean(req.body?.active) : false
      const update = await admin.from('admin_staff').update({ active, ...(action === 'remove' ? { invitation_status: 'Revoked' } : {}) }).eq('id', id)
      if (update.error) throw update.error
      if (target.data.auth_user_id) {
        const authUpdate = await admin.auth.admin.updateUserById(target.data.auth_user_id, { ban_duration: active ? 'none' : '876000h' })
        if (authUpdate.error) throw authUpdate.error
      }
      await writeSystemAudit(admin, user.id, action === 'remove' ? 'admin_removed' : active ? 'admin_enabled' : 'admin_disabled', 'admin_staff', id, { email: target.data.email })
    }
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('manage-admin failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
