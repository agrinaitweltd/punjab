// Vercel serverless function — after Stripe redirects back, the portal calls
// this to confirm the session was actually paid before marking invoices paid.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' })

  const sessionId = (req.query.session_id || '').toString()
  if (!sessionId) return res.status(400).json({ error: 'Missing session_id' })

  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    const data = await r.json()
    if (!r.ok) return res.status(502).json({ error: data.error?.message || 'Stripe error' })
    let invoiceIds = []
    try { invoiceIds = JSON.parse(data.metadata?.invoice_ids || '[]') } catch { /* ignore */ }
    return res.status(200).json({
      paid: data.payment_status === 'paid',
      invoiceIds,
      amount: (data.amount_total ?? 0) / 100,
    })
  } catch (e) {
    return res.status(502).json({ error: String(e) })
  }
}
