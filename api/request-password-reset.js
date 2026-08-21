import { createClient } from '@supabase/supabase-js'
import { guardApi } from '../server/security.js'

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
    const { data: account, error } = await admin.from(table).select('id,email,auth_user_id').ilike('email', email).maybeSingle()
    if (error) throw error
    if (!account?.auth_user_id) return genericResponse(res)

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

    const message = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Punjab Exotic Foods <info@punjabexoticfoods.com>',
        to: [account.email],
        subject: 'Secure your Punjab Exotic Foods password',
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>Set your password</h2><p>Use the secure button below to choose a new password. This one-time link expires automatically.</p><p><a href="${link.properties.action_link}" style="display:inline-block;padding:12px 20px;background:#1f7a3a;color:#fff;text-decoration:none;border-radius:6px;font-weight:700">Set password</a></p><p>If you did not request this, you can ignore this email.</p></div>`,
      }),
    })
    if (!message.ok) throw new Error(`Recovery email provider returned ${message.status}`)
  } catch (error) {
    console.error('request-password-reset failed', error instanceof Error ? error.message : 'Unknown error')
  }
  return genericResponse(res)
}
