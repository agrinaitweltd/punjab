import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { guardApi, safeError } from '../security.js'

// Records admin login attempts for the audit trail. Called both on success
// and failure, so it cannot require a valid session — it is tightly rate
// limited instead. Never accepts or stores the password itself.
export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 2_048, limit: 30, windowMs: 15 * 60_000 })) return
  const url = process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(200).json({ ok: true })
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 254)
  const success = Boolean(req.body?.success)
  const failureCode = req.body?.failureCode ? String(req.body.failureCode).slice(0, 60) : null
  const userId = req.body?.userId ? String(req.body.userId).slice(0, 64) : null
  const accountId = req.body?.accountId ? String(req.body.accountId).slice(0, 64) : null
  if (!email) return res.status(200).json({ ok: true })
  try {
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()
    await admin.from('user_login_audit').insert({
      email, role: 'admin', success, failure_code: success ? null : failureCode,
      user_id: userId, account_id: accountId,
      ip_hash: ip ? createHash('sha256').update(`${process.env.SENSITIVE_ACTION_SECRET || 'audit'}:${ip}`).digest('hex') : null,
      user_agent_summary: String(req.headers?.['user-agent'] || '').slice(0, 180) || null,
    })
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('record-login failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
