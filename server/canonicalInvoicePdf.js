import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

/* Core "convert the official invoice DOCX to PDF" logic - shared by:
   - api/convert-invoice-pdf.js (browser manual-import path, HTTP + admin auth)
   - server/email-import/create-records.js (email-import worker, in-process, no HTTP hop)
   Uses ConvertAPI when configured, falling back to the same pdf-lib renderer
   either way - so both routes produce the same PDF for the same input. */

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
  page.drawText('Please Pay Invoice in 21 Days.', { x: 36, y: 46, size: 8, font: bold, color: green })
  page.drawText('Punjab Exotic Foods Limited | New Spitalfields Market, London E10 5SQ', { x: 36, y: 34, size: 8, font: regular, color: muted })
  return Buffer.from(await pdf.save())
}

const CONVERTAPI_TIMEOUT_MS = 25_000

/** One attempt at the ConvertAPI call with a given auth style. ConvertAPI
 *  issues two different credential shapes from its dashboard - a plain
 *  32-char "Secret" (authenticated via a `Secret=` query param) and an
 *  OAuth-style token (authenticated via `Authorization: Bearer`) - and a
 *  key pasted from the "Secret" page will 401 if sent as a Bearer token.
 *  Returns { ok, buffer } on success or { ok: false, status, message } with
 *  the REAL provider error text so it's debuggable from the dashboard
 *  instead of only in server logs. */
async function attemptConvertApi(url, docxBase64, fileName, bearerToken) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CONVERTAPI_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}) },
      signal: controller.signal,
      body: JSON.stringify({ Parameters: [{ Name: 'File', FileValue: { Name: fileName || 'invoice.docx', Data: docxBase64 } }] }),
    })
    const result = await response.json().catch(() => ({}))
    const encoded = result?.Files?.[0]?.FileData
    if (!response.ok || !encoded) return { ok: false, status: response.status, message: result?.Message || `HTTP ${response.status}` }
    return { ok: true, buffer: Buffer.from(encoded, 'base64') }
  } catch (error) {
    const timedOut = error?.name === 'AbortError'
    return { ok: false, status: 0, message: timedOut ? `Timed out after ${CONVERTAPI_TIMEOUT_MS / 1000}s` : (error instanceof Error ? error.message : 'Network error') }
  } finally {
    clearTimeout(timer)
  }
}

/** Converts a DOCX buffer to a PDF buffer. Returns { buffer, provider,
 *  error? } - error is the real ConvertAPI failure reason, present only
 *  when it fell back to the pdf-lib renderer, so callers can store/surface
 *  something more useful than a generic "converter unavailable" message. */
export async function convertDocxToPdf(docxBase64, fileName, data) {
  const token = process.env.CONVERTAPI_TOKEN
  if (token) {
    // Try Bearer auth first (the common case for a modern ConvertAPI
    // token), then the Secret query-param style if that's specifically an
    // auth failure (401/403) - a genuine conversion error (e.g. malformed
    // docx) shouldn't trigger a pointless second attempt.
    const bearerAttempt = await attemptConvertApi('https://v2.convertapi.com/convert/docx/to/pdf', docxBase64, fileName, token)
    if (bearerAttempt.ok) return { buffer: bearerAttempt.buffer, provider: 'ConvertAPI' }
    let finalAttempt = bearerAttempt
    if (bearerAttempt.status === 401 || bearerAttempt.status === 403) {
      const secretUrl = `https://v2.convertapi.com/convert/docx/to/pdf?Secret=${encodeURIComponent(token)}`
      const secretAttempt = await attemptConvertApi(secretUrl, docxBase64, fileName)
      if (secretAttempt.ok) return { buffer: secretAttempt.buffer, provider: 'ConvertAPI' }
      finalAttempt = secretAttempt
    }
    console.error('ConvertAPI conversion failed; using PDF renderer', finalAttempt.status, finalAttempt.message)
    return { buffer: await renderFallback(data), provider: 'pdf-lib-fallback', error: `ConvertAPI ${finalAttempt.status || ''}: ${finalAttempt.message}`.trim().slice(0, 300) }
  }
  return { buffer: await renderFallback(data), provider: 'pdf-lib-fallback', error: 'CONVERTAPI_TOKEN is not set on the server.' }
}

/** Builds the complete official invoice PDF straight from the same payload
 *  shape the browser's generateCanonicalInvoicePdf() builds - docx generation
 *  + conversion in one call, for server-side (email-import) use. */
export async function buildOfficialInvoicePdf(payload, buildInvoiceDocx) {
  const docx = buildInvoiceDocx(payload)
  const safeInvoice = String(payload.invoice.invoiceNumber).replace(/[^a-zA-Z0-9_-]/g, '_')
  const docxFileName = `Punjab-Invoice-${safeInvoice}.docx`
  const { buffer, provider, error } = await convertDocxToPdf(docx.toString('base64'), docxFileName, payload)
  return { buffer, fileName: `Punjab-Invoice-${safeInvoice}-${payload.customer.accountNumber}.pdf`, provider, error }
}
