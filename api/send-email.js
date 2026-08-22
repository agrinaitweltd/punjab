// Vercel serverless function — keeps the Resend API key off the client.
// Set RESEND_API_KEY in Vercel → Project → Settings → Environment Variables.
import { guardApi, requireUser, safeError } from '../server/security.js'
import { globalTestMode, serviceClient, simulatedResult } from '../server/runtime-mode.js'
import { brandedEmail, emailCategory, sendTransactionalEmail } from '../server/email-system.js'

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 4_200_000, limit: 12 })) return
  const user = await requireUser(req, res, { adminOnly: true })
  if (!user) return

  const key = process.env.RESEND_API_KEY
  if (!key) return res.status(500).json({ error: 'RESEND_API_KEY not configured' })

  const { to, subject, html, attachments, category, customerId, invoiceId, idempotencyKey, communicationType } = req.body ?? {}
  const recipients = (Array.isArray(to) ? to : [to]).map(value => String(value || '').trim())
  if (!recipients.length || recipients.length > 10 || recipients.some(value => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) || !String(subject || '').trim() || String(subject).length > 200 || !String(html || '').trim() || String(html).length > 250_000) return res.status(400).json({ error: 'Invalid email request' })

  try {
    const admin = serviceClient()
    if (await globalTestMode(admin)) return res.status(200).json(simulatedResult('Email'))
    const uniqueAttachments = [...new Map((Array.isArray(attachments) ? attachments : []).slice(0, 5).map(item => [String(item.filename || 'attachment').toLowerCase(), { filename: String(item.filename || 'attachment'), content: String(item.content || '') }])).values()]
    const content = /^\s*<!doctype html>/i.test(String(html)) ? String(html) : brandedEmail({ heading: String(subject).trim(), contentHtml: String(html) })
    const sent = await sendTransactionalEmail({ apiKey: key, category: emailCategory(category), to: recipients, subject: String(subject).trim(), html: content, attachments: uniqueAttachments, admin, customerId: customerId || null, invoiceId: invoiceId || null, idempotencyKey: idempotencyKey || null, communicationType: communicationType || null, createdBy: user.email || user.id })
    return res.status(sent.ok ? 200 : 502).json(sent)
  } catch (e) {
    console.error('send-email failed', e instanceof Error ? e.message : 'Unknown error')
    return res.status(502).json({ error: safeError })
  }
}
