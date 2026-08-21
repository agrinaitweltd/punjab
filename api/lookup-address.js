// Vercel serverless function — keeps the Ideal Postcodes API key off the client.
// Set IDEAL_POSTCODES_API_KEY in Vercel -> Project -> Settings -> Environment Variables.
import { guardApi, requireUser, safeError } from '../server/security.js'

export default async function handler(req, res) {
  if (!guardApi(req, res, { methods: ['GET'], maxBytes: 0, limit: 30 })) return
  if (!(await requireUser(req, res))) return

  const key = process.env.IDEAL_POSTCODES_API_KEY
  if (!key) return res.status(500).json({ error: 'IDEAL_POSTCODES_API_KEY not configured' })

  const postcode = (req.query.postcode || '').toString().trim()
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(postcode)) return res.status(400).json({ error: 'Invalid postcode' })

  try {
    const r = await fetch(
      `https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(postcode)}?api_key=${encodeURIComponent(key)}`,
    )
    const data = await r.json()
    if (!r.ok || data.code !== 2000) {
      return res.status(404).json({ error: data.message || 'Postcode not found', addresses: [] })
    }
    const addresses = (data.result ?? []).map((a) => ({
      line1: [a.line_1, a.line_2].filter(Boolean).join(', '),
      line2: a.line_3 || '',
      postTown: a.post_town,
      postcode: a.postcode,
      full: [a.line_1, a.line_2, a.line_3, a.post_town, a.postcode].filter(Boolean).join(', '),
    }))
    return res.status(200).json({ addresses })
  } catch (e) {
    console.error('lookup-address failed', e instanceof Error ? e.message : 'Unknown error')
    return res.status(502).json({ error: safeError, addresses: [] })
  }
}
