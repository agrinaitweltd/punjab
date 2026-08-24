import { extractDocumentLines } from './statementImport'

export type FieldConfidence = 'high' | 'review' | 'missing'

export type ImportedInvoiceItem = {
  line: string
  quantity: number
  product: string
  variety: string
  size: string
  price: number
  goodsValue: number
  vatCode: string
  vatRate: number
  vatAmount?: number
}

export type ImportDocumentType = 'invoice' | 'credit_note'

export type ImportedLegacyInvoice = {
  documentType: 'invoice'
  customer: {
    companyName: string
    address: string
    postcode: string
    phone: string
    normalizedPhone: string
    email: string
    accountNumber: string
    ledgerBalance: number
  }
  invoice: {
    invoiceNumber: string
    invoiceAccount: string
    deliveryAccount: string
    salesman: string
    date: string
    currency: 'GBP'
    totalGoods: number
    vat: number
    grandTotal: number
    packages: number
  }
  items: ImportedInvoiceItem[]
  vatSummary: Array<{ code: string; rate: number; goods: number; vat: number }>
  confidence: Record<string, FieldConfidence>
  warnings: string[]
  debug: { rawLines: string[]; normalizedLines: string[] }
  source?: { name: string; type: string; size: number; dataUri: string }
}

export type ImportedCreditNote = {
  documentType: 'credit_note'
  customer: ImportedLegacyInvoice['customer']
  creditNote: {
    creditNumber: string
    date: string
    originalInvoiceReference: string
    deliveryAccount: string
    salesman: string
    currency: 'GBP'
    totalGoods: number
    vat: number
    grandTotal: number
    packages: number
  }
  items: ImportedInvoiceItem[]
  vatSummary: ImportedLegacyInvoice['vatSummary']
  confidence: Record<string, FieldConfidence>
  warnings: string[]
  debug: ImportedLegacyInvoice['debug']
  source?: ImportedLegacyInvoice['source']
}

export type ImportedFinancialDocument = ImportedLegacyInvoice | ImportedCreditNote

const money = (value = '') => Number(value.replace(/[^\d.-]/g, '')) || 0
const compact = (value = '') => value.replace(/\s+/g, ' ').trim()
const columns = (line = '') => line.trim().split(/\s{2,}/).map(compact).filter(Boolean)
const postcodePattern = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i

function afterLabel(lines: string[], label: RegExp): string {
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(label)
    if (!match) continue
    const sameLine = compact(lines[index].slice((match.index ?? 0) + match[0].length)).match(/-?[\d,]+(?:\.\d+)?/)
    if (sameLine) return sameLine[0]
    const nextLine = compact(lines[index + 1] ?? '').match(/-?[\d,]+(?:\.\d+)?/)
    if (nextLine) return nextLine[0]
  }
  return ''
}

function isoDate(value: string): string {
  const match = value.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/)
  if (!match) return ''
  const year = match[3].length === 2 ? `20${match[3]}` : match[3]
  return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
}

function normalizeUkPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (/^07\d{9}$/.test(digits)) return `+44${digits.slice(1)}`
  if (/^447\d{9}$/.test(digits)) return `+${digits}`
  return value.trim()
}

function customerSection(lines: string[]) {
  const companyIndex = lines.findIndex(line => /\b(?:LTD|LIMITED|PLC|LLP)\b/i.test(line) && !/Punjab Exotic Foods/i.test(line))
  const companyLine = compact(lines[companyIndex] ?? '')
  const companyName = compact(companyLine.match(/^.*?\b(?:LTD|LIMITED|PLC|LLP)\b/i)?.[0] ?? '')
  const phoneIndex = lines.findIndex((line, index) => index > companyIndex && /\b07\d(?:[\s-]?\d){8,9}\b/.test(line))
  const phone = compact(lines[phoneIndex] ?? '').match(/\b07\d(?:[\s-]?\d){8,9}\b/)?.[0] ?? ''
  const postcodes = lines.flatMap(line => [...line.matchAll(new RegExp(postcodePattern.source, 'gi'))].map(match => compact(match[1].toUpperCase())))
  const postcode = postcodes.find(value => !/^E10\s*5SQ$/i.test(value)) ?? ''
  const supplierAddress = /Punjab Exotic|New Spitalfields|Sherring Road|^Leyton$|^London$|E10\s*5SQ|^Tel:|^Fax:/i
  const addressLines = lines
    .slice(Math.max(0, companyIndex + 1), phoneIndex > companyIndex ? phoneIndex : companyIndex + 8)
    .map(compact)
    .filter(line => line && !supplierAddress.test(line) && !postcodePattern.test(line) && !/^\d{10,11}$/.test(line))
  return { companyName, address: addressLines.join(', '), postcode, phone, normalizedPhone: normalizeUkPhone(phone) }
}

function metadataSection(lines: string[]) {
  const headerIndex = lines.findIndex(line => /Delivery Acc/i.test(line) && /Date\/Tax Pt/i.test(line) && /\bNum\b/i.test(line))
  const values = lines.slice(headerIndex + 1, headerIndex + 4).find(line => /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(line)) ?? ''
  const dateToken = values.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/)?.[0] ?? ''
  const afterDate = dateToken ? values.slice(values.indexOf(dateToken) + dateToken.length) : ''
  const accountNumber = afterDate.match(/\b\d{6}\b/)?.[0] ?? ''
  const cells = columns(values)
  const deliveryAccount = cells[1] ?? ''
  const invoiceAccount = cells[2] ?? ''
  const salesman = cells[3] ?? ''
  const forbidden = new Set([deliveryAccount, salesman, accountNumber].filter(Boolean))
  let explicitInvoiceNumber = ''
  for (const line of lines) {
    const explicit = line.match(/\bInvoice\s*(?:No\.?|Number|Acc(?:ount)?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]{1,})\b/i)?.[1] ?? ''
    if (explicit && /\d/.test(explicit) && !forbidden.has(explicit)) { explicitInvoiceNumber = explicit; break }
  }
  // Punjab's legacy invoice labels its invoice number as "Invoice Acc".
  const invoiceNumber = explicitInvoiceNumber || invoiceAccount
  return { date: isoDate(dateToken), accountNumber, deliveryAccount, invoiceAccount, salesman, invoiceNumber }
}

function descriptiveCells(values: string[]) {
  const sizeIndex = values.findIndex(value => /\d\s*(?:KG|G|LB|L|ML|MM|CM)|\d+\+|\d+\s*[Xx]\s*\d+|BOX|CASE|PUNNET|EACH/i.test(value))
  if (sizeIndex >= 1) return {
    product: values.slice(0, Math.max(1, sizeIndex - 1)).join(' '),
    variety: values.slice(Math.max(1, sizeIndex - 1), sizeIndex).join(' '),
    size: values.slice(sizeIndex).join(' '),
  }
  if (values.length <= 3) return { product: values[0] ?? '', variety: values[1] ?? '', size: values[2] ?? '' }
  return { product: values.slice(0, -2).join(' '), variety: values.at(-2) ?? '', size: values.at(-1) ?? '' }
}

function parseProductRow(row: string): ImportedInvoiceItem | null {
  const match = row.match(/^\s*(\d+)\s+(-?\d+(?:\.\d+)?)\s+(.+?)\s+(-?[\d,.]+)\s+(-?[\d,.]+)(?:\s+([A-Z0-9.-]+))?\s*$/i)
  if (!match) return null
  const [, line, quantityToken, rawDescription, priceToken, goodsValueToken, vatCode = ''] = match
  let descriptionParts = columns(rawDescription)
  if (descriptionParts.length < 3) descriptionParts = compact(rawDescription).split(' ')
  const description = descriptiveCells(descriptionParts)
  return {
    line, quantity: money(quantityToken), ...description,
    price: money(priceToken), goodsValue: money(goodsValueToken),
    vatCode, vatRate: 0,
  }
}

export function productSection(lines: string[]): ImportedInvoiceItem[] {
  const headerIndex = lines.findIndex(line => /\bLine\b/i.test(line) && /\bQty\b/i.test(line) && /\bProduct\b/i.test(line) && /\bGoods\b/i.test(line))
  if (headerIndex < 0) return []
  const items: ImportedInvoiceItem[] = []
  for (const row of lines.slice(headerIndex + 1)) {
    if (/\bPACKAGES\b|Total\s+(?:Credit\s+)?Goods|Grand\s+Total|Credit\s+Total|\bVC\s+%?Rate\b|\bV\.A\.T\b/i.test(row)) break
    const parsed = parseProductRow(row)
    if (parsed) { items.push(parsed); continue }
    if (items.length && compact(row) && !/^(?:Page|E\.?&O\.?E|VAT Reg|Tel:|Fax:)/i.test(compact(row))) {
      items[items.length - 1].product = compact(`${items[items.length - 1].product} ${row}`)
    }
  }
  return items
}

function vatSection(lines: string[]) {
  const headerIndex = lines.findIndex(line => /\bVC\b/i.test(line) && /%Rate/i.test(line) && /V\.A\.T/i.test(line))
  if (headerIndex < 0) return []
  for (const row of lines.slice(headerIndex + 1, headerIndex + 4)) {
    let cells = columns(row)
    if (cells.length < 4) cells = compact(row).split(' ')
    if (cells.length >= 4 && cells.slice(0, 4).every(cell => /^-?[\d,.]+$/.test(cell))) {
      return [{ code: cells[0], rate: money(cells[1]), goods: money(cells[2]), vat: money(cells[3]) }]
    }
  }
  return []
}

function applyVatRates(items: ImportedInvoiceItem[], summary: Array<{ code: string; rate: number; goods: number; vat: number }>) {
  const rates = new Map(summary.map(row => [row.code.trim().toLowerCase(), row.rate]))
  for (const item of items) {
    item.vatRate = rates.get(item.vatCode.trim().toLowerCase()) ?? item.vatRate
    item.vatAmount = item.goodsValue * item.vatRate / 100
  }
}

function confidence(value: unknown): FieldConfidence {
  if (typeof value === 'number') return Number.isFinite(value) ? 'high' : 'missing'
  return String(value ?? '').trim() ? 'high' : 'missing'
}

export function parseLegacyInvoiceLines(rawLines: string[]): ImportedLegacyInvoice {
  const lines = rawLines.map(line => line.replace(/\u00a0/g, ' ')).filter(line => line.trim())
  const normalizedLines = lines.map(compact)
  const customer = customerSection(lines)
  const metadata = metadataSection(lines)
  const items = productSection(lines)
  const vatSummary = vatSection(lines)
  applyVatRates(items, vatSummary)
  const totalGoods = money(afterLabel(lines, /Total Goods\s*:?/i)) || items.reduce((sum, item) => sum + item.goodsValue, 0)
  const vat = money(afterLabel(lines, /Total V\.A\.T\s*:?/i)) || vatSummary.reduce((sum, row) => sum + row.vat, 0)
  const grandTotal = money(afterLabel(lines, /Grand Total\s*:?/i)) || totalGoods + vat
  const packages = money(lines.find(line => /\bPACKAGES\b/i.test(line))?.match(/\d+(?:\.\d+)?/)?.[0])
  const ledgerBalance = money(afterLabel(lines, /S\/L Balance\s*:?/i))
  const warnings: string[] = []
  if (!customer.companyName) warnings.push('Please check the customer company name.')
  if (!metadata.accountNumber) warnings.push('Please check the six-digit account number from the Num column.')
  if (!metadata.date) warnings.push('Please check the invoice date.')
  if (!items.length) warnings.push('No product rows were found. Add or correct the products before saving.')
  if (Math.abs(totalGoods + vat - grandTotal) > 0.02) warnings.push('The goods total plus VAT does not match the grand total.')
  if (items.length && Math.abs(items.reduce((sum, item) => sum + item.goodsValue, 0) - totalGoods) > 0.02) warnings.push('The product values do not match the goods total.')

  return {
    documentType: 'invoice',
    customer: { ...customer, email: '', accountNumber: metadata.accountNumber, ledgerBalance },
    invoice: { invoiceNumber: metadata.invoiceNumber, invoiceAccount: metadata.invoiceAccount, deliveryAccount: metadata.deliveryAccount, salesman: metadata.salesman, date: metadata.date, currency: 'GBP', totalGoods, vat, grandTotal, packages },
    items,
    vatSummary,
    confidence: {
      companyName: confidence(customer.companyName), address: confidence(customer.address), postcode: confidence(customer.postcode),
      phone: confidence(customer.phone), accountNumber: /^\d{6}$/.test(metadata.accountNumber) ? 'high' : 'review',
      invoiceNumber: metadata.invoiceNumber ? 'high' : 'missing', date: confidence(metadata.date), products: items.length ? 'high' : 'missing',
      totals: Math.abs(totalGoods + vat - grandTotal) <= 0.02 ? 'high' : 'review',
    },
    warnings,
    debug: { rawLines: lines, normalizedLines },
  }
}

export function detectImportDocumentType(rawLines: string[]): ImportDocumentType {
  const heading = rawLines.slice(0, 20).join(' ')
  return /\bCREDIT\s+(?:NOTE|MEMO|ADVICE)\b/i.test(heading) ? 'credit_note' : 'invoice'
}

export function parseCreditNoteLines(rawLines: string[]): ImportedCreditNote {
  const lines = rawLines.map(line => line.replace(/\u00a0/g, ' ')).filter(line => line.trim())
  const normalizedLines = lines.map(compact)
  const customer = customerSection(lines)
  const metadata = metadataSection(lines)
  const items = productSection(lines)
  const vatSummary = vatSection(lines)
  applyVatRates(items, vatSummary)
  const explicitNumber = normalizedLines.map(line =>
    line.match(/\b(?:Credit\s+(?:Note|Memo)\s+(?:No\.?|Number|#)|Credit\s+Number)\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]{1,})\b/i)?.[1]
      ?? line.match(/\b(C(?:N|R)[-/#]?\d[A-Z0-9/-]*)\b/i)?.[1]
  ).find(Boolean) ?? ''
  const originalInvoiceReference = normalizedLines.map(line => line.match(/\b(?:Original\s+Invoice|Invoice\s+Reference|Invoice\s+No\.?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]{1,})\b/i)?.[1]).find(Boolean) ?? ''
  const totalGoods = money(afterLabel(lines, /Total\s+(?:Credit\s+)?Goods\s*:?/i)) || items.reduce((sum, item) => sum + item.goodsValue, 0)
  const vat = money(afterLabel(lines, /Total\s+(?:V\.A\.T|VAT|Credit\s+VAT)\s*:?/i)) || vatSummary.reduce((sum, row) => sum + row.vat, 0)
  const grandTotal = money(afterLabel(lines, /(?:Grand\s+Total|Credit\s+Total|Total\s+Credit)(?!\s+(?:Goods|VAT|V\.A\.T))\s*:?/i)) || totalGoods + vat
  const packages = money(lines.find(line => /\bPACKAGES\b/i.test(line))?.match(/-?\d+(?:\.\d+)?/)?.[0])
  const ledgerBalance = money(afterLabel(lines, /S\/L Balance\s*:?/i))
  const warnings: string[] = []
  if (detectImportDocumentType(lines) !== 'credit_note') warnings.push('This document is not labelled as a credit note. Upload it through invoice import instead.')
  if (!customer.companyName) warnings.push('Please check the customer company name.')
  if (!metadata.accountNumber) warnings.push('Please check the customer account number.')
  if (!metadata.date) warnings.push('Please check the credit note date.')
  if (!items.length) warnings.push('No credited product rows were found.')
  if (Math.abs(totalGoods + vat - grandTotal) > 0.02) warnings.push('The credited goods plus VAT does not match the total credit.')
  return {
    documentType: 'credit_note',
    customer: { ...customer, email: '', accountNumber: metadata.accountNumber, ledgerBalance },
    creditNote: { creditNumber: explicitNumber, date: metadata.date, originalInvoiceReference, deliveryAccount: metadata.deliveryAccount, salesman: metadata.salesman, currency: 'GBP', totalGoods, vat, grandTotal, packages },
    items, vatSummary,
    confidence: { companyName: confidence(customer.companyName), accountNumber: confidence(metadata.accountNumber), creditNumber: confidence(explicitNumber), date: confidence(metadata.date), products: items.length ? 'high' : 'missing', totals: Math.abs(totalGoods + vat - grandTotal) <= 0.02 ? 'high' : 'review' },
    warnings,
    debug: { rawLines: lines, normalizedLines },
  }
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Could not read invoice file'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  })
}

export async function parseLegacyInvoice(file: File, onProgress?: (message: string) => void): Promise<ImportedLegacyInvoice> {
  const rawLines = await extractDocumentLines(file, onProgress)
  const parsed = parseLegacyInvoiceLines(rawLines)
  parsed.source = { name: file.name, type: file.type || 'application/pdf', size: file.size, dataUri: await fileToDataUri(file) }
  return parsed
}

export async function parseFinancialDocument(file: File, onProgress?: (message: string) => void): Promise<ImportedFinancialDocument> {
  const rawLines = await extractDocumentLines(file, onProgress)
  const parsed = detectImportDocumentType(rawLines) === 'credit_note' ? parseCreditNoteLines(rawLines) : parseLegacyInvoiceLines(rawLines)
  parsed.source = { name: file.name, type: file.type || 'application/pdf', size: file.size, dataUri: await fileToDataUri(file) }
  return parsed
}
