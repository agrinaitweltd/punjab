import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { guardApi, requireUser } from '../server/security.js'

const clean = value => String(value ?? '').replace(/[\r\n]+/g, ' ').trim()
const money = value => `GBP ${Number(value || 0).toFixed(2)}`

async function renderFallback(data) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const green = rgb(0.08, 0.31, 0.17)
  const muted = rgb(0.36, 0.42, 0.39)
  page.drawRectangle({ x: 0, y: 802, width: 595, height: 40, color: green })
  page.drawText('PUNJAB EXOTIC FOODS LIMITED', { x: 36, y: 770, size: 20, font: bold, color: green })
  page.drawText('INVOICE', { x: 452, y: 770, size: 18, font: bold, color: green })
  const customer = data.customer ?? {}
  const invoice = data.invoice ?? {}
  page.drawText(clean(customer.name), { x: 36, y: 727, size: 13, font: bold })
  page.drawText(clean(customer.address), { x: 36, y: 708, size: 10, font: regular, color: muted })
  page.drawText(`Account: ${clean(customer.accountNumber)}`, { x: 36, y: 690, size: 10, font: regular })
  page.drawText(`Invoice: ${clean(invoice.invoiceNumber)}`, { x: 370, y: 727, size: 10, font: bold })
  page.drawText(`Date: ${clean(invoice.date)}`, { x: 370, y: 708, size: 10, font: regular })
  page.drawText(`Packages: ${clean(invoice.packages)}`, { x: 370, y: 690, size: 10, font: regular })
  const headers = [['Line', 36], ['Qty', 82], ['Product', 120], ['Variety', 292], ['Size', 375], ['Price', 425], ['Goods', 500]]
  page.drawRectangle({ x: 32, y: 648, width: 531, height: 25, color: rgb(0.94, 0.97, 0.95) })
  for (const [label, x] of headers) page.drawText(label, { x, y: 657, size: 8, font: bold, color: green })
  let y = 628
  for (const item of (data.items ?? []).slice(0, 22)) {
    const goods = Number(item.qty || 0) * Number(item.price || 0)
    const values = [[item.line, 36], [item.qty, 82], [clean(item.product).slice(0, 27), 120], [clean(item.variety).slice(0, 13), 292], [clean(item.size).slice(0, 8), 375], [Number(item.price || 0).toFixed(2), 425], [goods.toFixed(2), 500]]
    for (const [value, x] of values) page.drawText(String(value ?? ''), { x, y, size: 8.5, font: regular })
    page.drawLine({ start: { x: 32, y: y - 6 }, end: { x: 563, y: y - 6 }, thickness: 0.4, color: rgb(0.87, 0.89, 0.88) })
    y -= 24
  }
  const totalY = Math.max(90, y - 35)
  page.drawText(`Total Goods: ${money(invoice.totalGoods)}`, { x: 380, y: totalY, size: 10, font: regular })
  page.drawText(`VAT: ${money(invoice.vatTotal)}`, { x: 380, y: totalY - 20, size: 10, font: regular })
  page.drawText(`Grand Total: ${money(invoice.grandTotal)}`, { x: 380, y: totalY - 46, size: 13, font: bold, color: green })
  page.drawText('Punjab Exotic Foods Limited | New Spitalfields Market, London E10 5SQ', { x: 36, y: 34, size: 8, font: regular, color: muted })
  return Buffer.from(await pdf.save())
}

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 4_200_000, limit: 15 })) return
  if (!(await requireUser(req, res, { adminOnly: true }))) return
  const { docxBase64, fileName, data } = req.body ?? {}
  if (!docxBase64 || String(docxBase64).length > 3_800_000 || !data?.invoice?.invoiceNumber || !Array.isArray(data?.items) || data.items.length > 100) return res.status(400).json({ error: 'Valid DOCX and invoice data are required' })
  const token = process.env.CONVERTAPI_TOKEN
  if (token) {
    try {
      const response = await fetch('https://v2.convertapi.com/convert/docx/to/pdf', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ Parameters: [{ Name: 'File', FileValue: { Name: fileName || 'invoice.docx', Data: docxBase64 } }] }),
      })
      const result = await response.json()
      const encoded = result?.Files?.[0]?.FileData
      if (!response.ok || !encoded) throw new Error(result?.Message || 'ConvertAPI returned no PDF')
      res.setHeader('X-PDF-Provider', 'ConvertAPI')
      res.setHeader('Content-Type', 'application/pdf')
      return res.status(200).send(Buffer.from(encoded, 'base64'))
    } catch (error) {
      console.error('ConvertAPI conversion failed; using PDF renderer', error)
    }
  }
  const pdf = await renderFallback(data)
  res.setHeader('X-PDF-Provider', 'pdf-lib-fallback')
  res.setHeader('Content-Type', 'application/pdf')
  return res.status(200).send(pdf)
}
