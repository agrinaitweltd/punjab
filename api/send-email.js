// Vercel serverless function — keeps the Resend API key off the client.
// Set RESEND_API_KEY in Vercel → Project → Settings → Environment Variables.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const key = process.env.RESEND_API_KEY
  if (!key) return res.status(500).json({ error: 'RESEND_API_KEY not configured' })

  const { to, subject, html, attachments } = req.body ?? {}
  if (!to || !subject || !html) return res.status(400).json({ error: 'Missing to/subject/html' })

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Punjab Exotic Foods <info@punjabexoticfoods.com>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(Array.isArray(attachments) && attachments.length ? { attachments: attachments.slice(0, 5).map(a => ({ filename: String(a.filename || 'attachment'), content: String(a.content || '') })) } : {}),
      }),
    })
    const data = await r.json()
    return res.status(r.ok ? 200 : 502).json(data)
  } catch (e) {
    return res.status(502).json({ error: String(e) })
  }
}
