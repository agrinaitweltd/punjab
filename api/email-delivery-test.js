import { timingSafeEqual } from 'node:crypto'
import { guardApi } from '../server/security.js'
import { serviceClient } from '../server/runtime-mode.js'
import { runEmailTestSuite } from '../server/admin-actions/test-email-suite.js'

const matches = (left, right) => {
  const first = Buffer.from(String(left || ''))
  const second = Buffer.from(String(right || ''))
  return first.length === second.length && first.length > 0 && timingSafeEqual(first, second)
}

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 256, limit: 1, windowMs: 60 * 60_000 })) return
  const configured = process.env.EMAIL_TEST_TOKEN
  if (!configured || !matches(String(req.headers?.authorization || '').replace(/^Bearer\s+/i, ''), configured)) return res.status(404).json({ error: 'Not found' })
  const { results } = await runEmailTestSuite(serviceClient(), 'One-time production readiness test')
  return res.status(results.every(item => item.ok) ? 200 : 207).json({ recipient: 'info@kavotech.uk', results })
}
