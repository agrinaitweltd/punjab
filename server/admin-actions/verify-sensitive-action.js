import { createClient } from '@supabase/supabase-js'
import { guardApi, requireUser } from '../security.js'
import { issueSensitiveToken } from '../sensitive-actions.js'

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 4_096, limit: 8, windowMs: 15 * 60_000 })) return
  const user = await requireUser(req, res, { adminOnly: true })
  if (!user) return
  const password = String(req.body?.password || '')
  if (!password || password.length > 256 || !user.email) return res.status(400).json({ error: 'Enter your current password.' })
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return res.status(500).json({ error: 'Authentication is not configured.' })
  const auth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await auth.auth.signInWithPassword({ email: user.email, password })
  if (error) return res.status(401).json({ error: 'That password is not correct.' })
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ token: issueSensitiveToken(user), expiresIn: 600 })
}
