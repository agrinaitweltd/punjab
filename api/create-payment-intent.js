// Vercel serverless function — creates a Stripe PaymentIntent for the invoices
// the customer selected. The card is collected in-page with Stripe Elements
// (no redirect to Stripe's site). Set STRIPE_SECRET_KEY in Vercel -> Project
// -> Settings -> Environment Variables.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return res.status(500).json({ error: 'Card payments are not set up yet — STRIPE_SECRET_KEY is not configured.' })

  const { invoices, customerEmail } = req.body ?? {}
  if (!Array.isArray(invoices) || invoices.length === 0) {
    return res.status(400).json({ error: 'No invoices selected' })
  }
  const amount = Math.round(invoices.reduce((s, i) => s + Number(i.amount || 0), 0) * 100)
  if (amount < 30) return res.status(400).json({ error: 'Amount too small to charge' })

  const params = new URLSearchParams()
  params.set('amount', String(amount))
  params.set('currency', 'gbp')
  params.append('automatic_payment_methods[enabled]', 'true')
  params.set('metadata[invoice_ids]', JSON.stringify(invoices.map((i) => i.id)))
  params.set('metadata[invoice_numbers]', invoices.map((i) => i.invoiceNumber).join(', '))
  if (customerEmail) params.set('receipt_email', customerEmail)

  try {
    const r = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const data = await r.json()
    if (!r.ok) return res.status(502).json({ error: data.error?.message || 'Stripe error' })
    return res.status(200).json({ clientSecret: data.client_secret, paymentIntentId: data.id, amount: amount / 100 })
  } catch (e) {
    return res.status(502).json({ error: String(e) })
  }
}
