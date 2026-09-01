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
  /** Set only for invoices (never credit notes, where negatives are a
      legitimate part of the source accounting document) when quantity,
      price, or goods value is negative - almost always a PDF
      extraction/sign artefact on an invoice, but never silently flipped:
      surfaced to the admin in Review Invoice to confirm before approval. */
  suspiciousNegative?: boolean
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

// Rounding/decimal-formatting tolerance for reconciling Total Goods + Total
// VAT against the printed Grand Total. Below this, the numbers are treated
// as matching (no warning at all). Above it, the document may still have a
// genuine extra charge (e.g. porterage) not folded into "Total Goods" - the
// printed Grand Total is still trusted and used, and a warning is recorded
// for admin review rather than the import being blocked (see assessConfidence
// in server/email-import/create-records.js, which treats a totals mismatch
// as informational, never a reason to refuse the whole invoice).
const TOTALS_TOLERANCE = 0.05
// A bare "1" as an account/invoice number is never a real Punjab reference
// (real ones are multi-digit, e.g. 2815, 1001) - it's what a misaligned
// column or a stray page/line number produces when extraction goes wrong.
// Exact match only, so real references that merely contain a "1" (2815,
// 1001, 21, 11...) are never affected.
export const isInvalidReferenceValue = (value: string) => value.trim() === '1'
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

const ledgerLine = /^S\/L Balance/i
// Punjab's own letterhead, printed in a right-hand column that lands on the
// SAME extracted line as the customer's own left-hand-column text whenever
// their vertical positions coincide (e.g. "SAEED GATE8 GU06 ... Stand 1B New
// Spitalfields Mkt" comes out as one merged line) - each pattern here must
// be specific enough to mark exactly where the supplier's text starts within
// such a merged line, not just "does this line contain supplier text".
const supplierAddress = /Punjab Exotic|Stand\s*1B|New Spitalfields|Sherring Road|^Leyton$|^London$|E10\s*5SQ|^Tel:|^Fax:/i
// The "INVOICE" / "CREDIT NOTE" / "CUSTOMER COPY" banner is its own row,
// with nothing in the customer's column at that height - must never be
// mistaken for the customer's own name. A reprinted invoice can prefix this
// with REISSUED/DUPLICATE/ORIGINAL (e.g. "REISSUED INVOICE CUSTOMER COPY",
// confirmed on a real production document), so those are matched too rather
// than assuming the banner is always exactly "INVOICE"/"CREDIT NOTE".
const documentBanner = /^\s*(?:REISSUED\s+|DUPLICATE\s+|ORIGINAL\s+|COPY\s+)*(?:INVOICE|CREDIT\s+NOTE)?\s*CUSTOMER\s*COPY\s*$|^\s*(?:REISSUED\s+|DUPLICATE\s+|ORIGINAL\s+)*(?:INVOICE|CREDIT\s+NOTE)\s*$/i

/** The portion of a (possibly column-merged) line that belongs to the
 *  customer, i.e. everything before any known supplier-letterhead text. */
function customerSegment(line: string): string {
  const match = line.match(supplierAddress)
  return compact(match ? line.slice(0, match.index) : line)
}

function customerSection(lines: string[]) {
  let companyIndex = lines.findIndex(line => /\b(?:LTD|LIMITED|PLC|LLP)\b/i.test(line) && !/Punjab Exotic Foods/i.test(line))
  let companyName = compact(compact(lines[companyIndex] ?? '').match(/^.*?\b(?:LTD|LIMITED|PLC|LLP)\b/i)?.[0] ?? '')

  // Not every genuine Punjab customer trades as a formal LTD/LIMITED/PLC/LLP
  // company - some are printed as just a trading name plus a market
  // gate/stand/unit number (e.g. "SAEED GATE8 GU06"), with no company suffix
  // at all. Fall back to the first line that has real, non-supplier,
  // non-banner content in it, wherever in the document it falls - a short
  // trading name is still a valid, safe identifier, same as a gate number is
  // still valid (if limited) address information.
  if (companyIndex < 0) {
    for (let index = 0; index < lines.length; index += 1) {
      if (documentBanner.test(compact(lines[index])) || ledgerLine.test(compact(lines[index]))) continue
      const segment = customerSegment(lines[index])
      if (segment) { companyIndex = index; companyName = segment; break }
    }
  }

  const phoneIndex = lines.findIndex((line, index) => index > companyIndex && /\b07\d(?:[\s-]?\d){8,9}\b/.test(line))
  const phone = compact(lines[phoneIndex] ?? '').match(/\b07\d(?:[\s-]?\d){8,9}\b/)?.[0] ?? ''
  const postcodes = lines.flatMap(line => [...line.matchAll(new RegExp(postcodePattern.source, 'gi'))].map(match => compact(match[1].toUpperCase())))
  const postcode = postcodes.find(value => !/^E10\s*5SQ$/i.test(value)) ?? ''
  // A one-line (or zero-line) address is completely acceptable - genuine
  // invoices for market/cash-account customers often have nothing more than
  // a gate or stand number here, and that must not be treated as a parsing
  // failure.
  const addressLines = lines
    .slice(Math.max(0, companyIndex + 1), phoneIndex > companyIndex ? phoneIndex : companyIndex + 8)
    .map(compact)
    .filter(line => line && !supplierAddress.test(line) && !postcodePattern.test(line) && !/^\d{10,11}$/.test(line) && !ledgerLine.test(line))
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
  if (isInvalidReferenceValue(metadata.invoiceNumber)) warnings.push('Invoice number was extracted as "1", which is not a valid reference - please check and correct it.')
  if (Math.abs(totalGoods + vat - grandTotal) > TOTALS_TOLERANCE) warnings.push('The goods total plus VAT does not match the grand total - the printed Grand Total has been used as-is.')
  if (items.length && Math.abs(items.reduce((sum, item) => sum + item.goodsValue, 0) - totalGoods) > TOTALS_TOLERANCE) warnings.push('The product values do not match the goods total - the printed Total Goods has been used as-is.')

  // A negative quantity/price/goods value on an INVOICE is usually
  // INTENTIONAL, not an extraction artefact: Punjab's system re-prices a
  // line by posting a reversal line (negative, at the old price) followed
  // immediately by the corrected line (positive, at the new price), and the
  // printed totals already account for both. Verified against real
  // production invoices - e.g. "-120 VINE TOMATO @ 7.00 = -840" followed by
  // "120 VINE TOMATO @ 6.00 = 720", printed Total Goods -120.
  //
  // So negatives are only treated as suspicious when the line values do NOT
  // reconcile with the printed Total Goods - i.e. when the sign really does
  // look like a parsing artefact rather than a deliberate reversal.
  // Flipping every negative to positive unconditionally would turn genuine
  // credits into charges (that VINE TOMATO example would become a £1,560
  // charge instead of a £120 credit), so it is never done automatically.
  // Credit notes are parsed separately and never get this treatment at all.
  const itemsGoodsSum = items.reduce((sum, item) => sum + item.goodsValue, 0)
  const linesReconcile = items.length > 0 && Math.abs(itemsGoodsSum - totalGoods) <= TOTALS_TOLERANCE
  const negativeItems = items.filter(item => item.quantity < 0 || item.price < 0 || item.goodsValue < 0)
  if (negativeItems.length && !linesReconcile) {
    for (const item of negativeItems) item.suspiciousNegative = true
    warnings.push(`Negative quantity/price/goods value on line(s) ${negativeItems.map(i => i.line).join(', ')} does not reconcile with the printed Total Goods - confirm during review before approving.`)
  }

  return {
    documentType: 'invoice',
    customer: { ...customer, email: '', accountNumber: metadata.accountNumber, ledgerBalance },
    invoice: { invoiceNumber: metadata.invoiceNumber, invoiceAccount: metadata.invoiceAccount, deliveryAccount: metadata.deliveryAccount, salesman: metadata.salesman, date: metadata.date, currency: 'GBP', totalGoods, vat, grandTotal, packages },
    items,
    vatSummary,
    confidence: {
      companyName: confidence(customer.companyName), address: confidence(customer.address), postcode: confidence(customer.postcode),
      phone: confidence(customer.phone), accountNumber: /^\d{6}$/.test(metadata.accountNumber) ? 'high' : 'review',
      invoiceNumber: !metadata.invoiceNumber ? 'missing' : isInvalidReferenceValue(metadata.invoiceNumber) ? 'review' : 'high', date: confidence(metadata.date), products: items.length ? 'high' : 'missing',
      totals: Math.abs(totalGoods + vat - grandTotal) <= TOTALS_TOLERANCE ? 'high' : 'review',
    },
    warnings,
    debug: { rawLines: lines, normalizedLines },
  }
}

// A second, distinct Punjab invoice layout (seen first from customer "IMRAN
// GATE 4", account 2525) - printed by a different till/system than the
// legacy "Line Qty Product Variety Size Price Goods VC" template above, with
// its own header wording, its own metadata row, and a VAT summary table
// whose columns are in a different order (VC, Goods, VAT Rate, VAT Amount -
// legacy is VC, %Rate, Goods, V.A.T). Detected and parsed separately rather
// than shoehorned into the legacy functions, since column order and layout
// differ enough that sharing the same regex would risk misreading one
// template while "fixing" the other.
const modernRowPattern = /^\s*(\S+)\s+(.+?)\s+(-?\d+(?:\.\d+)?)\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(\d+)\s*$/

export function recogniseModernInvoiceTemplate(rawLines: string[]): boolean {
  const heading = rawLines.slice(0, 10).join(' ')
  return /DELIVER\s*&\s*INVOICE\s*TO/i.test(heading) && rawLines.some(line => /Prod\s*Code/i.test(line)) && rawLines.some(line => /Nett\s*Val/i.test(line))
}

function modernCustomerName(lines: string[]): string {
  const index = lines.findIndex(line => /DELIVER\s*&\s*INVOICE\s*TO/i.test(line))
  if (index < 0) return ''
  for (let i = index + 1; i < Math.min(lines.length, index + 4); i += 1) {
    const value = compact(lines[i])
    if (value && !/^Copy\s+Invoice$/i.test(value)) return value
  }
  return ''
}

function modernMetadataSection(lines: string[]) {
  const headerIndex = lines.findIndex(line => /AccountNo/i.test(line) && /Inv\.?\s*Acc/i.test(line) && /InvoiceNo/i.test(line))
  const values = lines.slice(headerIndex + 1, headerIndex + 3).find(line => /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line)) ?? ''
  const dateToken = values.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/)?.[0] ?? ''
  const accountNumber = values.match(/\d+/)?.[0] ?? ''
  const afterDate = dateToken ? values.slice(values.indexOf(dateToken) + dateToken.length) : ''
  const invoiceNumber = afterDate.match(/\d+/)?.[0] ?? ''
  return { date: isoDate(dateToken), accountNumber, invoiceAccount: accountNumber, invoiceNumber }
}

// Deliberately kept as one combined field rather than split into
// product/variety/size like the legacy template: the row's only unambiguous
// boundary is its four trailing numeric columns (quantity/price/nett/VC).
// Everything before that - product code, description, and an optional
// "Origin" token (e.g. "VAR") - has no reliable separator, and guessing one
// (e.g. treating a trailing short word as an origin code) risks silently
// truncating a genuine description that happens to end the same way. Origin
// has no effect on pricing or totals, so the cosmetic imprecision of leaving
// it inside the product text is a safe trade against a financial misparse.
function parseModernProductRow(row: string): ImportedInvoiceItem | null {
  const match = row.match(modernRowPattern)
  if (!match) return null
  const [, prodCode, description, quantityToken, priceToken, goodsValueToken, vatCode] = match
  return {
    line: '', quantity: money(quantityToken),
    product: compact(`${prodCode} ${description}`), variety: '', size: '',
    price: money(priceToken), goodsValue: money(goodsValueToken),
    vatCode, vatRate: 0,
  }
}

function modernProductSection(lines: string[]): ImportedInvoiceItem[] {
  const headerIndex = lines.findIndex(line => /Prod\s*Code/i.test(line) && /Description/i.test(line) && /Nett\s*Val/i.test(line))
  if (headerIndex < 0) return []
  const items: ImportedInvoiceItem[] = []
  for (const row of lines.slice(headerIndex + 1)) {
    if (/\bVC\b\s+GOODS\s+VAT\s*RATE\s+VAT\s*AMOUNT/i.test(compact(row)) || /VAT Reg/i.test(row)) break
    const parsed = parseModernProductRow(row)
    if (parsed) { items.push(parsed); continue }
    if (items.length && compact(row) && !/^(?:Page|E\.?&O\.?E|VAT Reg|Tel:|Fax:)/i.test(compact(row))) {
      items[items.length - 1].product = compact(`${items[items.length - 1].product} ${row}`)
    }
  }
  items.forEach((item, index) => { item.line = String(index + 1) })
  return items
}

// The modern template's VAT summary is a fixed 5-row table (VC codes 0-4),
// columns VC/Goods/VatRate/VatAmount (legacy's vatSection() is VC/%Rate/
// Goods/V.A.T - a different column order, not reusable here). The overall
// Goods/VAT/Total for the whole invoice are printed as extra trailing
// numbers appended to the VC=4 row rather than on their own line, so they're
// picked up from whatever numeric tokens remain after that row's 4 columns.
function modernVatSection(lines: string[]) {
  const headerIndex = lines.findIndex(line => /\bVC\b/i.test(line) && /\bGOODS\b/i.test(line) && /VAT\s*RATE/i.test(line) && /VAT\s*AMOUNT/i.test(line))
  const vatSummary: Array<{ code: string; rate: number; goods: number; vat: number }> = []
  let totals = { totalGoods: 0, vat: 0, grandTotal: 0 }
  if (headerIndex < 0) return { vatSummary, ...totals }
  for (const row of lines.slice(headerIndex + 1, headerIndex + 6)) {
    const match = row.match(/^\s*(\d+)\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*(.*)$/)
    if (!match) continue
    const [, code, goods, rate, vat, rest] = match
    vatSummary.push({ code, rate: money(rate), goods: money(goods), vat: money(vat) })
    const trailingNumbers = rest.match(/-?[\d,]+\.\d{2}/g)
    if (trailingNumbers && trailingNumbers.length >= 3) {
      totals = { totalGoods: money(trailingNumbers[0]), vat: money(trailingNumbers[1]), grandTotal: money(trailingNumbers[2]) }
    }
  }
  return { vatSummary, ...totals }
}

export function parseModernInvoiceLines(rawLines: string[]): ImportedLegacyInvoice {
  const lines = rawLines.map(line => line.replace(/ /g, ' ')).filter(line => line.trim())
  const normalizedLines = lines.map(compact)
  const companyName = modernCustomerName(lines)
  const metadata = modernMetadataSection(lines)
  const items = modernProductSection(lines)
  const { vatSummary, totalGoods: parsedTotalGoods, vat: parsedVat, grandTotal: parsedGrandTotal } = modernVatSection(lines)
  applyVatRates(items, vatSummary)
  const totalGoods = parsedTotalGoods || items.reduce((sum, item) => sum + item.goodsValue, 0)
  const vat = parsedVat || vatSummary.reduce((sum, row) => sum + row.vat, 0)
  const grandTotal = parsedGrandTotal || totalGoods + vat
  const warnings: string[] = []
  if (!companyName) warnings.push('Please check the customer company name.')
  if (!metadata.accountNumber) warnings.push('Please check the customer account number.')
  if (!metadata.date) warnings.push('Please check the invoice date.')
  if (!metadata.invoiceNumber) warnings.push('Please check the invoice number.')
  if (isInvalidReferenceValue(metadata.accountNumber)) warnings.push('Account number was extracted as "1", which is not a valid reference - please check and correct it.')
  if (isInvalidReferenceValue(metadata.invoiceNumber)) warnings.push('Invoice number was extracted as "1", which is not a valid reference - please check and correct it.')
  if (!items.length) warnings.push('No product rows were found. Add or correct the products before saving.')
  if (Math.abs(totalGoods + vat - grandTotal) > TOTALS_TOLERANCE) warnings.push('The goods total plus VAT does not match the grand total - the printed Grand Total has been used as-is.')

  // Same reconciliation-based negative-value check as the legacy template
  // (see parseLegacyInvoiceLines above) - a negative is only flagged when it
  // does not reconcile with the printed Total Goods, never flipped automatically.
  const itemsGoodsSum = items.reduce((sum, item) => sum + item.goodsValue, 0)
  const linesReconcile = items.length > 0 && Math.abs(itemsGoodsSum - totalGoods) <= TOTALS_TOLERANCE
  const negativeItems = items.filter(item => item.quantity < 0 || item.price < 0 || item.goodsValue < 0)
  if (negativeItems.length && !linesReconcile) {
    for (const item of negativeItems) item.suspiciousNegative = true
    warnings.push(`Negative quantity/price/goods value on line(s) ${negativeItems.map(i => i.line).join(', ')} does not reconcile with the printed Total Goods - confirm during review before approving.`)
  }

  return {
    documentType: 'invoice',
    customer: { companyName, address: '', postcode: '', phone: '', normalizedPhone: '', email: '', accountNumber: metadata.accountNumber, ledgerBalance: 0 },
    invoice: { invoiceNumber: metadata.invoiceNumber, invoiceAccount: metadata.invoiceAccount, deliveryAccount: '', salesman: '', date: metadata.date, currency: 'GBP', totalGoods, vat, grandTotal, packages: 0 },
    items,
    vatSummary,
    confidence: {
      companyName: confidence(companyName), address: confidence(''), postcode: confidence(''), phone: confidence(''),
      accountNumber: !/^\d+$/.test(metadata.accountNumber) ? 'review' : isInvalidReferenceValue(metadata.accountNumber) ? 'review' : 'high',
      invoiceNumber: !metadata.invoiceNumber ? 'missing' : isInvalidReferenceValue(metadata.invoiceNumber) ? 'review' : 'high', date: confidence(metadata.date), products: items.length ? 'high' : 'missing',
      totals: Math.abs(totalGoods + vat - grandTotal) <= TOTALS_TOLERANCE ? 'high' : 'review',
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
  if (Math.abs(totalGoods + vat - grandTotal) > TOTALS_TOLERANCE) warnings.push('The credited goods plus VAT does not match the total credit - the printed total has been used as-is.')
  return {
    documentType: 'credit_note',
    customer: { ...customer, email: '', accountNumber: metadata.accountNumber, ledgerBalance },
    creditNote: { creditNumber: explicitNumber, date: metadata.date, originalInvoiceReference, deliveryAccount: metadata.deliveryAccount, salesman: metadata.salesman, currency: 'GBP', totalGoods, vat, grandTotal, packages },
    items, vatSummary,
    confidence: { companyName: confidence(customer.companyName), accountNumber: confidence(metadata.accountNumber), creditNumber: confidence(explicitNumber), date: confidence(metadata.date), products: items.length ? 'high' : 'missing', totals: Math.abs(totalGoods + vat - grandTotal) <= TOTALS_TOLERANCE ? 'high' : 'review' },
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

// Dynamic import (not a static top-level one) so the pure line-parsing
// functions above stay importable from a Node/serverless context (the
// email-import worker) without pulling in statementImport.ts's browser-only
// pdfjs-dist/tesseract.js/canvas dependency graph - it's only resolved when
// one of these two browser-facing functions actually runs.
async function extractLines(file: File, onProgress?: (message: string) => void): Promise<string[]> {
  const { extractDocumentLines } = await import('./statementImport.js')
  return extractDocumentLines(file, onProgress)
}

export async function parseLegacyInvoice(file: File, onProgress?: (message: string) => void): Promise<ImportedLegacyInvoice> {
  const rawLines = await extractLines(file, onProgress)
  const parsed = parseLegacyInvoiceLines(rawLines)
  parsed.source = { name: file.name, type: file.type || 'application/pdf', size: file.size, dataUri: await fileToDataUri(file) }
  return parsed
}

export async function parseFinancialDocument(file: File, onProgress?: (message: string) => void): Promise<ImportedFinancialDocument> {
  const rawLines = await extractLines(file, onProgress)
  const parsed = detectImportDocumentType(rawLines) === 'credit_note' ? parseCreditNoteLines(rawLines) : parseLegacyInvoiceLines(rawLines)
  parsed.source = { name: file.name, type: file.type || 'application/pdf', size: file.size, dataUri: await fileToDataUri(file) }
  return parsed
}
