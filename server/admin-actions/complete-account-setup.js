import { createClient } from '@supabase/supabase-js'
import { guardApi, requireUser, safeError } from '../security.js'
import { brandedEmail, sendTransactionalEmail } from '../email-system.js'
import { recordSecurityEvent } from '../security-audit.js'

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 2_048, limit: 8 })) return
  const user = await requireUser(req, res)
  if (!user) return
  const url = process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(500).json({ error: 'Account setup is not configured.' })
  try {
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const table = ['admin', 'system_developer'].includes(user.app_metadata?.role) ? 'admin_staff' : 'customers'
    const update = await admin.from(table).update({ ...(table === 'admin_staff' ? { invitation_status: 'Accepted' } : {}) }).eq('auth_user_id', user.id)
    if (update.error) throw update.error

    // Server-side record of the password having actually been set/changed -
    // this handler is the only place that completes the flow, so the event
    // cannot be skipped from the browser.
    await recordSecurityEvent(admin, req, {
      eventType: table === 'admin_staff' ? 'admin_activated' : 'password_reset_completed',
      email: user.email, userId: user.id,
      role: table === 'admin_staff' ? 'admin' : 'customer',
    })

    // Best-effort confirmation - covers first-time setup and password
    // resets alike, since both land here via the same recovery/invite link.
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey && user.email) {
      await sendTransactionalEmail({
        apiKey: resendKey, category: 'security', to: user.email, subject: 'Your Punjab Exotic Foods password was changed', admin,
        communicationType: 'password_changed',
        html: brandedEmail({
          heading: 'Password changed',
          intro: 'Your Punjab Exotic Foods account password was just set or changed successfully.',
          contentHtml: '<p style="margin:0;text-align:center;color:#59655d">If this wasn\'t you, contact us immediately using the details below.</p>',
        }),
      }).catch(sendError => console.error('password-changed email failed', sendError instanceof Error ? sendError.message : 'Unknown error'))
    }

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('complete-account-setup failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
