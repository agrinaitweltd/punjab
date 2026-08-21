import { createClient } from '@supabase/supabase-js'
import { guardApi, requireUser, safeError } from '../server/security.js'

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 2_048, limit: 8 })) return
  const user = await requireUser(req, res)
  if (!user) return
  const url = process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(500).json({ error: 'Account setup is not configured.' })
  try {
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const table = ['admin', 'system_developer'].includes(user.app_metadata?.role) ? 'admin_staff' : 'customers'
    const update = await admin.from(table).update({ ...(table === 'admin_staff' ? { invitation_status: 'Accepted' } : {}) }).eq('auth_user_id', user.id)
    if (update.error) throw update.error
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('complete-account-setup failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
