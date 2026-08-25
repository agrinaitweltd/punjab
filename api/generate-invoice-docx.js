import fs from 'node:fs'
import path from 'node:path'
import PizZip from 'pizzip'
import { guardApi, requireUser, safeError } from '../server/security.js'

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
const money = (value) => Number(value || 0).toFixed(2)
const replaceToken = (xml, token, value) => {
  const pattern = [...token].map(char => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(?:<[^>]+>)*')
  return xml.replace(new RegExp(pattern, 'g'), esc(value))
}

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 500_000, limit: 20 })) return
  if (!(await requireUser(req, res, { adminOnly: true }))) return
  const body = req.body ?? {}
  if (!body.customer?.name || !/^\d{6}$/.test(String(body.customer?.accountNumber ?? ''))) return res.status(400).json({ error: 'A customer name and six-digit account number are required' })
  if (!body.invoice?.invoiceNumber || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) return res.status(400).json({ error: 'Invoice number and 1-100 product rows are required' })

  try {
    const template = fs.readFileSync(path.join(process.cwd(), 'Punjab Invoice Template.docx'))
    const zip = new PizZip(template)
    let xml = zip.file('word/document.xml').asText()
    const rowMarker = '<w:t>[LINE]</w:t>'
    const markerIndex = xml.indexOf(rowMarker)
    if (markerIndex < 0) throw new Error('Product row placeholder is missing from the master template')
    // Plain lastIndexOf('<w:tr', ...) also matches sibling tags like
    // <w:trPr>/<w:trHeight> that share the prefix, truncating the captured
    // row and leaving an unmatched </w:tr> per clone - corrupts the OOXML
    // enough that Word/ConvertAPI reject the file outright.
    const rowOpenTags = [...xml.slice(0, markerIndex).matchAll(/<w:tr(?=[ >])/g)]
    const rowStart = rowOpenTags.length ? rowOpenTags.at(-1).index : -1
    if (rowStart < 0) throw new Error('Product row start tag is missing from the master template')
    const rowEnd = xml.indexOf('</w:tr>', markerIndex) + '</w:tr>'.length
    const productRow = xml.slice(rowStart, rowEnd)
    const productRows = body.items.map(item => {
      const goods = Math.max(0, Number(item.qty) || 0) * Math.max(0, Number(item.price) || 0)
      let row = productRow
      for (const [token, value] of Object.entries({ '[LINE]': item.line, '[QTY]': item.qty, '[PRODUCT]': item.product, '[VARIETY]': item.variety, '[SIZE]': item.size, '[PRICE]': money(item.price), '[GOODS VC]': money(goods) })) row = replaceToken(row, token, value)
      return row
    }).join('')
    xml = xml.slice(0, rowStart) + productRows + xml.slice(rowEnd)

    const vatGroups = new Map()
    for (const item of body.items) {
      const rate = Math.max(0, Number(item.vatRate) || 0)
      const goods = Math.max(0, Number(item.qty) || 0) * Math.max(0, Number(item.price) || 0)
      vatGroups.set(rate, (vatGroups.get(rate) ?? 0) + goods)
    }
    const vat = [...vatGroups.entries()].map(([rate, goods]) => ({ rate, goods, tax: goods * rate / 100 }))
    const replacements = {
      '[CUSTOMER NAME]': body.customer.name, '[ADDRESS LINE 1]': body.customer.addressLine1, '[ADDRESS LINE 2]': body.customer.addressLine2,
      '[POSTCODE]': body.customer.postcode, '[CUSTOMER PHONE]': body.customer.phone, '[BALANCE]': money(body.customer.balance),
      '[ACCOUNT NO]': body.customer.accountNumber, '[DATE / TAX POINT]': body.invoice.date, '[INVOICE NO]': body.invoice.invoiceNumber,
      '[NO. OF PACKAGES]': body.invoice.packages, '[VC]': vat.map(v => v.rate === 0 ? '0' : String(v.rate)).join(' / '),
      '[RATE]': vat.map(v => `${v.rate.toFixed(2)}%`).join(' / '), '[GOODS]': vat.map(v => money(v.goods)).join(' / '), '[VAT]': vat.map(v => money(v.tax)).join(' / '),
      '[TOTAL GOODS]': money(body.invoice.totalGoods), '[TOTAL VAT]': money(body.invoice.vatTotal), '[GRAND TOTAL]': money(body.invoice.grandTotal),
    }
    for (const [key, value] of Object.entries(replacements)) xml = replaceToken(xml, key, value)
    zip.file('word/document.xml', xml)
    const output = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
    const safeNumber = String(body.invoice.invoiceNumber).replace(/[^a-zA-Z0-9_-]/g, '_')
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="Punjab-Invoice-${safeNumber}.docx"`)
    return res.status(200).send(output)
  } catch (error) {
    console.error('generate-invoice-docx failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
