// Vercel serverless function — after Stripe Elements confirms a payment
// in-page, the portal calls this to verify it actually succeeded (server-side,
// authoritative) before marking invoices paid.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' })

  const paymentIntentId = (req.query.payment_intent || '').toString()
  if (!paymentIntentId) return res.status(400).json({ error: 'Missing payment_intent' })

  try {
    const r = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    const data = await r.json()
    if (!r.ok) return res.status(502).json({ error: data.error?.message || 'Stripe error' })
    let invoiceIds = []
    try { invoiceIds = JSON.parse(data.metadata?.invoice_ids || '[]') } catch { /* ignore */ }
    return res.status(200).json({
      paid: data.status === 'succeeded',
      invoiceIds,
      amount: (data.amount ?? 0) / 100,
    })
  } catch (e) {
    return res.status(502).json({ error: String(e) })
  }
}
