import { guardApi, requireUser, safeError } from '../server/security.js'
import { buildInvoiceDocx, validateInvoiceDocxPayload } from '../server/canonicalInvoiceDocx.js'

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 500_000, limit: 20 })) return
  if (!(await requireUser(req, res, { adminOnly: true }))) return
  const body = req.body ?? {}
  const validationError = validateInvoiceDocxPayload(body)
  if (validationError) return res.status(400).json({ error: validationError })

  try {
    const output = buildInvoiceDocx(body)
    const safeNumber = String(body.invoice.invoiceNumber).replace(/[^a-zA-Z0-9_-]/g, '_')
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="Punjab-Invoice-${safeNumber}.docx"`)
    return res.status(200).send(output)
  } catch (error) {
    console.error('generate-invoice-docx failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
