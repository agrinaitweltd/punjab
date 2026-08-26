import { guardApi, requireUser } from '../server/security.js'
import { convertDocxToPdf } from '../server/canonicalInvoicePdf.js'

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 4_200_000, limit: 15 })) return
  if (!(await requireUser(req, res, { adminOnly: true }))) return
  const { docxBase64, fileName, data } = req.body ?? {}
  if (!docxBase64 || String(docxBase64).length > 3_800_000 || !data?.invoice?.invoiceNumber || !Array.isArray(data?.items) || data.items.length > 100) return res.status(400).json({ error: 'Valid DOCX and invoice data are required' })
  const { buffer, provider } = await convertDocxToPdf(docxBase64, fileName, data)
  res.setHeader('X-PDF-Provider', provider)
  res.setHeader('Content-Type', 'application/pdf')
  return res.status(200).send(buffer)
}
