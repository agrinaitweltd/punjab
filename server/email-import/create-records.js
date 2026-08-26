// Server-side equivalent of AdminPortal.tsx's importCustomerDocuments() -
// same customer-matching, duplicate-detection, invoice/credit-note creation
// and canonical-PDF generation, just via a service-role client instead of
// the browser's anon-key/RLS-bound one (that client can't run outside the
// browser - see invoiceImport.ts/importMatching.ts for the parsing/matching
// logic this reuses unchanged).
// Compiled from src/lib/importMatching.ts by `tsc -p tsconfig.server.json`
// (part of `npm run build`) - Vercel's Node runtime executes API functions
// as plain ESM without transpiling arbitrary .ts imports, so this can't
// import the .ts source directly the way the Vite/browser bundle does.
import { normalizeAccountNumber, normalizeCompanyName, findDuplicateInvoice, findDuplicateCreditNote } from '../../server-dist/lib/importMatching.js'
import { buildInvoiceDocx } from '../canonicalInvoiceDocx.js'
import { buildOfficialInvoicePdf } from '../canonicalInvoicePdf.js'

export const APPROVED_INVOICE_TEMPLATE_ID = 'punjab-approved-letterhead-v1'
export const MAX_FILE_BYTES = 2 * 1024 * 1024
const ALLOWED_EXTENSIONS = /\.(pdf|jpe?g|png|webp|docx|xlsx|csv)$/i

// Mirrors fileService.ts's genId/safeFileName exactly (kept in sync by hand
// since api/server files are plain JS and can't import a .ts module's
// browser-bound sibling code - see fileService.ts's own comment on this).
const genId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

/** Best-effort bell notification - never throws, since a notification row
 *  failing to write must never fail the actual import it's describing. */
export async function notify(admin, table, { type, title, message, targetType, targetId }) {
  try {
    await admin.from(table('notifications')).insert({ type, title, message: message ?? null, target_type: targetType ?? null, target_id: targetId ?? null, created_by: 'email-import' })
  } catch { /* notification is best-effort */ }
}

export function safeFileName(name) {
  const withoutControls = [...name].map(c => c.charCodeAt(0) < 32 ? '_' : c).join('')
  const cleaned = withoutControls.replace(/[\\/:*?"<>|]/g, '_').replace(/\.{2,}/g, '.').trim().slice(0, 140)
  if (!cleaned || !ALLOWED_EXTENSIONS.test(cleaned)) throw new Error('That file type is not allowed.')
  return cleaned
}

/** Same activity_log row shape as fileService.ts's uploadFile(). Exported so
 *  process-mailbox.js can also store a PDF that couldn't be auto-imported
 *  (needs_review/failed), so the admin can retry it later without needing
 *  the original email again. */
export async function uploadFileServer(admin, table, { name, type, size, dataUri, note, customerId, customerName, document = {} }) {
  const sanitizedName = safeFileName(name)
  if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_BYTES) throw new Error('File size is outside the allowed range.')
  const row = {
    id: genId('f'),
    customer_name: `FILE:${sanitizedName}`,
    action: dataUri,
    timestamp: JSON.stringify({ type, size, note, uploadedAt: new Date().toISOString(), customerId, customerName, ...document }),
  }
  const { error } = await admin.from(table('activity_log')).insert(row)
  if (error) throw error
  return { id: row.id, name: sanitizedName }
}

/** Same matching priority as the manual "Add Customer via PDF" flow
 *  (matchImportedCustomer in importMatching.ts: account number, then company
 *  name), except this also detects an AMBIGUOUS match - two+ existing
 *  customers sharing the same normalized account number or company name -
 *  which the manual flow can't hit (an admin picks one from a dropdown) but
 *  an unattended email import must not guess through. Returns exactly one
 *  of: { customer: <row> } a single confident match, { ambiguous: true,
 *  reason } two or more equally-good matches, or {} no match at all (caller
 *  decides whether to auto-create from there). */
function findCustomerMatch(customerRows, importedCustomer) {
  const account = normalizeAccountNumber(importedCustomer.accountNumber)
  if (account) {
    const matches = customerRows.filter(row => normalizeAccountNumber(row.customer_number) === account)
    if (matches.length === 1) return { customer: matches[0] }
    if (matches.length > 1) return { ambiguous: true, reason: 'Multiple existing customers share this account number.' }
  }
  const company = normalizeCompanyName(importedCustomer.companyName)
  if (company) {
    const matches = customerRows.filter(row => normalizeCompanyName(row.company_name) === company)
    if (matches.length === 1) return { customer: matches[0] }
    if (matches.length > 1) return { ambiguous: true, reason: 'Multiple existing customers share a similar company name.' }
  }
  return {}
}

/** Resolves the customer for a parsed document (invoice OR credit note),
 *  creating a new customer record when none exists yet - the email-import
 *  equivalent of the manual "Add Customer via PDF" flow's own auto-create-
 *  if-new-else-match step (importCustomerDocuments in AdminPortal.tsx), just
 *  running server-side against the live customers table instead of
 *  in-memory React state. Only ever creates a customer when the document
 *  itself supplied enough to identify one (company name AND account
 *  number) - never guesses, and never touches an existing row beyond
 *  linking the new invoice/credit note to it. */
export async function resolveOrCreateCustomer(admin, table, importedCustomer) {
  const { data: customerRows, error } = await admin.from(table('customers')).select('*')
  if (error) throw error
  const match = findCustomerMatch(customerRows || [], importedCustomer)
  if (match.ambiguous) return { status: 'ambiguous', reason: match.reason }
  if (match.customer) return { status: 'matched', customer: match.customer, created: false }

  const companyName = (importedCustomer.companyName || '').trim()
  const accountNumber = (importedCustomer.accountNumber || '').trim()
  // A company/trading name OR an account number is enough to safely create a
  // new customer - requiring both was rejecting genuine invoices for
  // customers printed as just a trading name with no formal company suffix,
  // or where the account number wasn't parsed. Only genuinely blank customer
  // details (neither present) still needs a human to look at it.
  if (!companyName && !accountNumber) {
    return { status: 'insufficient', reason: 'No matching customer was found, and the document does not have enough detail (no company/trading name and no account number) to identify or create a customer automatically.' }
  }
  const customerNumber = accountNumber
    ? accountNumber.replace(/[^a-z0-9]/gi, '').toUpperCase()
    : `AUTO${genId('').replace(/[^0-9]/g, '').slice(-8)}`
  const row = {
    id: genId('c'), company_name: companyName || `Account ${customerNumber}`, contact_person: '',
    email: importedCustomer.email || `${customerNumber}@pending.punjab.local`, phone: importedCustomer.phone || '',
    customer_number: customerNumber, password: `pending-${Math.random().toString(36).slice(2, 12)}`,
    address: [importedCustomer.address, importedCustomer.postcode].filter(Boolean).join(', '),
    delivery_area: '', payment_terms: '14 Days', credit_days: 14, balance: 0, status: 'active',
  }
  const { data: created, error: createErr } = await admin.from(table('customers')).insert(row).select().single()
  if (createErr) throw createErr
  await notify(admin, table, { type: 'customer_auto_created', title: 'New customer auto-created', message: `${created.company_name} was created automatically from an emailed document.`, targetType: 'customer', targetId: created.id })
  return { status: 'matched', customer: created, created: true }
}

/** Decides whether a parsed document is confident enough to auto-create an
 *  invoice/credit note unattended, or should wait for an admin. `resolution`
 *  is resolveOrCreateCustomer()'s result - "ambiguous" and "insufficient"
 *  both route to needs_review, same as a missing invoice number or total. */
// Only a warning that means the document genuinely cannot be safely turned
// into an invoice/credit note unattended blocks auto-import - no product
// rows at all (nothing to bill/credit). A totals-reconciliation gap (goods +
// VAT vs the printed grand total - e.g. a porterage charge not folded into
// "Total Goods"), or a missing optional field like the account number or
// invoice date, is recorded on the created record as an informational note
// instead of refusing an otherwise genuine invoice - see
// generateAndAttachCanonicalPdf's caller and imported_metadata.totalsWarning.
const BLOCKING_WARNING_PATTERN = /no product rows were found|no credited product rows were found/i

export function assessConfidence(document, resolution) {
  const reasons = []
  if (resolution.status === 'ambiguous' || resolution.status === 'insufficient') reasons.push(resolution.reason)
  if (document.warnings?.length) reasons.push(...document.warnings.filter(warning => BLOCKING_WARNING_PATTERN.test(warning)))
  if (document.documentType === 'invoice') {
    if (!document.invoice.invoiceNumber) reasons.push('No invoice number was detected.')
    if (!(document.invoice.grandTotal > 0)) reasons.push('No positive invoice total was detected.')
    // A negative quantity/price/goods value on an invoice is never silently
    // auto-corrected or auto-imported as-is - it always needs an admin's eyes
    // in Review Invoice, since it could be a genuine sign error (would
    // under/overcharge the customer) or a real PDF extraction artefact, and
    // guessing which is exactly what must not happen unattended.
    if (document.items?.some(item => item.suspiciousNegative)) reasons.push('One or more product lines have a suspicious negative quantity, price, or goods value - confirm in Review Invoice.')
  } else {
    if (!(Math.abs(document.creditNote.grandTotal) > 0)) reasons.push('No credit note total was detected.')
  }
  return { confident: reasons.length === 0, reasons }
}

/** The non-blocking warnings kept for admin visibility once a document is
 *  confidently imported despite them (e.g. a totals mismatch) - stored on
 *  the created invoice/credit note's imported_metadata so an admin can still
 *  see exactly what was flagged, without it having refused the import. */
export function softWarnings(document) {
  return (document.warnings || []).filter(warning => !BLOCKING_WARNING_PATTERN.test(warning))
}

/** Generates the official Punjab Exotic Foods PDF for an already-saved
 *  invoice and links it - shared by createRecordFromImport (new imports)
 *  and the missing-PDF repair pass (existing invoices that never got one),
 *  so there's exactly one place that builds this PDF regardless of when
 *  it's created. `invoiceRow`/`customerRow` are raw snake_case DB rows;
 *  `items` are invoice_items rows (also snake_case). Returns the uploaded
 *  file's { id, name }. */
export async function generateAndAttachCanonicalPdf(admin, table, invoiceRow, customerRow, items) {
  const address = customerRow.address || ''
  const official = await buildOfficialInvoicePdf({
    customer: { name: customerRow.company_name, accountNumber: customerRow.customer_number, address, addressLine1: address.split(',')[0]?.trim() || '', addressLine2: address.split(',').slice(1, -1).join(', '), postcode: address.split(',').at(-1)?.trim() || '', phone: customerRow.phone || '', balance: customerRow.balance ?? 0 },
    invoice: { invoiceNumber: invoiceRow.invoice_number, date: invoiceRow.date, packages: invoiceRow.packages || 0, totalGoods: invoiceRow.total_goods ?? 0, vatTotal: invoiceRow.total_vat ?? 0, grandTotal: invoiceRow.amount },
    items: items.map(item => ({ line: item.line_number, qty: item.quantity, product: item.product, variety: item.variety, size: item.size, price: item.price, vatRate: item.vat_rate })),
  }, buildInvoiceDocx)
  const officialFile = await uploadFileServer(admin, table, {
    name: official.fileName, type: 'application/pdf', size: official.buffer.length, dataUri: `data:application/pdf;base64,${official.buffer.toString('base64')}`,
    note: `Invoices: ${invoiceRow.invoice_number}`, customerId: customerRow.id, customerName: customerRow.company_name,
    document: { invoiceId: invoiceRow.id, invoiceNumber: invoiceRow.invoice_number, invoiceAmount: invoiceRow.amount, documentRole: 'canonical_invoice', templateId: APPROVED_INVOICE_TEMPLATE_ID },
  })
  const { error: linkErr } = await admin.from(table('invoices')).update({ canonical_document_id: officialFile.id, canonical_pdf_file_name: officialFile.name, canonical_pdf_generated_at: new Date().toISOString() }).eq('id', invoiceRow.id)
  if (linkErr) throw linkErr
  return officialFile
}

/** Creates the invoice/credit note + items + source & canonical PDFs for one
 *  parsed document against one already-matched customer. Returns the same
 *  shape importCustomerDocuments() would after its per-document step -
 *  { invoiceId } or { creditNoteId }. Throws on duplicate/invalid input,
 *  same as the manual path. */
export async function createRecordFromImport(admin, table, document, customer, source) {
  if (document.documentType === 'invoice') {
    const issueDate = document.invoice.date || new Date().toISOString().slice(0, 10)
    const { data: existingInvoices, error: invErr } = await admin.from(table('invoices')).select('id,invoice_number,customer_id,date').eq('customer_id', customer.id)
    if (invErr) throw invErr
    const mapped = (existingInvoices || []).map(row => ({ id: row.id, invoiceNumber: row.invoice_number, customerId: row.customer_id, date: row.date }))
    if (findDuplicateInvoice(mapped, { invoiceNumber: document.invoice.invoiceNumber, customerId: customer.id, date: issueDate })) {
      const error = new Error('This invoice has already been imported for that customer and date.')
      error.code = 'duplicate'
      throw error
    }
    const { data: numberClash } = await admin.from(table('invoices')).select('id').ilike('invoice_number', document.invoice.invoiceNumber).maybeSingle()
    if (numberClash) { const error = new Error('That invoice number already exists.'); error.code = 'duplicate'; throw error }

    const due = new Date(`${issueDate}T00:00:00`)
    due.setDate(due.getDate() + (customer.credit_days ?? 14))
    const invoiceRow = {
      id: genId('inv'), customer_id: customer.id, invoice_number: document.invoice.invoiceNumber,
      amount: document.invoice.grandTotal, due_date: due.toISOString().slice(0, 10), status: document.invoice.grandTotal > 0 ? 'Unpaid' : 'Paid',
      date: issueDate, amount_paid: 0, total_goods: document.invoice.totalGoods, total_vat: document.invoice.vat, packages: document.invoice.packages,
      imported_metadata: { accountNumber: document.customer.accountNumber, deliveryAccount: document.invoice.deliveryAccount, salesman: document.invoice.salesman, vatSummary: document.vatSummary, source: 'email', importWarnings: softWarnings(document) },
    }
    const { data: createdInvoice, error: createErr } = await admin.from(table('invoices')).insert(invoiceRow).select().single()
    if (createErr) throw createErr

    if (document.items.length) {
      const itemRows = document.items.map(item => ({
        invoice_id: createdInvoice.id, line_number: item.line, quantity: item.quantity, product: item.product, variety: item.variety,
        size: item.size, price: item.price, goods_value: item.goodsValue, vat_code: item.vatCode, vat_rate: item.vatRate,
        vat_amount: item.vatAmount ?? item.goodsValue * item.vatRate / 100,
      }))
      const { error: itemsErr } = await admin.from(table('invoice_items')).insert(itemRows)
      if (itemsErr) throw itemsErr
    }

    // The source PDF and the invoice record itself are the financial data -
    // once those are safely saved, a PDF-generation failure must not throw
    // the whole import back to "failed" and imply nothing was saved (item
    // 11: "do not pretend the workflow is fully complete", but also do not
    // pretend a saved invoice doesn't exist). It's caught here and recorded
    // as "PDF generation pending" instead - the nightly health check already
    // finds and safely retries exactly this condition (see
    // server/health-check.js's invoicesNeedingPdf pass).
    const [sourceFile, officialResult] = await Promise.all([
      source
        ? uploadFileServer(admin, table, { name: source.name, type: source.type, size: source.size, dataUri: source.dataUri, note: `Invoices: Original source for ${createdInvoice.invoice_number} (email import)`, customerId: customer.id, customerName: customer.company_name, document: { invoiceId: createdInvoice.id, invoiceNumber: createdInvoice.invoice_number, invoiceAmount: createdInvoice.amount, documentRole: 'legacy_source' } })
        : Promise.resolve(undefined),
      generateAndAttachCanonicalPdf(admin, table, createdInvoice, customer, document.items.map(item => ({ line_number: item.line, quantity: item.quantity, product: item.product, variety: item.variety, size: item.size, price: item.price, vat_rate: item.vatRate })))
        .then(file => ({ ok: true, file }))
        .catch(error => ({ ok: false, error })),
    ])
    const { error: linkErr } = await admin.from(table('invoices')).update({ source_document_id: sourceFile?.id }).eq('id', createdInvoice.id)
    if (linkErr) throw linkErr
    const officialFile = officialResult.ok ? officialResult.file : undefined
    if (!officialResult.ok) {
      await admin.from(table('invoices')).update({ imported_metadata: { ...invoiceRow.imported_metadata, pdfGenerationPending: true, pdfGenerationError: String(officialResult.error?.message || officialResult.error).slice(0, 300) } }).eq('id', createdInvoice.id)
      await notify(admin, table, { type: 'pdf_generation_failed', title: 'PDF generation failed - pending retry', message: `Invoice ${createdInvoice.invoice_number} for ${customer.company_name} was saved, but its official PDF could not be generated yet. The nightly check will retry it automatically.`, targetType: 'invoice', targetId: createdInvoice.id })
    }

    const { data: customerInvoices } = await admin.from(table('invoices')).select('amount,amount_paid,status').eq('customer_id', customer.id)
    const workingBalance = (customerInvoices || []).filter(row => row.status !== 'Paid').reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0) - Number(row.amount_paid || 0)), 0)
    await admin.from(table('customers')).update({ balance: workingBalance }).eq('id', customer.id)

    const invoiceWarnings = softWarnings(document)
    await notify(admin, table, {
      type: 'invoice_imported',
      title: invoiceWarnings.length ? 'Invoice imported - validation warning' : 'New invoice imported',
      message: `Invoice ${createdInvoice.invoice_number} for ${customer.company_name} - £${Number(createdInvoice.amount).toFixed(2)}.${invoiceWarnings.length ? ` ${invoiceWarnings.join(' ')}` : ''}`,
      targetType: 'invoice', targetId: createdInvoice.id,
    })

    return { invoiceId: createdInvoice.id, fileId: officialFile?.id ?? sourceFile?.id }
  }

  const sourceCreditNumber = document.creditNote.creditNumber.trim()
  if (sourceCreditNumber) {
    const { data: existingCredits, error: cnErr } = await admin.from(table('credit_notes')).select('id,credit_number,customer_id,date').eq('customer_id', customer.id)
    if (cnErr) throw cnErr
    const mapped = (existingCredits || []).map(row => ({ id: row.id, creditNumber: row.credit_number, customerId: row.customer_id, date: row.date }))
    if (findDuplicateCreditNote(mapped, { creditNumber: sourceCreditNumber, customerId: customer.id, date: document.creditNote.date })) {
      const error = new Error('This credit note has already been imported for that customer and date.')
      error.code = 'duplicate'
      throw error
    }
  }
  const accountingAmount = Math.abs(document.creditNote.grandTotal)
  const creditRow = {
    id: genId('cn'), credit_number: sourceCreditNumber || `CN-EMAIL-${Date.now()}`, customer_id: customer.id, amount: accountingAmount,
    reason: document.creditNote.originalInvoiceReference ? `Imported credit for invoice ${document.creditNote.originalInvoiceReference}` : 'Imported credit note (email)',
    date: document.creditNote.date, status: 'Active', remaining_balance: accountingAmount,
    original_invoice_reference: document.creditNote.originalInvoiceReference || null,
    total_goods: document.creditNote.totalGoods ?? 0, total_vat: document.creditNote.vat ?? 0,
    imported_metadata: { accountNumber: document.customer.accountNumber, deliveryAccount: document.creditNote.deliveryAccount, salesman: document.creditNote.salesman, vatSummary: document.vatSummary, source: 'email', importWarnings: softWarnings(document) },
  }
  const { data: createdNote, error: createErr } = await admin.from(table('credit_notes')).insert(creditRow).select().single()
  if (createErr) throw createErr
  if (document.items.length) {
    const itemRows = document.items.map(item => ({
      credit_note_id: createdNote.id, line_number: item.line, quantity: item.quantity, product: item.product, variety: item.variety,
      size: item.size, price: item.price, goods_value: item.goodsValue, vat_code: item.vatCode, vat_rate: item.vatRate,
      vat_amount: item.vatAmount ?? item.goodsValue * item.vatRate / 100,
    }))
    await admin.from(table('credit_note_items')).insert(itemRows)
  }
  let sourceFile
  if (source) {
    sourceFile = await uploadFileServer(admin, table, { name: source.name, type: source.type, size: source.size, dataUri: source.dataUri, note: `Credit Notes: Original source for ${createdNote.credit_number} (email import)`, customerId: customer.id, customerName: customer.company_name, document: { creditNoteId: createdNote.id, creditNoteNumber: createdNote.credit_number, creditNoteAmount: createdNote.amount, documentRole: 'credit_note_source' } })
    await admin.from(table('credit_notes')).update({ source_document_id: sourceFile.id, source_file_name: sourceFile.name }).eq('id', createdNote.id)
  }
  const creditWarnings = softWarnings(document)
  await notify(admin, table, {
    type: 'credit_note_imported',
    title: creditWarnings.length ? 'Credit note imported - validation warning' : 'New credit note received',
    message: `Credit note ${createdNote.credit_number} for ${customer.company_name} - £${Number(createdNote.amount).toFixed(2)}.${creditWarnings.length ? ` ${creditWarnings.join(' ')}` : ''}`,
    targetType: 'credit_note', targetId: createdNote.id,
  })

  return { creditNoteId: createdNote.id, fileId: sourceFile?.id }
}
