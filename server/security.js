import { createClient } from '@supabase/supabase-js'

const windows = new Map()

const requestHost = req => String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim().toLowerCase()
const sourceHost = req => {
  const source = req.headers?.origin || req.headers?.referer
  if (!source) return ''
  try { return new URL(source).host.toLowerCase() } catch { return '' }
}
const clientIp = req => String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()

export function guardApi(req, res, { methods = ['POST'], maxBytes = 1024 * 1024, limit = 30, windowMs = 60_000 } = {}) {
  if (!methods.includes(req.method)) { res.setHeader('Allow', methods.join(', ')); res.status(405).json({ error: 'Method not allowed' }); return false }
  if (Number(req.headers?.['content-length'] || 0) > maxBytes) { res.status(413).json({ error: 'Request too large' }); return false }
  const host = requestHost(req)
  if (process.env.NODE_ENV === 'production' && (!host || sourceHost(req) !== host)) { res.status(403).json({ error: 'Request origin not allowed' }); return false }
  const now = Date.now(), key = `${clientIp(req)}:${req.url || ''}`, current = windows.get(key)
  const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current
  entry.count += 1; windows.set(key, entry)
  res.setHeader('X-RateLimit-Limit', String(limit)); res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - entry.count)))
  if (entry.count > limit) { res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000))); res.status(429).json({ error: 'Too many requests' }); return false }
  return true
}

export const safeError = 'The request could not be completed.'

export async function requireUser(req, res, { adminOnly = false } = {}) {
  if (process.env.NODE_ENV === 'test' && req.testUser) return req.testUser
  const match = String(req.headers?.authorization || '').match(/^Bearer\s+(.+)$/i)
  if (!match) { res.status(401).json({ error: 'Authentication required' }); return null }
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) { res.status(500).json({ error: 'Authentication is not configured' }); return null }
  try {
    const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data, error } = await client.auth.getUser(match[1])
    if (error || !data.user) { res.status(401).json({ error: 'Authentication required' }); return null }
    if (adminOnly && !['admin', 'system_developer'].includes(data.user.app_metadata?.role)) { res.status(403).json({ error: 'Administrator access required' }); return null }
    return data.user
  } catch {
    res.status(401).json({ error: 'Authentication required' })
    return null
  }
}
