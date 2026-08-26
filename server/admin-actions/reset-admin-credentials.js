import { randomUUID } from 'node:crypto'
import { guardApi, safeError } from '../security.js'
import { requireSensitiveStaff, writeSystemAudit } from '../sensitive-actions.js'
import { recordSecurityEvent } from '../security-audit.js'
import { brandedEmail, sendTransactionalEmail } from '../email-system.js'

// Resets an existing administrator's Supabase Auth password and sends a
// fresh one-time setup link. Doubles as "Resend Setup Link" for an admin who
// never completed their original invite — safe to call again.
export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 8_000, limit: 12, windowMs: 15 * 60_000 })) return
  const context = await requireSensitiveStaff(req, res)
  if (!context) return
  const { user, staff, admin } = context
  const id = String(req.body?.id || '')
  if (!id) return res.status(400).json({ error: 'Invalid administration request.' })
  try {
    const mode = await admin.from('system_settings').select('test_mode').eq('id', true).single()
    if (mode.error) throw mode.error
    if (mode.data.test_mode) {
      await writeSystemAudit(admin, user.id, 'admin_credentials_reset_simulated', 'admin_staff', id, {})
      return res.status(200).json({ ok: true, simulated: true, message: 'TEST MODE - credential reset simulated. No access was changed.' })
    }
    const target = await admin.from('admin_staff').select('id,name,email,role,active,auth_user_id').eq('id', id).maybeSingle()
    if (target.error || !target.data) return res.status(404).json({ error: 'Account not found.' })
    if (target.data.id === staff.id) return res.status(400).json({ error: 'You cannot reset your own access here.' })
    if (!target.data.active) return res.status(400).json({ error: 'Enable the account before resetting its access.' })
    if (target.data.role === 'System Developer' && staff.role !== 'System Developer') return res.status(403).json({ error: 'System Developer access required.' })
    if (!target.data.auth_user_id) return res.status(400).json({ error: 'This account has no linked sign-in yet — use Invite instead.' })

    // A fresh, unguessable password immediately invalidates the old one and
    // revokes any existing Supabase sessions/refresh tokens for this user.
    // Supabase Auth rejects passwords over 72 characters (bcrypt's limit) -
    // "Pef1!" + one UUID is 41 chars, comfortably under that.
    const invalidated = await admin.auth.admin.updateUserById(target.data.auth_user_id, { password: `Pef1!${randomUUID()}` })
    if (invalidated.error) throw invalidated.error

    const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim()
    const protocol = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim()
    const redirectTo = `${protocol}://${host}/?setup=password`
    const generated = await admin.auth.admin.generateLink({ type: 'recovery', email: target.data.email, options: { redirectTo } })
    if (generated.error || !generated.data?.properties?.action_link) throw generated.error || new Error('Setup link was not generated')

    const updated = await admin.from('admin_staff').update({ invitation_status: 'Sent', last_invited_at: new Date().toISOString() }).eq('id', id)
    if (updated.error) throw updated.error

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) throw new Error('Invitation email provider is not configured')
    const message = await sendTransactionalEmail({ apiKey: resendKey, category: 'signup', to: target.data.email, subject: 'Your Punjab Exotic Foods account access has been reset', admin, communicationType: 'admin_credentials_reset', createdBy: user.email || user.id,
      html: brandedEmail({ heading: `Set up your access again, ${target.data.name}`, intro: 'Your Punjab Exotic Foods administration account access has been reset for security. Your previous password no longer works.', contentHtml: `<p style="margin:0;text-align:center;color:#59655d">Choose a new secure password using the one-time setup link below. We will never send your password by email.</p>`, cta: { label: 'Set Up My Account', url: generated.data.properties.action_link }, logoUrl: `${protocol}://${host}/logo.png` }),
    })
    if (!message.ok) throw new Error(message.error || 'Setup link delivery failed')
    await writeSystemAudit(admin, user.id, 'admin_credentials_reset', 'admin_staff', id, { email: target.data.email })
    // Security-log the reset against the AFFECTED admin, noting who did it.
    await recordSecurityEvent(admin, req, {
      eventType: 'credentials_reset', email: target.data.email, accountId: id,
      details: { resetBy: user.email || user.id },
    })
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('reset-admin-credentials failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
