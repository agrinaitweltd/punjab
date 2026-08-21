import { guardApi, requireUser, safeError } from '../security.js'
import { requireSensitiveStaff, writeSystemAudit } from '../sensitive-actions.js'
import { randomUUID } from 'node:crypto'

export default async function handler(req, res) {
  if (!guardApi(req, res, { methods: ['GET', 'POST'], maxBytes: 4_096, limit: 20 })) return
  if (req.method === 'GET') {
    const user = await requireUser(req, res)
    if (!user) return
    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return res.status(500).json({ error: 'System mode is not configured.' })
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data, error } = await admin.from('system_settings').select('test_mode,test_mode_changed_at,test_mode_generation,test_mode_started_at').eq('id', true).maybeSingle()
    if (error) return res.status(500).json({ error: safeError })
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ testMode: Boolean(data?.test_mode), changedAt: data?.test_mode_changed_at || null, generation: data?.test_mode_generation || null, startedAt: data?.test_mode_started_at || null })
  }
  const context = await requireSensitiveStaff(req, res, { systemDeveloperOnly: true })
  if (!context) return
  const enabled = Boolean(req.body?.enabled)
  try {
    const { admin, user } = context
    const current = await admin.from('system_settings').select('test_mode').eq('id', true).single()
    if (current.error) throw current.error
    if (Boolean(current.data.test_mode) === enabled) return res.status(200).json({ ok: true, testMode: enabled, unchanged: true })
    const now = new Date().toISOString()
    let snapshot = null
    if (enabled) {
      const prepared = await admin.rpc('prepare_test_mode_data')
      if (prepared.error) throw prepared.error
      snapshot = prepared.data
    }
    const update = await admin.from('system_settings').update({
      test_mode: enabled,
      test_mode_changed_at: now,
      test_mode_changed_by: user.id,
      test_mode_generation: enabled ? randomUUID() : null,
      test_mode_started_at: enabled ? now : null,
      updated_at: now,
    }).eq('id', true)
    if (update.error) throw update.error
    if (!enabled) {
      const reset = await admin.rpc('reset_test_mode_data')
      if (reset.error) throw reset.error
      const emptied = await admin.storage.emptyBucket('test-documents')
      if (emptied.error && !/not found/i.test(emptied.error.message)) throw emptied.error
    }
    await writeSystemAudit(admin, user.id, enabled ? 'test_mode_enabled' : 'test_mode_disabled', 'system_settings', 'global', { snapshot })
    return res.status(200).json({ ok: true, testMode: enabled, snapshot })
  } catch (error) {
    console.error('system-mode failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
