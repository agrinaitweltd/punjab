import { guardApi, requireUser, safeError } from '../server/security.js'
import { requireSensitiveStaff, writeSystemAudit } from '../server/sensitive-actions.js'

export default async function handler(req, res) {
  if (!guardApi(req, res, { methods: ['GET', 'POST'], maxBytes: 4_096, limit: 20 })) return
  if (req.method === 'GET') {
    const user = await requireUser(req, res)
    if (!user) return
    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return res.status(500).json({ error: 'System mode is not configured.' })
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data, error } = await admin.from('system_settings').select('test_mode,test_mode_changed_at').eq('id', true).maybeSingle()
    if (error) return res.status(500).json({ error: safeError })
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ testMode: Boolean(data?.test_mode), changedAt: data?.test_mode_changed_at || null })
  }
  const context = await requireSensitiveStaff(req, res, { systemDeveloperOnly: true })
  if (!context) return
  const enabled = Boolean(req.body?.enabled)
  if (enabled) {
    return res.status(409).json({ error: 'Test Mode is locked until the separate test-data adapter has been implemented and verified.' })
  }
  try {
    const { admin, user } = context
    const update = await admin.from('system_settings').update({ test_mode: enabled, test_mode_changed_at: new Date().toISOString(), test_mode_changed_by: user.id, updated_at: new Date().toISOString() }).eq('id', true)
    if (update.error) throw update.error
    await writeSystemAudit(admin, user.id, enabled ? 'test_mode_enabled' : 'test_mode_disabled', 'system_settings', 'global', {})
    return res.status(200).json({ ok: true, testMode: enabled })
  } catch (error) {
    console.error('system-mode failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
