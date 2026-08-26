import { createHash } from 'node:crypto'

/** Hashes the caller's IP so the audit log carries a stable, comparable
 *  fingerprint (useful for spotting repeated failures from one source)
 *  without storing the raw address. */
export function hashIp(req) {
  const ip = String(req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '').split(',')[0].trim()
  if (!ip) return null
  return createHash('sha256').update(`${process.env.SENSITIVE_ACTION_SECRET || 'audit'}:${ip}`).digest('hex')
}

/** Records an authentication/security event.
 *
 *  Call this from inside an already-authenticated server handler wherever
 *  possible and pass recordedBy: 'server' - those entries are written from
 *  a flow the browser cannot skip or forge the identity of, unlike the
 *  browser-reported login ping. Never throws: an audit write must not be
 *  able to break the security action it is describing.
 *
 *  Never store passwords, tokens, cookies or keys in `details`. */
export async function recordSecurityEvent(admin, req, {
  eventType, email, userId = null, accountId = null, role = 'admin',
  success = true, failureCode = null, details = {}, recordedBy = 'server',
}) {
  if (!admin || !eventType) return
  try {
    await admin.from('user_login_audit').insert({
      event_type: eventType,
      email: String(email || '').trim().toLowerCase().slice(0, 254) || null,
      user_id: userId, account_id: accountId, role,
      success, failure_code: success ? null : (failureCode ? String(failureCode).slice(0, 60) : null),
      ip_hash: hashIp(req),
      user_agent_summary: String(req?.headers?.['user-agent'] || '').slice(0, 180) || null,
      details, recorded_by: recordedBy,
    })
  } catch (error) {
    console.error('recordSecurityEvent failed', error instanceof Error ? error.message : 'Unknown error')
  }
}
