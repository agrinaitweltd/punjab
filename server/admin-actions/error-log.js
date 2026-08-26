import { guardApi, safeError } from '../security.js'
import { requireSystemDeveloper } from '../sensitive-actions.js'

export default async function handler(req, res) {
  if (!guardApi(req, res, { methods: ['GET', 'POST'], maxBytes: 2_000, limit: 30 })) return
  const context = await requireSystemDeveloper(req, res)
  if (!context) return
  const { admin } = context
  try {
    if (req.method === 'GET') {
      const { data, error } = await admin.from('application_error_log').select('*').order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return res.status(200).json({ errors: data })
    }
    const id = String(req.body?.id || '')
    const resolved = Boolean(req.body?.resolved)
    if (!id) return res.status(400).json({ error: 'Invalid request.' })
    const { error } = await admin.from('application_error_log').update({ resolved }).eq('id', id)
    if (error) throw error
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('error-log failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
