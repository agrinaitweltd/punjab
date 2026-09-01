import type { Customer, Invoice } from '../types'
import type { ImportedInvoiceItem } from './invoiceImport'
import { authenticatedFetch } from './apiFetch'

export type CanonicalInvoicePdf = {
  blob: Blob
  dataUri: string
  base64: string
  fileName: string
  /** Which renderer actually produced this PDF - 'ConvertAPI' is the
      official Word-template render; anything else (the pdf-lib fallback)
      means the converter is down and the caller should flag this invoice
      for review instead of treating it as a normal success (item 10). */
  provider: string
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function generateCanonicalInvoicePdf(
  invoice: Invoice,
  customer: Customer,
  items: ImportedInvoiceItem[],
): Promise<CanonicalInvoicePdf> {
  if (!items.length) throw new Error('Stored product rows are missing. Recreate the invoice before retrying.')
  const totalGoods = items.reduce((sum, item) => sum + (item.goodsValue || item.quantity * item.price), 0)
  const vatTotal = items.reduce((sum, item) => sum + (item.goodsValue || item.quantity * item.price) * item.vatRate / 100, 0)
  const address = customer.address || customer.registeredAddress || ''
  const addressParts = address.split(',').map(value => value.trim()).filter(Boolean)
  const payload = {
    customer: {
      name: customer.companyName,
      accountNumber: customer.customerNumber,
      address,
      addressLine1: addressParts[0] || '',
      addressLine2: addressParts.slice(1, -1).join(', '),
      postcode: addressParts.at(-1) || '',
      phone: customer.phone,
      balance: customer.balance ?? 0,
    },
    invoice: {
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.date,
      packages: 0,
      totalGoods,
      vatTotal,
      grandTotal: invoice.amount,
    },
    items: items.map(item => ({
      line: item.line,
      qty: item.quantity,
      product: item.product,
      variety: item.variety,
      size: item.size,
      price: item.price,
      vatRate: item.vatRate,
    })),
  }
  const wordResponse = await authenticatedFetch('/api/generate-invoice-docx', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  })
  if (!wordResponse.ok) throw new Error('Official invoice document could not be generated.')
  const docx = await wordResponse.blob()
  const docxDataUri = await blobToDataUri(docx)
  const safeInvoice = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')
  const docxFileName = `Punjab-Invoice-${safeInvoice}.docx`
  const pdfResponse = await authenticatedFetch('/api/convert-invoice-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ docxBase64: docxDataUri.split(',')[1] || '', fileName: docxFileName, data: payload }),
  })
  if (!pdfResponse.ok) throw new Error('Official invoice PDF conversion failed.')
  const provider = pdfResponse.headers.get('X-PDF-Provider') || 'unknown'
  const blob = await pdfResponse.blob()
  const dataUri = await blobToDataUri(blob)
  return {
    blob,
    dataUri,
    base64: dataUri.split(',')[1] || '',
    fileName: `Punjab-Invoice-${safeInvoice}-${customer.customerNumber}.pdf`,
    provider,
  }
}
