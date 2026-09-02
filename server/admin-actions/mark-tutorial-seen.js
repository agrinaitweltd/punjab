import { guardApi, requireUser, safeError } from '../security.js'
import { serviceClient } from '../runtime-mode.js'

// Self-service, non-sensitive: an admin can only ever mark their OWN
// tutorial as seen (matched by auth_user_id, never a passed-in id), so this
// needs no elevated permission check beyond being a signed-in admin.
export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 1_000, limit: 20, windowMs: 60_000 })) return
  const user = await requireUser(req, res, { adminOnly: true })
  if (!user) return
  try {
    const admin = serviceClient()
    const { error } = await admin.from('admin_staff').update({ tutorial_completed_at: new Date().toISOString() }).eq('auth_user_id', user.id)
    if (error) throw error
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('mark-tutorial-seen failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
