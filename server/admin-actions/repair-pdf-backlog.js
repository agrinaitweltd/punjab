// On-demand bulk repair for invoices whose generated PDF is missing, broken,
// or was produced by the pdf-lib fallback renderer while the Word-to-PDF
// converter (ConvertAPI) was down (items 2/3/9/14) - the same underlying
// generateAndAttachCanonicalPdf() the nightly health check and email import
// use, so a manual run and an automatic one behave identically. Regenerates
// ONLY the generated PDF: never re-imports, never creates a customer or
// invoice, never touches balances, never duplicates the original PDF.
//
// GET returns the backlog report (item 14) without changing anything.
// POST processes one batch (default 20, capped at 50) of affected invoices
// and reports what happened, so the caller can call it again for the next
// batch rather than risking one long request timing out (item 3).
import { guardApi, requireUser, safeError } from '../security.js'
import { serviceClient, globalTestMode, simulatedResult } from '../runtime-mode.js'
import { generateAndAttachCanonicalPdf } from '../email-import/create-records.js'

export const config = { maxDuration: 60 }

async function findBacklog(admin, table) {
  const { data: invoices, error } = await admin.from(table('invoices')).select('id,invoice_number,customer_id,canonical_document_id,canonical_pdf_provider')
  if (error) throw error
  const canonicalIds = invoices.map(i => i.canonical_document_id).filter(Boolean)
  const { data: canonicalFiles } = canonicalIds.length ? await admin.from(table('activity_log')).select('id').in('id', canonicalIds) : { data: [] }
  const existingCanonicalIds = new Set((canonicalFiles || []).map(f => f.id))
  const missing = invoices.filter(i => !i.canonical_document_id || !existingCanonicalIds.has(i.canonical_document_id))
  const fallback = invoices.filter(i => i.canonical_document_id && existingCanonicalIds.has(i.canonical_document_id) && i.canonical_pdf_provider && i.canonical_pdf_provider !== 'ConvertAPI')
  const proper = invoices.filter(i => i.canonical_document_id && existingCanonicalIds.has(i.canonical_document_id) && i.canonical_pdf_provider === 'ConvertAPI')
  return { totalChecked: invoices.length, alreadyHavePdf: proper.length, needingRepair: [...missing, ...fallback] }
}

export default async function handler(req, res) {
  if (!guardApi(req, res, { methods: ['GET', 'POST'], maxBytes: 4_000, limit: 15, windowMs: 60_000 })) return
  const user = await requireUser(req, res, { adminOnly: true })
  if (!user) return

  let admin
  try {
    admin = serviceClient()
  } catch {
    return res.status(500).json({ error: 'Secure administration is not configured.' })
  }

  try {
    const testMode = await globalTestMode(admin).catch(() => false)
    if (testMode) return res.status(200).json(simulatedResult('PDF backlog repair'))
    const table = name => (testMode ? `test_${name}` : name)

    if (req.method === 'GET') {
      const backlog = await findBacklog(admin, table)
      return res.status(200).json({
        ok: true, totalChecked: backlog.totalChecked, alreadyHavePdf: backlog.alreadyHavePdf,
        needingRepair: backlog.needingRepair.length,
      })
    }

    const batchSizeParam = Number(req.body?.batchSize)
    const batchSize = Number.isFinite(batchSizeParam) && batchSizeParam > 0 ? Math.min(Math.floor(batchSizeParam), 50) : 20

    const backlog = await findBacklog(admin, table)
    const batch = backlog.needingRepair.slice(0, batchSize)

    let regenerated = 0, stillFailed = 0
    const results = []
    for (const invoice of batch) {
      try {
        const [{ data: customer }, { data: items }] = await Promise.all([
          admin.from(table('customers')).select('*').eq('id', invoice.customer_id).maybeSingle(),
          admin.from(table('invoice_items')).select('*').eq('invoice_id', invoice.id),
        ])
        if (!customer) { stillFailed += 1; results.push({ invoiceNumber: invoice.invoice_number, ok: false, reason: 'No matching customer' }); continue }
        if (!items?.length) { stillFailed += 1; results.push({ invoiceNumber: invoice.invoice_number, ok: false, reason: 'No stored product line items' }); continue }
        const result = await generateAndAttachCanonicalPdf(admin, table, invoice, customer, items)
        if (result.usedFallback) { stillFailed += 1; results.push({ invoiceNumber: invoice.invoice_number, ok: false, reason: 'Converter still unavailable - fallback PDF in place' }) }
        else { regenerated += 1; results.push({ invoiceNumber: invoice.invoice_number, ok: true }) }
      } catch (error) {
        // One invoice's failure must never stop the rest of the batch (item 8).
        stillFailed += 1
        results.push({ invoiceNumber: invoice.invoice_number, ok: false, reason: error instanceof Error ? error.message.slice(0, 200) : 'Unknown error' })
      }
    }

    return res.status(200).json({
      ok: true, totalChecked: backlog.totalChecked, alreadyHavePdf: backlog.alreadyHavePdf,
      processed: batch.length, regenerated, stillFailed, remaining: backlog.needingRepair.length - batch.length,
      results,
    })
  } catch (error) {
    console.error('repair-pdf-backlog failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(502).json({ error: safeError })
  }
}
