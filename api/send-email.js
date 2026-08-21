// Vercel serverless function — keeps the Resend API key off the client.
// Set RESEND_API_KEY in Vercel → Project → Settings → Environment Variables.
import { guardApi, requireUser, safeError } from '../server/security.js'

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 4_200_000, limit: 12 })) return
  if (!(await requireUser(req, res, { adminOnly: true }))) return

  const key = process.env.RESEND_API_KEY
  if (!key) return res.status(500).json({ error: 'RESEND_API_KEY not configured' })

  const { to, subject, html, attachments } = req.body ?? {}
  const recipients = (Array.isArray(to) ? to : [to]).map(value => String(value || '').trim())
  if (!recipients.length || recipients.length > 10 || recipients.some(value => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) || !String(subject || '').trim() || String(subject).length > 200 || !String(html || '').trim() || String(html).length > 250_000) return res.status(400).json({ error: 'Invalid email request' })

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Punjab Exotic Foods <info@punjabexoticfoods.com>',
        to: recipients,
        subject: String(subject).trim(),
        html,
        ...(Array.isArray(attachments) && attachments.length ? { attachments: attachments.slice(0, 5).map(a => ({ filename: String(a.filename || 'attachment'), content: String(a.content || '') })) } : {}),
      }),
    })
    const data = await r.json()
    return res.status(r.ok ? 200 : 502).json(data)
  } catch (e) {
    console.error('send-email failed', e instanceof Error ? e.message : 'Unknown error')
    return res.status(502).json({ error: safeError })
  }
}
