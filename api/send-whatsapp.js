// Vercel serverless function — keeps the UltraMsg token off the client.
// Set ULTRAMSG_TOKEN in Vercel → Project → Settings → Environment Variables.
// Only the single Punjab Exotic Foods Ltd WhatsApp Business account
// (UltraMsg instance186201) ever sends — this endpoint is the only thing
// that talks to UltraMsg, so no staff member's own WhatsApp is ever used.
const ULTRAMSG_BASE = 'https://api.ultramsg.com/instance186201'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = process.env.ULTRAMSG_TOKEN
  if (!token) return res.status(500).json({ error: 'ULTRAMSG_TOKEN not configured' })

  const { phone, message } = req.body ?? {}
  if (!phone || !message) return res.status(400).json({ error: 'Missing phone/message' })

  try {
    const body = new URLSearchParams({ token, to: phone, body: message })
    const r = await fetch(`${ULTRAMSG_BASE}/messages/chat`, {
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
    return res.status(502).json({ error: String(e) })
  }
}
