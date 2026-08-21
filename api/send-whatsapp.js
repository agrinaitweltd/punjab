// Vercel serverless function — keeps the UltraMsg token off the client.
// Set ULTRAMSG_TOKEN in Vercel → Project → Settings → Environment Variables.
// Only the single Punjab Exotic Foods Ltd WhatsApp Business account
// (UltraMsg instance186201) ever sends — this endpoint is the only thing
// that talks to UltraMsg, so no staff member's own WhatsApp is ever used.
import { guardApi, requireUser, safeError } from '../server/security.js'
import { globalTestMode, simulatedResult } from '../server/runtime-mode.js'

const ULTRAMSG_BASE = 'https://api.ultramsg.com/instance186201'

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 4_200_000, limit: 12 })) return
  if (!(await requireUser(req, res, { adminOnly: true }))) return

  const token = process.env.ULTRAMSG_TOKEN
  if (!token) return res.status(500).json({ error: 'ULTRAMSG_TOKEN not configured' })

  const { phone, message, document, filename } = req.body ?? {}
  if (!/^\d{8,15}$/.test(String(phone || '')) || !String(message || '').trim() || String(message).length > 4000) return res.status(400).json({ error: 'Invalid WhatsApp request' })
  if (document && (!String(document).startsWith('data:application/pdf;base64,') || String(document).length > 4_000_000)) return res.status(400).json({ error: 'Only PDF attachments up to 3 MB are allowed' })

  try {
    if (await globalTestMode()) return res.status(200).json(simulatedResult('WhatsApp message'))
    const body = document
      ? new URLSearchParams({ token, to: phone, filename: filename || 'Punjab-Invoice.pdf', document, caption: message })
      : new URLSearchParams({ token, to: phone, body: message })
    const r = await fetch(`${ULTRAMSG_BASE}/messages/${document ? 'document' : 'chat'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = await r.json()
    // UltraMsg returns { sent: true, id, message } on success, or an
    // { error: ... } shape on failure — either way pass it straight through
    // so the caller can log the raw response.
    const ok = r.ok && data?.sent !== false && !data?.error
    return res.status(ok ? 200 : 502).json(data)
  } catch (e) {
    console.error('send-whatsapp failed', e instanceof Error ? e.message : 'Unknown error')
    return res.status(502).json({ error: safeError })
  }
}
