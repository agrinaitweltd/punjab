import { createClient } from '@supabase/supabase-js'
import { guardApi } from '../server/security.js'
import { globalTestMode } from '../server/runtime-mode.js'
import { brandedEmail, sendTransactionalEmail } from '../server/email-system.js'

const genericResponse = res => res.status(200).json({ ok: true })

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 4_096, limit: 5, windowMs: 15 * 60_000 })) return
  const role = req.body?.role
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!['admin', 'customer'].includes(role) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid reset request' })
  }

  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  if (!url || !serviceKey || !resendKey) return res.status(500).json({ error: 'Password recovery is not configured' })

  try {
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const table = role === 'admin' ? 'admin_staff' : 'customers'
    const columns = role === 'admin' ? 'id,email,auth_user_id,role' : 'id,email,auth_user_id'
    const { data: account, error } = await admin.from(table).select(columns).ilike('email', email).maybeSingle()
    if (error) throw error
    if (!account?.auth_user_id) return genericResponse(res)
    if (await globalTestMode(admin)) {
      const isDeveloper = role === 'admin' && account.role === 'System Developer'
      if (!isDeveloper) return genericResponse(res)
    }

    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(account.auth_user_id)
    if (authError || !authUser.user?.email) throw authError || new Error('Linked Auth user is missing')
    const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim()
    const protocol = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim()
    const redirectTo = `${protocol}://${host}/`
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: authUser.user.email,
      options: { redirectTo },
    })
    if (linkError || !link.properties?.action_link) throw linkError || new Error('Recovery link was not generated')

    const message = await sendTransactionalEmail({
      apiKey: resendKey, category: 'password', to: account.email, subject: 'Reset your Punjab Exotic Foods password', admin,
      communicationType: 'password_reset', createdBy: 'Password recovery',
      html: brandedEmail({ heading: 'Reset your password', intro: 'A password reset was requested for your Punjab Exotic Foods account.', contentHtml: '<p style="margin:0;color:#59655d;text-align:center">Use the secure button below to choose a new password. The one-time link expires automatically. If you did not request this, you can safely ignore this email.</p>', cta: { label: 'Reset Password', url: link.properties.action_link }, preheader: 'Use this secure link to reset your password.' }),
    })
    if (!message.ok) throw new Error(message.error || 'Recovery email delivery failed')
  } catch (error) {
    console.error('request-password-reset failed', error instanceof Error ? error.message : 'Unknown error')
  }
  return genericResponse(res)
}
