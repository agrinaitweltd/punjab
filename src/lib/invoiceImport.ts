import { extractDocumentLines } from './statementImport'

export type ImportedInvoiceItem = { line: string; quantity: number; product: string; variety: string; size: string; price: number; goodsValue: number; vatCode: string; vatRate: number }
export type ImportedLegacyInvoice = {
  customer: { companyName: string; address: string; postcode: string; phone: string; email: string; accountNumber: string; ledgerBalance: number }
  invoice: { invoiceNumber: string; date: string; currency: string; totalGoods: number; vat: number; grandTotal: number; packages: number }
  items: ImportedInvoiceItem[]
  warnings: string[]
}

const money = (value?: string) => Number((value ?? '').replace(/[£,\s]/g, '')) || 0
const valueAfter = (text: string, label: string) => text.match(new RegExp(`${label}\\s*:?\\s*([^\\n]+)`, 'i'))?.[1]?.trim() ?? ''
const isoDate = (value: string) => { const m = value.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/); if (!m) return ''; const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` }

export function parseLegacyInvoiceLines(lines: string[]): ImportedLegacyInvoice {
  const clean = lines.map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const text = clean.join('\n')
  const issuer = clean.findIndex(x => /Punjab Exotic Foods Ltd/i.test(x))
  const heading = clean.findIndex(x => /INVOICE CUSTOMER COPY/i.test(x))
  const customerBlock = clean.slice(heading >= 0 ? heading + 1 : 0, issuer > 0 ? issuer : 8).filter(x => !/^S\/L Balance/i.test(x))
  const postcode = customerBlock.find(x => /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(x))?.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i)?.[0]?.toUpperCase() ?? ''
  const phone = customerBlock.find(x => /(?:\+44|0)\d[\d\s]{8,}/.test(x))?.replace(/[^+\d]/g, '') ?? ''
  const email = customerBlock.find(x => /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(x))?.match(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/)?.[0] ?? ''
  const accountMatch = text.match(/(?:^|\n)\s*Num\s*:?\s*(\d{6})\b/i) || text.match(/(?:^|\n)\s*Num\s*:?\s*\n\s*(\d{6})\b/i)
  const itemPattern = /Line\s*:?\s*(\d+)\s*[\s\S]*?Qty\s*:?\s*(\d+(?:\.\d+)?)\s*[\s\S]*?Product\s*:?\s*([^\n]+)\s*[\s\S]*?Variety\s*:?\s*([^\n]*)\s*[\s\S]*?Size\s*:?\s*([^\n]*)\s*[\s\S]*?Price\s*:?\s*£?([\d,.]+)\s*[\s\S]*?Goods VC\s*:?\s*£?([\d,.]+)/gi
  const items = [...text.matchAll(itemPattern)].map(m => ({ line: m[1], quantity: Number(m[2]), product: m[3].trim(), variety: m[4].trim(), size: m[5].trim(), price: money(m[6]), goodsValue: money(m[7]), vatCode: '', vatRate: 0 }))
  const totalGoods = money(valueAfter(text, 'Total Goods'))
  const vat = money(valueAfter(text, 'Total V\\.?A\\.?T'))
  const grandTotal = money(valueAfter(text, 'Grand Total')) || totalGoods + vat
  const warnings: string[] = []
  if (!accountMatch) warnings.push('Six-digit Num account number was not confidently detected.')
  if (!customerBlock[0]) warnings.push('Customer company name was not detected.')
  if (!grandTotal) warnings.push('Invoice grand total was not detected.')
  if (!items.length) warnings.push('No product rows were confidently detected; add them manually.')
  return { customer: { companyName: customerBlock[0] ?? '', address: customerBlock.filter(x => x !== customerBlock[0] && x !== phone && x !== email).join(', '), postcode, phone, email, accountNumber: accountMatch?.[1] ?? '', ledgerBalance: money(valueAfter(text, 'S/L Balance')) }, invoice: { invoiceNumber: valueAfter(text, 'Inv No(?:voice)?') || '', date: isoDate(valueAfter(text, 'Date/Tax Pt|Date / Tax Point')), currency: 'GBP', totalGoods, vat, grandTotal, packages: Number(text.match(/(?:^|\n)\s*(\d+)\s+PACKAGES\b/i)?.[1] ?? 0) }, items, warnings }
}

export async function parseLegacyInvoice(file: File, onProgress?: (message: string) => void) {
  return parseLegacyInvoiceLines(await extractDocumentLines(file, onProgress))
}
