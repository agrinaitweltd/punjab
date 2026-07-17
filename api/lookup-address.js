// Vercel serverless function — keeps the Ideal Postcodes API key off the client.
// Set IDEAL_POSTCODES_API_KEY in Vercel -> Project -> Settings -> Environment Variables.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const key = process.env.IDEAL_POSTCODES_API_KEY
  if (!key) return res.status(500).json({ error: 'IDEAL_POSTCODES_API_KEY not configured' })

  const postcode = (req.query.postcode || '').toString().trim()
  if (!postcode) return res.status(400).json({ error: 'Missing postcode' })

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
    return res.status(502).json({ error: String(e), addresses: [] })
  }
}
