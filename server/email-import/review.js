// Backs the Review Invoice workflow (Email Imports "Review" action) - lets an
// admin see the original PDF alongside every parsed field, edit anything,
// and explicitly Approve (save + import) or Reject (keep for audit, create
// nothing financial) a needs_review/failed row, instead of the previous
// all-or-nothing retry that only re-ran the same automated parse.
import { extractPdfTextLines } from './extract-pdf-text.js'
// Compiled from src/lib/invoiceImport.ts - see process-mailbox.js's comment
// on the same import for why the raw .ts source can't be used here.
import { detectImportDocumentType, parseLegacyInvoiceLines, parseCreditNoteLines } from '../../server-dist/lib/invoiceImport.js'
import { createRecordFromImport, resolveOrCreateCustomer, notify } from './create-records.js'

async function loadStoredPdf(admin, table, fileId) {
  if (!fileId) throw new Error('The original PDF was not stored for this import.')
  const { data: fileRow, error } = await admin.from(table('activity_log')).select('action').eq('id', fileId).maybeSingle()
  if (error) throw error
  if (!fileRow?.action?.startsWith('data:application/pdf;base64,')) throw new Error('The stored PDF could not be found.')
  return { dataUri: fileRow.action, buffer: Buffer.from(fileRow.action.slice(fileRow.action.indexOf(',') + 1), 'base64') }
}

async function reparse(admin, table, row) {
  const { dataUri, buffer } = await loadStoredPdf(admin, table, row.file_id)
  const lines = await extractPdfTextLines(buffer)
  if (!lines.length) throw new Error('No extractable text was found in this PDF.')
  const documentType = detectImportDocumentType(lines)
  const document = documentType === 'credit_note' ? parseCreditNoteLines(lines) : parseLegacyInvoiceLines(lines)
  return { document, dataUri }
}

/** Returns the freshly re-parsed document for a needs_review/failed row,
 *  plus the original PDF as a data URI so the review UI can show it
 *  side-by-side with the parsed fields - nothing is written to the database. */
export async function getReviewDocument(admin, table, emailImportId) {
  const { data: row, error } = await admin.from(table('email_imports')).select('*').eq('id', emailImportId).maybeSingle()
  if (error) throw error
  if (!row) throw new Error('That email import record no longer exists.')
  if (!['needs_review', 'failed'].includes(row.status)) throw new Error(`Only "Needs Review" or "Failed" imports can be reviewed (this one is "${row.status}").`)
  const { document, dataUri } = await reparse(admin, table, row)
  return { row, document, sourcePdfDataUri: dataUri }
}

const scalarFieldsToDiff = {
  invoice: ['invoiceNumber', 'date', 'totalGoods', 'vat', 'grandTotal'],
  creditNote: ['creditNumber', 'date', 'totalGoods', 'vat', 'grandTotal'],
  customer: ['companyName', 'accountNumber', 'address', 'phone'],
}

/** Compares the freshly re-parsed ("original") document against what the
 *  admin is submitting ("edited") and returns a flat list of every field
 *  that changed - the audit trail item 15 asks for (original value,
 *  corrected value); who/when is attached by the caller from the session. */
function diffDocument(original, edited) {
  const changes = []
  for (const field of scalarFieldsToDiff.customer) {
    if ((original.customer?.[field] ?? '') !== (edited.customer?.[field] ?? '')) {
      changes.push({ field: `customer.${field}`, from: original.customer?.[field] ?? '', to: edited.customer?.[field] ?? '' })
    }
  }
  const section = original.documentType === 'credit_note' ? 'creditNote' : 'invoice'
  const fields = scalarFieldsToDiff[section]
  for (const field of fields) {
    if ((original[section]?.[field] ?? '') !== (edited[section]?.[field] ?? '')) {
      changes.push({ field: `${section}.${field}`, from: original[section]?.[field] ?? '', to: edited[section]?.[field] ?? '' })
    }
  }
  if ((original.items?.length ?? 0) !== (edited.items?.length ?? 0)) {
    changes.push({ field: 'items.length', from: original.items?.length ?? 0, to: edited.items?.length ?? 0 })
  } else {
    for (let index = 0; index < (edited.items?.length ?? 0); index += 1) {
      const before = original.items[index], after = edited.items[index]
      for (const field of ['quantity', 'product', 'variety', 'size', 'price', 'goodsValue']) {
        if (String(before?.[field] ?? '') !== String(after?.[field] ?? '')) {
          changes.push({ field: `items[${index}].${field}`, from: before?.[field] ?? '', to: after?.[field] ?? '' })
        }
      }
    }
  }
  return changes
}

/** Approves a reviewed document: re-parses the stored PDF as the trusted
 *  "original" (never trusts a client-submitted "original" value), diffs it
 *  against the admin's edited submission for the audit trail, resolves/
 *  creates the customer (via an explicit customerId the admin picked, or by
 *  re-running the normal match-or-create using the edited customer fields),
 *  then saves through the exact same createRecordFromImport path a normal
 *  import uses - same duplicate protection, same PDF generation, same
 *  balance recompute. */
export async function approveReview(admin, table, emailImportId, edited, { customerId, reviewerName } = {}) {
  const { data: row, error } = await admin.from(table('email_imports')).select('*').eq('id', emailImportId).maybeSingle()
  if (error) throw error
  if (!row) throw new Error('That email import record no longer exists.')
  if (!['needs_review', 'failed'].includes(row.status)) throw new Error(`Only "Needs Review" or "Failed" imports can be approved (this one is "${row.status}").`)

  const { document: original, dataUri } = await reparse(admin, table, row)
  const documentType = edited.documentType === 'credit_note' ? 'credit_note' : 'invoice'
  if (!edited.items?.length) throw new Error('At least one product line is required.')
  if (documentType === 'invoice' && !String(edited.invoice?.invoiceNumber || '').trim()) throw new Error('An invoice number is required.')
  if (documentType === 'invoice' && !(Number(edited.invoice?.grandTotal) > 0)) throw new Error('A positive invoice total is required.')
  if (documentType === 'credit_note' && !(Math.abs(Number(edited.creditNote?.grandTotal)) > 0)) throw new Error('A non-zero credit note total is required.')

  const changes = diffDocument(original, edited)

  let customerRow
  let customerCreated = false
  if (customerId) {
    const { data } = await admin.from(table('customers')).select('*').eq('id', customerId).maybeSingle()
    if (!data) throw new Error('The selected customer no longer exists.')
    customerRow = data
  } else {
    const resolution = await resolveOrCreateCustomer(admin, table, edited.customer)
    if (resolution.status === 'ambiguous' || resolution.status === 'insufficient') throw new Error(resolution.reason)
    customerRow = resolution.customer
    customerCreated = Boolean(resolution.created)
  }

  const document = {
    ...edited,
    documentType,
    source: { name: row.attachment_filename, type: 'application/pdf', size: row.attachment_size, dataUri },
    warnings: [], // reviewed and explicitly approved by an admin - not carried forward as an unresolved warning
  }
  document.items = edited.items.map(item => ({ ...item, suspiciousNegative: false })) // admin has explicitly confirmed every value during review

  const created = await createRecordFromImport(admin, table, document, customerRow, document.source)
  const detectedNumber = documentType === 'credit_note' ? edited.creditNote?.creditNumber : edited.invoice?.invoiceNumber

  const { error: statusErr } = await admin.from(table('email_imports')).update({
    status: 'imported', document_type: documentType, detected_customer_id: customerRow.id, detected_customer_name: customerRow.company_name,
    detected_invoice_number: detectedNumber || null, invoice_id: created.invoiceId || null, credit_note_id: created.creditNoteId || null,
    file_id: created.fileId || row.file_id, customer_created: customerCreated, error_message: null, processed_at: new Date().toISOString(),
  }).eq('id', row.id)
  if (statusErr) throw statusErr

  if (changes.length) {
    // Lightweight audit trail (item 15): who corrected what, when, attached
    // to the created record so it's visible without a separate audit table.
    const targetId = created.invoiceId || created.creditNoteId
    const targetTable = created.invoiceId ? 'invoices' : 'credit_notes'
    const { data: targetRow } = await admin.from(table(targetTable)).select('imported_metadata').eq('id', targetId).maybeSingle()
    await admin.from(table(targetTable)).update({
      imported_metadata: { ...(targetRow?.imported_metadata || {}), reviewCorrections: { changes, reviewedBy: reviewerName || 'admin', reviewedAt: new Date().toISOString() } },
    }).eq('id', targetId)
  }

  await notify(admin, table, {
    type: documentType === 'credit_note' ? 'credit_note_imported' : 'invoice_imported',
    title: `${documentType === 'credit_note' ? 'Credit note' : 'Invoice'} approved after review`,
    message: `${detectedNumber || row.attachment_filename} for ${customerRow.company_name} was approved and imported${changes.length ? ` with ${changes.length} correction(s)` : ''}.`,
    targetType: created.invoiceId ? 'invoice' : 'credit_note', targetId: created.invoiceId || created.creditNoteId,
  })

  return { status: 'imported', invoiceId: created.invoiceId, creditNoteId: created.creditNoteId, changes }
}

/** Marks a reviewed document as rejected - kept for audit/history, never
 *  creates or alters any invoice/customer/balance. */
export async function rejectReview(admin, table, emailImportId, reason, reviewerName) {
  const { data: row, error } = await admin.from(table('email_imports')).select('id, status, attachment_filename').eq('id', emailImportId).maybeSingle()
  if (error) throw error
  if (!row) throw new Error('That email import record no longer exists.')
  if (!['needs_review', 'failed'].includes(row.status)) throw new Error(`Only "Needs Review" or "Failed" imports can be rejected (this one is "${row.status}").`)
  const { error: updateErr } = await admin.from(table('email_imports')).update({
    status: 'rejected', error_message: (reason ? String(reason).slice(0, 500) : 'Rejected by admin during review.'),
    processed_at: new Date().toISOString(),
  }).eq('id', row.id)
  if (updateErr) throw updateErr
  await notify(admin, table, {
    type: 'email_import_rejected', title: 'Email import rejected', message: `"${row.attachment_filename}" was reviewed and rejected${reviewerName ? ` by ${reviewerName}` : ''}.`,
    targetType: 'email_import', targetId: row.id,
  })
  return { status: 'rejected' }
}
