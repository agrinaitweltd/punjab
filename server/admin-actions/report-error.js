import { createClient } from '@supabase/supabase-js'
import { guardApi, requireUser, safeError } from '../security.js'
import { brandedEmail, escapeHtml, sendTransactionalEmail } from '../email-system.js'

const SECRET_KEY_PATTERN = /password|token|secret|apikey|api_key|service_role|cookie/i
// Catches key=value / key: value / "key": "value" style secrets embedded in
// free text (e.g. a stringified request body inside an error message) -
// SECRET_KEY_PATTERN alone only catches object *keys*, not string content.
const SECRET_TEXT_PATTERN = /((?:password|passwd|pwd|token|secret|api[_-]?key|service_role|authorization|cookie)\s*[:=]\s*)("[^"]*"|'[^']*'|\S+)/gi
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._-]+/gi

function redactText(value) {
  // Bearer-token redaction must run first: otherwise "Authorization: Bearer
  // eyJ..." gets partially consumed by SECRET_TEXT_PATTERN (which stops at
  // the first whitespace, i.e. just the word "Bearer"), leaving the actual
  // token behind as plain trailing text.
  return value.replace(BEARER_PATTERN, 'Bearer [redacted]').replace(SECRET_TEXT_PATTERN, '$1[redacted]')
}

// Strips anything that looks like a credential from a value before it's
// logged or emailed - errors can legitimately carry request payloads in
// their technical detail, and those payloads must never leak a password,
// token, key or cookie even if a throw site accidentally included one.
function sanitize(value, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return value
  if (typeof value === 'string') return redactText(value.length > 4000 ? `${value.slice(0, 4000)}…` : value)
  if (Array.isArray(value)) return value.slice(0, 50).map(item => sanitize(item, depth + 1))
  if (typeof value === 'object') {
    const out = {}
    for (const [key, val] of Object.entries(value)) out[key] = SECRET_KEY_PATTERN.test(key) ? '[redacted]' : sanitize(val, depth + 1)
    return out
  }
  return value
}

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 16_000, limit: 20, windowMs: 15 * 60_000 })) return
  const user = await requireUser(req, res)
  if (!user) return
  const body = req.body ?? {}
  const code = Number(body.code)
  if (!Number.isFinite(code) || code < 200 || code > 900) return res.status(400).json({ error: 'Invalid error report.' })
  const title = String(body.title || 'Application error').slice(0, 200)
  const message = String(body.message || '').slice(0, 2000)
  const feature = body.feature ? String(body.feature).slice(0, 200) : null
  const note = body.note ? String(body.note).slice(0, 1000) : null
  const technicalDetail = sanitize(String(body.technicalDetail || '').slice(0, 4000))
  const context = body.context && typeof body.context === 'object' ? sanitize(body.context) : null
  const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 300)
  const correlationId = `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const url = process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(500).json({ error: 'Error reporting is not configured.' })
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  try {
    const inserted = await admin.from('application_error_log').insert({
      error_code: code, title, message, severity: code >= 700 ? 'high' : code >= 400 ? 'medium' : 'low',
      user_id: user.id, user_email: user.email || null, feature,
      technical_detail: technicalDetail, context, correlation_id: correlationId, resolved: false,
    })
    if (inserted.error) throw inserted.error

    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      const rows = [
        ['Error code', String(code)], ['Title', title], ['Feature/page', feature || '—'],
        ['Reported by', `${user.email || user.id}`], ['Date/time', new Date().toISOString()],
        ['Correlation ID', correlationId], ['Browser/device', userAgent || '—'],
      ]
      if (context?.invoiceNumber) rows.push(['Invoice', String(context.invoiceNumber)])
      if (context?.customerName) rows.push(['Customer', String(context.customerName)])
      const message_ = await sendTransactionalEmail({
        apiKey: resendKey, category: 'system', to: 'info@kavotech.uk', subject: `[Error ${code}] ${title}`, admin,
        communicationType: 'error_report',
        html: brandedEmail({
          heading: `Error ${code} reported`,
          intro: title,
          contentHtml: `
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0;border:1px solid #dfe6e1;background:#f8faf8">
              ${rows.map(([label, value]) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #e6ebe7;color:#6d786f;font-size:12.5px">${escapeHtml(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #e6ebe7;color:#1d2b22;font-size:12.5px">${escapeHtml(value)}</td></tr>`).join('')}
            </table>
            <p style="margin:0 0 8px;color:#59655d"><strong>Message:</strong> ${escapeHtml(message)}</p>
            ${note ? `<p style="margin:0 0 8px;color:#59655d"><strong>Note from reporter:</strong> ${escapeHtml(note)}</p>` : ''}
            <p style="margin:0 0 8px;color:#59655d"><strong>Technical detail:</strong></p>
            <pre style="white-space:pre-wrap;word-break:break-word;background:#f3f5f3;padding:10px;border-radius:6px;font-size:11.5px;color:#374151">${escapeHtml(typeof technicalDetail === 'string' ? technicalDetail : JSON.stringify(technicalDetail))}</pre>
          `,
        }),
      })
      if (!message_.ok) console.error('report-error email failed', message_.error)
    }
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('report-error failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
