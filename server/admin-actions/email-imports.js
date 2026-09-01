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
      // Stats always reflect the FULL table (not just the loaded page,
      // today, or the first batch) - three narrow columns, cheap even at a
      // few thousand rows (item 2).
      const { data: statusRows, error: countError } = await admin.from(table('email_imports')).select('status,document_type,invoice_id')
      if (countError) throw countError
      const counts = {}
      const byType = { invoice: 0, credit_note: 0, statement: 0 }
      const invoiceIds = []
      for (const row of statusRows) {
        counts[row.status] = (counts[row.status] ?? 0) + 1
        if (row.document_type && byType[row.document_type] !== undefined) byType[row.document_type] += 1
        if (row.invoice_id) invoiceIds.push(row.invoice_id)
      }
      // Missing-generated-PDF count, scoped to invoices this table actually
      // links to (not every invoice in the system) - reuses the same
      // pdfGenerationPending flag generateAndAttachCanonicalPdf writes.
      let missingPdfs = 0
      if (invoiceIds.length) {
        const { data: linkedInvoices } = await admin.from(table('invoices')).select('imported_metadata').in('id', [...new Set(invoiceIds)])
        missingPdfs = (linkedInvoices || []).filter(row => row.imported_metadata?.pdfGenerationPending).length
      }
      const stats = { total: statusRows.length, invoices: byType.invoice, creditNotes: byType.credit_note, statements: byType.statement, missingPdfs }

      const search = typeof req.query?.search === 'string' ? req.query.search.trim() : ''
      if (search) {
        const term = `%${search.replace(/[%_\\]/g, m => `\\${m}`)}%`
        const { data, error } = await admin.from(table('email_imports')).select('*')
          .or(`sender.ilike.${term},subject.ilike.${term},attachment_filename.ilike.${term},detected_customer_name.ilike.${term},detected_invoice_number.ilike.${term}`)
          .order('received_at', { ascending: false })
          .limit(500)
        if (error) throw error
        return res.status(200).json({ imports: data, hasMore: false, counts, total: statusRows.length, stats })
      }

      const before = typeof req.query?.before === 'string' ? req.query.before : ''
      const beforeId = typeof req.query?.beforeId === 'string' ? req.query.beforeId : ''
      const limitParam = Number(req.query?.limit)
      const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 200) : 100

      // Ordered by (received_at, id) and paged with a matching compound
      // cursor - several hundred rows can share the exact same received_at
      // (bulk historical imports), so a plain `received_at < before` cursor
      // would silently drop every tied row past whichever one happened to
      // land last on a page. `id` (text, unique) breaks the tie.
      let query = admin.from(table('email_imports')).select('*').order('received_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1)
      if (before && beforeId) query = query.or(`received_at.lt.${before},and(received_at.eq.${before},id.lt.${beforeId})`)
      else if (before) query = query.lte('received_at', before)
      const { data, error } = await query
      if (error) throw error
      const hasMore = data.length > limit
      const imports = hasMore ? data.slice(0, limit) : data
      return res.status(200).json({ imports, hasMore, counts, total: statusRows.length, stats })
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
