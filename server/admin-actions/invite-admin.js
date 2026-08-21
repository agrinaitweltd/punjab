import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { guardApi, safeError } from '../security.js'
import { requireSensitiveStaff, writeSystemAudit } from '../sensitive-actions.js'

const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 32_000, limit: 8, windowMs: 15 * 60_000 })) return
  const context = await requireSensitiveStaff(req, res)
  if (!context) return
  const { user, staff, admin } = context
  const name = String(req.body?.name || '').trim()
  const email = String(req.body?.email || '').trim().toLowerCase()
  const role = String(req.body?.role || 'Staff').trim()
  const jobTitle = String(req.body?.jobTitle || '').trim()
  const permissions = req.body?.permissions && typeof req.body.permissions === 'object' ? req.body.permissions : {}
  const isSalesman = Boolean(req.body?.isSalesman)
  const salesmanIds = Array.isArray(req.body?.salesmanIds) ? req.body.salesmanIds.map(String).slice(0, 50) : []
  if (!name || name.length > 120 || !validEmail(email) || email.length > 254 || !['Staff', 'Manager', 'Supervisor', 'Owner', 'System Developer'].includes(role)) {
    return res.status(400).json({ error: 'Enter valid account details.' })
  }
  if (role === 'System Developer' && staff.role !== 'System Developer') return res.status(403).json({ error: 'Only a System Developer can invite another System Developer.' })

  let createdAuthUserId = null
  let createdRosterId = null
  try {
    const existing = await admin.from('admin_staff').select('id,active,auth_user_id').ilike('email', email).maybeSingle()
    if (existing.error) throw existing.error
    if (existing.data) return res.status(409).json({ error: 'An account with that email already exists. Use resend setup or password recovery instead.' })

    const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim()
    const protocol = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim()
    const redirectTo = `${protocol}://${host}/?setup=password`
    const generated = await admin.auth.admin.generateLink({ type: 'invite', email, options: { data: { name, portal_role: role }, redirectTo } })
    if (generated.error || !generated.data?.properties?.action_link || !generated.data.user) throw generated.error || new Error('Invitation link was not generated')
    const authUser = generated.data.user
    createdAuthUserId = authUser.id
    const metadataRole = role === 'System Developer' ? 'system_developer' : 'admin'
    const updated = await admin.auth.admin.updateUserById(authUser.id, { app_metadata: { role: metadataRole } })
    if (updated.error) throw updated.error

    const placeholderHash = await bcrypt.hash(randomUUID(), 12)
    const roster = await admin.from('admin_staff').insert({
      name, username: email.split('@')[0], email, password: placeholderHash, role, job_title: jobTitle,
      active: true, is_super_admin: role === 'System Developer', permissions,
      is_salesman: isSalesman, salesman_ids: salesmanIds, auth_user_id: authUser.id,
      invitation_status: 'Sent', last_invited_at: new Date().toISOString(),
    }).select('id').single()
    if (roster.error) throw roster.error
    createdRosterId = roster.data.id

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) throw new Error('Invitation email provider is not configured')
    const message = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Punjab Exotic Foods <info@punjabexoticfoods.com>', to: [email],
        subject: 'Set up your Punjab Exotic Foods account',
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#24332a"><img src="${protocol}://${host}/logo.png" alt="Punjab Exotic Foods" width="72"><h2>Welcome, ${name.replace(/[<>&]/g, '')}</h2><p>You have been invited as <strong>${role.replace(/[<>&]/g, '')}</strong>. Use the secure button below to choose your password.</p><p><a href="${generated.data.properties.action_link}" style="display:inline-block;padding:12px 20px;background:#176b37;color:#fff;text-decoration:none;border-radius:6px;font-weight:700">Set up account</a></p><p style="color:#68756d;font-size:13px">This one-time link expires automatically. Punjab Exotic Foods will never email you a password.</p></div>`,
      }),
    })
    if (!message.ok) throw new Error(`Email provider returned ${message.status}`)
    await writeSystemAudit(admin, user.id, 'admin_invited', 'admin_staff', roster.data.id, { email, role })
    return res.status(200).json({ ok: true })
  } catch (error) {
    if (createdRosterId) await admin.from('admin_staff').delete().eq('id', createdRosterId)
    if (createdAuthUserId) await admin.auth.admin.deleteUser(createdAuthUserId)
    console.error('invite-admin failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
