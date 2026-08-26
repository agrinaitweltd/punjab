import { createClient } from '@supabase/supabase-js'
import { guardApi, safeError } from '../security.js'
import { recordSecurityEvent } from '../security-audit.js'

// Records admin login/logout events for the audit trail.
//
// A FAILED login has no session by definition, so this endpoint cannot
// require authentication outright - it is tightly rate limited instead.
// However, when the caller does supply a bearer token (i.e. the login
// succeeded), the token is verified here and the identity written to the
// log is taken from the VERIFIED token rather than from the request body.
// That means a successful-login entry cannot be forged for another account
// by editing the browser payload, and it is marked recorded_by:'server'
// so the Login Activity page can show which entries are tamper-resistant.
export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 2_048, limit: 30, windowMs: 15 * 60_000 })) return
  const url = process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(200).json({ ok: true })

  const success = Boolean(req.body?.success)
  const eventType = req.body?.eventType === 'logout' ? 'logout' : 'login'
  const failureCode = req.body?.failureCode ? String(req.body.failureCode).slice(0, 60) : null

  let email = String(req.body?.email || '').trim().toLowerCase().slice(0, 254)
  let userId = req.body?.userId ? String(req.body.userId).slice(0, 64) : null
  let accountId = req.body?.accountId ? String(req.body.accountId).slice(0, 64) : null
  let recordedBy = 'client'

  try {
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

    // Verify the bearer token when one is present and trust it over the body.
    const bearer = String(req.headers?.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1]
    if (bearer) {
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY
      if (anonKey) {
        const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
        const { data, error } = await client.auth.getUser(bearer)
        if (!error && data?.user) {
          email = String(data.user.email || email).trim().toLowerCase().slice(0, 254)
          userId = data.user.id
          accountId = data.user.app_metadata?.legacy_id || accountId
          recordedBy = 'server'
        }
      }
    }

    if (!email) return res.status(200).json({ ok: true })
    await recordSecurityEvent(admin, req, { eventType, email, userId, accountId, role: 'admin', success, failureCode, recordedBy })
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('record-login failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
