import { guardApi, requireUser, safeError } from '../security.js'
import { serviceClient, globalTestMode } from '../runtime-mode.js'
import { retryEmailImport } from '../email-import/process-mailbox.js'
import { getReviewDocument, approveReview, rejectReview } from '../email-import/review.js'

export default async function handler(req, res) {
  // A full edited document (line items, corrected text) is a few KB, larger
  // than the plain retry/list payloads this endpoint used to handle alone.
  if (!guardApi(req, res, { methods: ['GET', 'POST'], maxBytes: 200_000, limit: 30 })) return
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

    const op = String(req.body?.op || 'retry')
    const id = String(req.body?.id || '')
    if (!id) return res.status(400).json({ error: 'Invalid request.' })

    if (op === 'get-review') {
      const result = await getReviewDocument(admin, table, id)
      return res.status(200).json({ ok: true, ...result })
    }
    if (op === 'approve') {
      if (!req.body?.document) return res.status(400).json({ error: 'Missing document.' })
      const customerId = req.body?.customerId ? String(req.body.customerId) : undefined
      const result = await approveReview(admin, table, id, req.body.document, { customerId, reviewerName: user.email })
      return res.status(200).json({ ok: true, ...result })
    }
    if (op === 'reject') {
      const result = await rejectReview(admin, table, id, req.body?.reason, user.email)
      return res.status(200).json({ ok: true, ...result })
    }

    const customerId = req.body?.customerId ? String(req.body.customerId) : undefined
    const result = await retryEmailImport(admin, table, id, customerId)
    return res.status(200).json({ ok: true, ...result })
  } catch (error) {
    console.error('email-imports action failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(error?.status || 400).json({ error: error instanceof Error ? error.message : safeError })
  }
}
