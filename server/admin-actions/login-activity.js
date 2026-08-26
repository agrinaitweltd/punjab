import { guardApi, requireUser, safeError } from '../security.js'
import { serviceClient } from '../runtime-mode.js'

const MAX_ROWS = 500

/** Reads the authentication/security event log. Available to any active
 *  admin (not System Developer only) so an admin can audit activity on
 *  their own account - the underlying RLS policy allows the same. Never
 *  returns passwords, tokens or raw IPs: the table only ever stores a
 *  salted IP hash and a short user-agent summary. */
export default async function handler(req, res) {
  if (!guardApi(req, res, { methods: ['GET'], maxBytes: 0, limit: 60 })) return
  const user = await requireUser(req, res, { adminOnly: true })
  if (!user) return

  try {
    const admin = serviceClient()
    const limit = Math.min(Number(req.query?.limit) || 200, MAX_ROWS)
    let query = admin.from('user_login_audit')
      .select('id, event_type, email, role, login_at, success, failure_code, user_agent_summary, ip_hash, details, recorded_by, account_id')
      .order('login_at', { ascending: false })
      .limit(limit)

    if (req.query?.eventType) query = query.eq('event_type', String(req.query.eventType))
    if (req.query?.email) query = query.ilike('email', `%${String(req.query.email).slice(0, 120)}%`)
    if (req.query?.success === 'true') query = query.eq('success', true)
    if (req.query?.success === 'false') query = query.eq('success', false)
    if (req.query?.from) query = query.gte('login_at', String(req.query.from))
    if (req.query?.to) query = query.lte('login_at', `${String(req.query.to)}T23:59:59.999Z`)

    const { data, error } = await query
    if (error) throw error

    // Repeated failures from the same account are the signal worth
    // surfacing; computed here so every client shows the same threshold.
    const failuresByEmail = new Map()
    for (const row of data || []) {
      if (row.success === false) failuresByEmail.set(row.email, (failuresByEmail.get(row.email) || 0) + 1)
    }
    const suspicious = [...failuresByEmail.entries()]
      .filter(([, count]) => count >= 3)
      .map(([email, count]) => ({ email, failedCount: count }))

    return res.status(200).json({ events: data || [], suspicious })
  } catch (error) {
    console.error('login-activity failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
