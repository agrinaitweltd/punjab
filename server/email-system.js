const DOMAIN = 'punjabexoticfoods.com'
export const EMAIL_REPLY_TO = 'info@punjabexoticfoods.co.uk'
export const EMAIL_SUPPORT_PHONE = '020 8558 2867'

export const EMAIL_SENDERS = Object.freeze({
  notifications: { name: 'Punjab Exotic Foods Notifications', email: `notifications@${DOMAIN}` },
  signup: { name: 'Punjab Exotic Foods Signup', email: `signup@${DOMAIN}` },
  password: { name: 'Punjab Exotic Foods Password Recovery', email: `forgotpassword@${DOMAIN}` },
  security: { name: 'Punjab Exotic Foods Security', email: `security@${DOMAIN}` },
  orders: { name: 'Punjab Exotic Foods Orders', email: `orders@${DOMAIN}` },
  delivery: { name: 'Punjab Exotic Foods Delivery', email: `delivery@${DOMAIN}` },
  statements: { name: 'Punjab Exotic Foods Statements', email: `statements@${DOMAIN}` },
  accounts: { name: 'Punjab Exotic Foods Accounts', email: `accounts@${DOMAIN}` },
  system: { name: 'Punjab Exotic Foods System', email: `system@${DOMAIN}` },
})

export const emailCategory = value => Object.hasOwn(EMAIL_SENDERS, value) ? value : 'system'
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])

export function brandedEmail({ heading, intro = '', contentHtml = '', cta, preheader = '', logoUrl = 'https://www.punjabexoticfoods.com/logo.png' }) {
  const button = cta?.url && cta?.label ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px auto"><tr><td bgcolor="#1f7a3a" style="border-radius:6px"><a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none">${escapeHtml(cta.label)}</a></td></tr></table>` : ''
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><title>${escapeHtml(heading)}</title></head><body style="margin:0;padding:0;background:#f3f5f3"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader || intro)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f3f5f3"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e3e8e4"><tr><td style="height:5px;background:#1f7a3a;font-size:0">&nbsp;</td></tr><tr><td align="center" style="padding:34px 28px 18px"><img src="${escapeHtml(logoUrl)}" width="72" height="72" alt="Punjab Exotic Foods" style="display:block;width:72px;height:72px;object-fit:contain;border:0"><div style="margin-top:10px;font-family:Arial,sans-serif;font-size:18px;line-height:24px;font-weight:700;color:#17241c">Punjab Exotic Foods</div></td></tr><tr><td style="padding:12px 42px 36px;font-family:Arial,sans-serif;color:#3e4b43;text-align:center"><h1 style="margin:0 0 14px;font-size:29px;line-height:36px;color:#17241c;font-weight:700">${escapeHtml(heading)}</h1>${intro ? `<p style="margin:0 auto 18px;max-width:480px;font-size:15px;line-height:24px;color:#59655d">${escapeHtml(intro)}</p>` : ''}<div style="font-size:14px;line-height:22px;text-align:left">${contentHtml}</div>${button}</td></tr><tr><td style="padding:26px 34px;border-top:1px solid #e8ece9;background:#fafbfa;font-family:Arial,sans-serif;text-align:center"><p style="margin:0 0 12px;font-size:12px;line-height:19px;color:#5f6c64"><strong>Punjab Exotic Foods Ltd</strong><br>Stand 1B, New Spitalfields Market<br>Sherrin Road, Leyton, London, E10 5SQ<br>Tel: ${EMAIL_SUPPORT_PHONE}</p><p style="margin:0;font-size:11px;line-height:18px;color:#818b85">Please do not reply directly to this automated email. If you need assistance, please email <a href="mailto:${EMAIL_REPLY_TO}" style="color:#1f7a3a">${EMAIL_REPLY_TO}</a> or call us on ${EMAIL_SUPPORT_PHONE}.</p></td></tr></table></td></tr></table></body></html>`
}

export function summaryTable(rows) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0;border:1px solid #dfe6e1;background:#f8faf8">${rows.map(([label, value]) => `<tr><td style="padding:10px 14px;border-bottom:1px solid #e6ebe7;color:#6d786f">${escapeHtml(label)}</td><td align="right" style="padding:10px 14px;border-bottom:1px solid #e6ebe7;color:#1d2b22;font-weight:700">${escapeHtml(value)}</td></tr>`).join('')}</table>`
}

/** A section heading for the long-form daily summary email - a coloured
 *  left-bar block so each section is easy to jump to when scanning a long
 *  email, matching the branded green/amber/red palette used elsewhere. */
export function sectionHeading(title, tone = 'neutral') {
  const color = { neutral: '#1f7a3a', warn: '#a16207', bad: '#b91c1c', good: '#15803d' }[tone] || '#1f7a3a'
  return `<h2 style="margin:28px 0 10px;padding-left:10px;border-left:3px solid ${color};font-size:15px;line-height:20px;font-weight:700;color:#17241c">${escapeHtml(title)}</h2>`
}

/** A plain-language callout box for an important alert within the email
 *  (e.g. "3 invoices need review") - distinct from the section heading. */
export function alertBox(text, tone = 'warn') {
  const styles = { warn: 'background:#fef9c3;border:1px solid #fde68a;color:#92400e', bad: 'background:#fef2f2;border:1px solid #fecaca;color:#991b1b', good: 'background:#f0fdf4;border:1px solid #bbf7d0;color:#166534' }
  return `<div style="margin:10px 0;padding:10px 14px;border-radius:6px;font-size:13px;line-height:19px;${styles[tone] || styles.warn}">${escapeHtml(text)}</div>`
}

/** A genuine multi-column HTML table for the detailed daily-summary email -
 *  summaryTable() above only supports fixed label/value pairs, this
 *  supports arbitrary headers and rows (e.g. new-customer or problem-
 *  invoice detail lists). Cells are pre-escaped by the caller when they
 *  need markup (e.g. a status badge); a plain string cell is escaped here. */
export function dataTable(headers, rows) {
  if (!rows.length) return ''
  const headHtml = headers.map(h => `<th align="left" style="padding:8px 10px;border-bottom:2px solid #dfe6e1;color:#59655d;font-size:11px;text-transform:uppercase;letter-spacing:0.03em">${escapeHtml(h)}</th>`).join('')
  const bodyHtml = rows.map(row => `<tr>${row.map(cell => `<td style="padding:8px 10px;border-bottom:1px solid #eef1ee;color:#1d2b22;font-size:12.5px">${typeof cell === 'object' && cell?.html ? cell.html : escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:10px 0 20px;border:1px solid #dfe6e1"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`
}

export async function sendTransactionalEmail({ apiKey = process.env.RESEND_API_KEY, category, to, subject, html, attachments = [], admin = null, customerId = null, invoiceId = null, idempotencyKey = null, communicationType = null, createdBy = 'System' }) {
  const senderCategory = emailCategory(category)
  const sender = EMAIL_SENDERS[senderCategory]
  const recipients = (Array.isArray(to) ? to : [to]).map(value => String(value || '').trim().toLowerCase()).filter(Boolean)
  if (!apiKey || !recipients.length) return { ok: false, error: 'Email provider or recipient is missing' }
  if (admin && idempotencyKey) {
    const existing = await admin.from('communication_logs').select('id,status').eq('idempotency_key', idempotencyKey).maybeSingle()
    if (existing.error) return { ok: false, error: existing.error.message }
    if (existing.data?.status === 'Sent') return { ok: true, skipped: true, id: existing.data.id }
  }
  const payload = { from: `${sender.name} <${sender.email}>`, reply_to: EMAIL_REPLY_TO, to: recipients, subject: String(subject).slice(0, 200), html, ...(attachments.length ? { attachments: attachments.slice(0, 5) } : {}) }
  let logId = null
  if (admin) {
    const log = { customer_id: customerId, invoice_id: invoiceId, communication_type: communicationType || senderCategory, channel: 'email', recipient: recipients.join(', '), status: 'Pending', idempotency_key: idempotencyKey, created_by: createdBy, sender_category: senderCategory, sender_email: sender.email, reply_to: EMAIL_REPLY_TO, subject: payload.subject, last_attempt_at: new Date().toISOString(), payload: { attachmentNames: attachments.map(item => item.filename) } }
    const saved = idempotencyKey ? await admin.from('communication_logs').upsert(log, { onConflict: 'idempotency_key' }).select('id').single() : await admin.from('communication_logs').insert(log).select('id').single()
    if (!saved.error) logId = saved.data.id
  }
  try {
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await response.json().catch(() => ({}))
    const error = response.ok ? null : data?.message || data?.error || `Email provider returned ${response.status}`
    if (admin && logId) await admin.from('communication_logs').update({ status: response.ok ? 'Sent' : 'Failed', sent_at: response.ok ? new Date().toISOString() : null, error, provider_message_id: data?.id || null }).eq('id', logId)
    return { ok: response.ok, id: data?.id || null, logId, error, status: response.status, sender: sender.email }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email provider request failed'
    if (admin && logId) await admin.from('communication_logs').update({ status: 'Failed', error: message }).eq('id', logId)
    return { ok: false, logId, error: message, sender: sender.email }
  }
}
