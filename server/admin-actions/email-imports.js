import { guardApi, requireUser, safeError } from '../security.js'
import { serviceClient, globalTestMode } from '../runtime-mode.js'
import { retryEmailImport } from '../email-import/process-mailbox.js'

export default async function handler(req, res) {
  if (!guardApi(req, res, { methods: ['GET', 'POST'], maxBytes: 2_000, limit: 30 })) return
  const user = await requireUser(req, res, { adminOnly: true })
  if (!user) return

  const admin = serviceClient()
  const testMode = await globalTestMode(admin).catch(() => false)
  const table = name => (testMode ? `test_${name}` : name)

  try {
    if (req.method === 'GET') {
      const { data, error } = await admin.from(table('email_imports')).select('*').order('received_at', { ascending: false }).limit(300)
      if (error) throw error
      return res.status(200).json({ imports: data })
    }
    const id = String(req.body?.id || '')
    const customerId = req.body?.customerId ? String(req.body.customerId) : undefined
    if (!id) return res.status(400).json({ error: 'Invalid request.' })
    const result = await retryEmailImport(admin, table, id, customerId)
    return res.status(200).json({ ok: true, ...result })
  } catch (error) {
    console.error('email-imports action failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(error?.status || 400).json({ error: error instanceof Error ? error.message : safeError })
  }
}
