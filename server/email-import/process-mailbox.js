import { createHash } from 'node:crypto'
import { simpleParser } from 'mailparser'
import { openImapConnection } from './imap-client.js'
import { extractPdfTextLines } from './extract-pdf-text.js'
// Compiled from src/lib/invoiceImport.ts by `tsc -p tsconfig.server.json`
// (part of `npm run build`) - see create-records.js's comment on the same
// import for why the raw .ts source can't be imported directly here.
import { detectImportDocumentType, parseLegacyInvoiceLines, parseCreditNoteLines } from '../../server-dist/lib/invoiceImport.js'
import { assessConfidence, createRecordFromImport, resolveOrCreateCustomer, safeFileName, uploadFileServer, MAX_FILE_BYTES } from './create-records.js'

const SCAN_WINDOW_DAYS = 14 // bounds the IMAP search; the (message_id, attachment_filename) unique row is what actually prevents reprocessing
const MAX_MESSAGE_DOWNLOAD_BYTES = 20 * 1024 * 1024
// One invocation must finish inside the serverless function's own time
// limit (api/cron-check-mailbox.js sets maxDuration: 60, the max Vercel
// Hobby allows) regardless of how many emails are waiting - a burst of 100
// forwarded invoices must not time out mid-batch and leave the run half
// done. Each message stops being picked up once this budget is spent; the
// UID cursor only advances past what was actually finished, so whatever's
// left is simply picked up by the next poll a few seconds/minutes later -
// nothing is skipped, it's just spread across more than one invocation.
const TIME_BUDGET_MS = 50_000

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

/** True only for attachments that are genuinely PDFs - filename/content-type
 *  claims are not trusted, the byte signature is checked too (item 3-4 of the
 *  spec: "only process supported PDF attachments... ignore irrelevant inline
 *  images, signatures, logos"). */
function isRealPdfAttachment(attachment) {
  if (attachment.contentDisposition !== 'attachment' && !attachment.filename) return false
  const name = String(attachment.filename || '')
  const looksLikePdf = attachment.contentType === 'application/pdf' || /\.pdf$/i.test(name)
  if (!looksLikePdf) return false
  return Buffer.isBuffer(attachment.content) && attachment.content.subarray(0, 5).toString('latin1') === '%PDF-'
}

export async function processAttachment(admin, table, { messageId, uid, sender, subject, receivedAt, attachment }) {
  let filename
  try { filename = safeFileName(attachment.filename || 'attachment.pdf') } catch { filename = `email-attachment-${Date.now()}.pdf` }
  const size = attachment.size ?? attachment.content.length
  const hash = createHash('sha256').update(attachment.content).digest('hex')

  // Dedupe #1: this exact message+attachment is already tracked - the table
  // (not IMAP flags) is the durable record, so a restart/redeploy never
  // reprocesses something already seen.
  const { data: existingRow } = await admin.from(table('email_imports')).select('id').eq('message_id', messageId).eq('attachment_filename', filename).maybeSingle()
  if (existingRow) return null

  const baseRow = {
    id: `ei-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    message_id: messageId, uid, received_at: receivedAt, sender, subject,
    attachment_filename: filename, attachment_hash: hash, attachment_size: size,
    status: 'processing',
  }

  if (size > MAX_FILE_BYTES) {
    await admin.from(table('email_imports')).insert({ ...baseRow, status: 'failed', error_message: `Attachment is ${(size / 1024 / 1024).toFixed(1)} MB - the limit is 2 MB, same as the manual uploader.`, processed_at: new Date().toISOString() })
    return 'failed'
  }

  // Dedupe #2: same PDF content already successfully imported under a
  // different email (forwarded twice, from a different sender, etc).
  const { data: dupe } = await admin.from(table('email_imports')).select('document_type,detected_customer_id,detected_customer_name,detected_invoice_number,invoice_id,credit_note_id,file_id').eq('attachment_hash', hash).eq('status', 'imported').limit(1).maybeSingle()
  if (dupe) {
    await admin.from(table('email_imports')).insert({
      ...baseRow, status: 'duplicate', document_type: dupe.document_type, detected_customer_id: dupe.detected_customer_id,
      detected_customer_name: dupe.detected_customer_name, detected_invoice_number: dupe.detected_invoice_number,
      invoice_id: dupe.invoice_id, credit_note_id: dupe.credit_note_id, file_id: dupe.file_id,
      error_message: 'This PDF was already imported from a previous email.', processed_at: new Date().toISOString(),
    })
    return 'duplicate'
  }

  const { error: insertError } = await admin.from(table('email_imports')).insert(baseRow)
  if (insertError) return null // another concurrent poll already claimed this attachment

  try {
    const lines = await extractPdfTextLines(attachment.content)
    if (!lines.length) {
      await admin.from(table('email_imports')).update({ status: 'needs_review', error_message: 'No extractable text was found in this PDF (it may be a scanned image). Open it from Email Imports and re-import it manually.', processed_at: new Date().toISOString() }).eq('id', baseRow.id)
      return 'needs_review'
    }

    const documentType = detectImportDocumentType(lines)
    const document = documentType === 'credit_note' ? parseCreditNoteLines(lines) : parseLegacyInvoiceLines(lines)
    const dataUri = `data:application/pdf;base64,${attachment.content.toString('base64')}`
    document.source = { name: filename, type: 'application/pdf', size, dataUri }

    // Resolve to an existing customer, or create one from the invoice's own
    // details when none matches (never for a credit note on its own - same
    // rule the manual "Add Customer via PDF" flow uses).
    const resolution = await resolveOrCreateCustomer(admin, table, document.customer, { allowCreate: documentType === 'invoice' })
    const customerRow = resolution.customer ?? null
    const detectedNumber = documentType === 'credit_note' ? document.creditNote.creditNumber : document.invoice.invoiceNumber
    const { confident, reasons } = assessConfidence(document, resolution)

    if (!confident) {
      // Store the PDF now (tagged "pending review", not linked to any
      // invoice yet) so the admin can view/download/retry it from the Email
      // Imports page without needing to go back to the original email.
      const pending = await uploadFileServer(admin, table, { name: filename, type: 'application/pdf', size, dataUri, note: `Email import (needs review): ${filename}`, customerId: customerRow?.id ?? null, customerName: customerRow?.company_name ?? document.customer.companyName ?? 'Unmatched', document: { documentRole: 'general' } })
      await admin.from(table('email_imports')).update({
        status: 'needs_review', document_type: documentType, detected_customer_id: customerRow?.id || null,
        detected_customer_name: customerRow?.company_name || document.customer.companyName || null, detected_invoice_number: detectedNumber || null,
        file_id: pending.id, error_message: reasons.join(' ').slice(0, 500), processed_at: new Date().toISOString(),
      }).eq('id', baseRow.id)
      return 'needs_review'
    }

    const created = await createRecordFromImport(admin, table, document, customerRow, document.source)
    await admin.from(table('email_imports')).update({
      status: 'imported', document_type: documentType, detected_customer_id: customerRow.id, detected_customer_name: customerRow.company_name,
      detected_invoice_number: detectedNumber, invoice_id: created.invoiceId || null, credit_note_id: created.creditNoteId || null,
      file_id: created.fileId || null, customer_created: Boolean(resolution.created), processed_at: new Date().toISOString(),
    }).eq('id', baseRow.id)
    return 'imported'
  } catch (error) {
    const status = error?.code === 'duplicate' ? 'duplicate' : 'failed'
    const update = { status, error_message: String(error?.message || error).slice(0, 500), processed_at: new Date().toISOString() }
    if (status === 'failed') {
      try {
        const dataUri = `data:application/pdf;base64,${attachment.content.toString('base64')}`
        const pending = await uploadFileServer(admin, table, { name: filename, type: 'application/pdf', size, dataUri, note: `Email import (failed): ${filename}`, customerId: null, customerName: 'Unmatched', document: { documentRole: 'general' } })
        update.file_id = pending.id
      } catch { /* storing the fallback copy is best-effort - the failure status/reason is what matters */ }
    }
    await admin.from(table('email_imports')).update(update).eq('id', baseRow.id)
    return status
  }
}

/** Polls the IONOS mailbox for new PDF attachments, running each one through
 *  the same parse -> match -> create pipeline the manual uploader uses.
 *  Read-only against the mailbox itself - never deletes, moves, or flags
 *  anything, so the email stays exactly where the admin can still find it. */
export async function processMailbox(admin, table, testMode = false) {
  const client = openImapConnection()
  const summary = { checked: 0, imported: 0, needs_review: 0, failed: 0, duplicate: 0, skipped_no_pdf: 0, errors: [] }
  const cursorId = testMode ? 'test' : 'live'
  await client.connect()
  try {
    await client.mailboxOpen('INBOX', { readOnly: true })
    // Resume from the highest UID already scanned instead of re-downloading
    // and re-parsing every message in the window on every poll - important
    // once this runs every few minutes. Tracked separately from
    // email_imports (which only gets a row when a PDF was actually found)
    // via email_import_cursor. The (message_id, attachment_filename) dedupe
    // check still guards against ever double-processing regardless.
    const { data: cursor } = await admin.from('email_import_cursor').select('last_uid').eq('id', cursorId).maybeSingle()
    let uids
    if (cursor?.last_uid) {
      // IMAP normalizes a "N:*" range where N exceeds the highest UID in the
      // mailbox down to just the single highest-UID message (RFC 3501) -
      // filter that stray match back out explicitly so a fully-caught-up
      // mailbox doesn't re-download the same last message on every poll.
      uids = ((await client.search({ uid: `${cursor.last_uid + 1}:*` }, { uid: true })) || []).filter(uid => uid > cursor.last_uid)
    } else {
      const since = new Date(Date.now() - SCAN_WINDOW_DAYS * 86_400_000)
      uids = (await client.search({ since }, { uid: true })) || []
    }
    let highestUidSeen = cursor?.last_uid || 0
    const startedAt = Date.now()
    for (const [index, uid] of uids.entries()) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        summary.deferred = uids.length - index // remaining, unprocessed - picked up next poll
        break
      }
      highestUidSeen = Math.max(highestUidSeen, uid)
      let raw
      try {
        const { content } = await client.download(uid, undefined, { uid: true, maxBytes: MAX_MESSAGE_DOWNLOAD_BYTES })
        raw = await streamToBuffer(content)
      } catch (error) {
        summary.errors.push(`uid ${uid}: could not download - ${error.message}`)
        continue
      }
      let parsedEmail
      try { parsedEmail = await simpleParser(raw) } catch (error) { summary.errors.push(`uid ${uid}: could not parse email - ${error.message}`); continue }

      const messageId = parsedEmail.messageId || `no-message-id-uid-${uid}`
      const sender = parsedEmail.from?.text || ''
      const subject = parsedEmail.subject || ''
      const receivedAt = (parsedEmail.date || new Date()).toISOString()
      const pdfAttachments = (parsedEmail.attachments || []).filter(isRealPdfAttachment)

      summary.checked += 1
      if (!pdfAttachments.length) { summary.skipped_no_pdf += 1; continue }

      for (const attachment of pdfAttachments) {
        const outcome = await processAttachment(admin, table, { messageId, uid, sender, subject, receivedAt, attachment })
        if (outcome) summary[outcome] = (summary[outcome] || 0) + 1
      }
    }
    if (highestUidSeen > (cursor?.last_uid || 0)) {
      await admin.from('email_import_cursor').upsert({ id: cursorId, last_uid: highestUidSeen, updated_at: new Date().toISOString() })
    }
  } finally {
    await client.logout().catch(() => client.close())
  }
  return summary
}

/** Re-runs the parse -> match -> create pipeline against an already-stored
 *  email attachment (needs_review or failed rows only) - no IMAP connection
 *  needed, since the PDF bytes were already saved to activity_log the first
 *  time round. Lets the admin fix a "needs review" row (optionally forcing a
 *  specific customer) without finding the original email and re-uploading. */
export async function retryEmailImport(admin, table, emailImportId, customerIdOverride) {
  const { data: row, error: rowErr } = await admin.from(table('email_imports')).select('*').eq('id', emailImportId).maybeSingle()
  if (rowErr) throw rowErr
  if (!row) throw new Error('That email import record no longer exists.')
  if (!['needs_review', 'failed'].includes(row.status)) throw new Error(`Only "Needs Review" or "Failed" imports can be retried (this one is "${row.status}").`)
  if (!row.file_id) throw new Error('The original PDF was not stored, so this cannot be retried automatically. Re-forward the email instead.')

  const { data: fileRow, error: fileErr } = await admin.from(table('activity_log')).select('action').eq('id', row.file_id).maybeSingle()
  if (fileErr) throw fileErr
  if (!fileRow?.action?.startsWith('data:application/pdf;base64,')) throw new Error('The stored PDF could not be found.')
  const buffer = Buffer.from(fileRow.action.slice(fileRow.action.indexOf(',') + 1), 'base64')

  const lines = await extractPdfTextLines(buffer)
  if (!lines.length) throw new Error('No extractable text was found in this PDF. Open it from Files and import it manually instead.')
  const documentType = detectImportDocumentType(lines)
  const document = documentType === 'credit_note' ? parseCreditNoteLines(lines) : parseLegacyInvoiceLines(lines)
  document.source = { name: row.attachment_filename, type: 'application/pdf', size: row.attachment_size, dataUri: fileRow.action }

  let customerRow = null
  let customerCreated = false
  if (customerIdOverride) {
    // Admin explicitly picked a customer from the review-queue UI - always
    // respected as-is, no auto-create, no re-matching.
    const { data } = await admin.from(table('customers')).select('*').eq('id', customerIdOverride).maybeSingle()
    customerRow = data || null
  } else {
    const resolution = await resolveOrCreateCustomer(admin, table, document.customer, { allowCreate: documentType === 'invoice' })
    if (resolution.status === 'ambiguous' || resolution.status === 'insufficient') {
      await admin.from(table('email_imports')).update({
        status: 'needs_review', document_type: documentType, detected_customer_name: document.customer.companyName || null,
        error_message: resolution.reason, processed_at: new Date().toISOString(),
      }).eq('id', row.id)
      throw new Error(resolution.reason)
    }
    customerRow = resolution.customer
    customerCreated = Boolean(resolution.created)
  }

  const detectedNumber = documentType === 'credit_note' ? document.creditNote.creditNumber : document.invoice.invoiceNumber
  const { confident, reasons } = assessConfidence(document, customerRow ? { status: 'matched', customer: customerRow } : {})
  if (!confident) {
    await admin.from(table('email_imports')).update({
      status: 'needs_review', document_type: documentType, detected_customer_id: customerRow?.id || null,
      detected_customer_name: customerRow?.company_name || document.customer.companyName || null, detected_invoice_number: detectedNumber || null,
      error_message: reasons.join(' ').slice(0, 500), processed_at: new Date().toISOString(),
    }).eq('id', row.id)
    throw new Error(reasons.join(' '))
  }

  const created = await createRecordFromImport(admin, table, document, customerRow, document.source)
  await admin.from(table('email_imports')).update({
    status: 'imported', document_type: documentType, detected_customer_id: customerRow.id, detected_customer_name: customerRow.company_name,
    detected_invoice_number: detectedNumber, invoice_id: created.invoiceId || null, credit_note_id: created.creditNoteId || null,
    file_id: created.fileId || row.file_id, customer_created: customerCreated, error_message: null, processed_at: new Date().toISOString(),
  }).eq('id', row.id)
  return { status: 'imported' }
}
