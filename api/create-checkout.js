// Vercel serverless function — creates a Stripe Checkout session for the
// invoices the customer selected. Set STRIPE_SECRET_KEY (sk_live_...) in
// Vercel -> Project -> Settings -> Environment Variables.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return res.status(500).json({ error: 'Card payments are not set up yet — STRIPE_SECRET_KEY is not configured.' })

  const { invoices, customerEmail, origin } = req.body ?? {}
  if (!Array.isArray(invoices) || invoices.length === 0 || !origin) {
    return res.status(400).json({ error: 'Missing invoices/origin' })
  }

  // Build the form-encoded Checkout Session payload
  const params = new URLSearchParams()
  params.set('mode', 'payment')
  params.set('success_url', `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`)
  params.set('cancel_url', `${origin}/?checkout=cancelled`)
  if (customerEmail) params.set('customer_email', customerEmail)
  params.set('metadata[invoice_ids]', JSON.stringify(invoices.map((i) => i.id)))
  invoices.forEach((inv, n) => {
    params.set(`line_items[${n}][price_data][currency]`, 'gbp')
    params.set(`line_items[${n}][price_data][product_data][name]`, `Invoice ${inv.invoiceNumber}`)
    params.set(`line_items[${n}][price_data][unit_amount]`, String(Math.round(inv.amount * 100)))
    params.set(`line_items[${n}][quantity]`, '1')
  })

  try {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const data = await r.json()
    if (!r.ok) return res.status(502).json({ error: data.error?.message || 'Stripe error' })
    return res.status(200).json({ url: data.url })
  } catch (e) {
    return res.status(502).json({ error: String(e) })
  }
}
