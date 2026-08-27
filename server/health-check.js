import { generateAndAttachCanonicalPdf } from './email-import/create-records.js'

/** Europe/London wall-clock hour/minute/date, DST-aware via Intl (no manual
 *  GMT/BST offset math - the ICU timezone database handles it). */
export function ukLocalParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const get = type => parts.find(p => p.type === type)?.value
  return { hour: Number(get('hour')), minute: Number(get('minute')), dateKey: `${get('year')}-${get('month')}-${get('day')}` }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Runs the nightly production health check: counts the day's activity,
 *  repairs a small set of well-defined, non-financial technical problems,
 *  and flags anything requiring judgement as "Needs Review" instead of
 *  guessing. Never touches invoice totals, payments, customer balances
 *  beyond a deterministic recompute from existing invoices, or credit note
 *  allocations - see the inline comments on each check for exactly why it's
 *  safe (or not) to auto-repair. */
export async function runHealthCheck(admin, table) {
  const since = new Date(Date.now() - DAY_MS).toISOString()
  const summary = {
    newCustomers: 0, customersAutoCreated: 0, invoicesImported: 0, creditNotesImported: 0, pdfsGenerated: 0,
    paymentsRecorded: 0, paidInvoices: 0, outstandingInvoices: 0, emailsSent: 0, remindersSent: 0, emailsFailed: 0,
    documentsReceived: 0, needsReview: 0, errorsFound: 0, autoFixed: 0,
  }
  const issues = [] // { severity: 'fixed' | 'review', text }
  // Structured detail for the daily email's tables - kept alongside the
  // free-text `issues` list rather than replacing it, since the bell
  // notifications and existing callers only need the text form.
  const details = { newCustomers: [], problemInvoices: [], creditNotes: [], payments: [], largePayments: [] }

  const [customersRes, invoicesRes, creditNotesRes, paymentsRes, emailImportsRes, commLogsRes] = await Promise.all([
    admin.from(table('customers')).select('id,company_name,customer_number,balance,created_at'),
    admin.from(table('invoices')).select('id,invoice_number,customer_id,amount,amount_paid,status,canonical_document_id,source_document_id,created_at'),
    admin.from(table('credit_notes')).select('id,credit_number,customer_id,amount,remaining_balance,linked_invoice_id,original_invoice_reference,created_at'),
    admin.from(table('payments')).select('id,customer_id,amount,payment_reference,created_at').gte('created_at', since),
    admin.from(table('email_imports')).select('id,status,document_type,attachment_filename,error_message,created_at,invoice_id,credit_note_id,detected_customer_id,detected_customer_name,detected_invoice_number'),
    admin.from(table('communication_logs')).select('id,status,channel,communication_type,created_at').gte('created_at', since),
  ])
  const failure = [customersRes, invoicesRes, creditNotesRes, paymentsRes, emailImportsRes, commLogsRes].find(r => r.error)
  if (failure) throw failure.error

  const customers = customersRes.data || []
  const invoices = invoicesRes.data || []
  const creditNotes = creditNotesRes.data || []
  const emailImports = emailImportsRes.data || []
  const commLogs = commLogsRes.data || []

  const customersById = new Map(customers.map(c => [c.id, c]))
  const invoiceCountByCustomer = new Map()
  for (const invoice of invoices) invoiceCountByCustomer.set(invoice.customer_id, (invoiceCountByCustomer.get(invoice.customer_id) || 0) + 1)

  summary.newCustomers = customers.filter(c => c.created_at >= since).length
  details.newCustomers = customers.filter(c => c.created_at >= since).map(c => ({
    name: c.company_name, accountNumber: c.customer_number, balance: Number(c.balance || 0),
    invoiceCount: invoiceCountByCustomer.get(c.id) || 0,
  }))
  details.payments = (paymentsRes.data || []).map(p => ({
    customerName: customersById.get(p.customer_id)?.company_name || 'Unknown', reference: p.payment_reference, amount: Number(p.amount || 0),
  }))
  details.largePayments = details.payments.filter(p => p.amount >= 500).sort((a, b) => b.amount - a.amount)
  details.creditNotes = creditNotes.filter(c => c.created_at >= since).map(c => ({
    customerName: customersById.get(c.customer_id)?.company_name || 'Unknown', creditNumber: c.credit_number, amount: Number(c.amount || 0),
    allocated: Number(c.remaining_balance) !== Number(c.amount),
  }))
  summary.invoicesImported = invoices.filter(i => i.created_at >= since).length
  summary.creditNotesImported = creditNotes.filter(c => c.created_at >= since).length
  summary.paymentsRecorded = (paymentsRes.data || []).length
  summary.paidInvoices = invoices.filter(i => i.status === 'Paid').length
  summary.outstandingInvoices = invoices.filter(i => i.status !== 'Paid').length
  summary.documentsReceived = emailImports.filter(e => e.created_at >= since).length
  summary.customersAutoCreated = emailImports.filter(e => e.created_at >= since && e.status === 'imported').length // approx, refined below once we have the flag
  summary.emailsSent = commLogs.filter(c => c.status === 'Sent').length
  summary.emailsFailed = commLogs.filter(c => c.status === 'Failed').length
  summary.remindersSent = commLogs.filter(c => c.status === 'Sent' && c.communication_type === 'payment_reminder').length

  // --- Check + auto-repair: invoice missing its generated PDF, or the PDF
  // row it points to no longer exists (broken storage reference). Safe to
  // auto-fix: regenerating from the invoice's own already-stored line items
  // reproduces exactly what import-time generation would have produced -
  // it's not a financial decision, just re-running a deterministic render.
  const canonicalIds = invoices.map(i => i.canonical_document_id).filter(Boolean)
  const { data: canonicalFiles } = canonicalIds.length ? await admin.from(table('activity_log')).select('id').in('id', canonicalIds) : { data: [] }
  const existingCanonicalIds = new Set((canonicalFiles || []).map(f => f.id))
  const invoicesNeedingPdf = invoices.filter(i => !i.canonical_document_id || !existingCanonicalIds.has(i.canonical_document_id))
  // Populated below whenever this loop already reports an invoice as having
  // no line items, so the separate items-only check further down doesn't
  // flag the same invoice a second time under a near-identical message -
  // one root cause (no items ever existed for this invoice) should read as
  // one review item, not two.
  const flaggedNoItems = new Set()
  for (const invoice of invoicesNeedingPdf) {
    try {
      const [{ data: customer }, { data: items }] = await Promise.all([
        admin.from(table('customers')).select('*').eq('id', invoice.customer_id).maybeSingle(),
        admin.from(table('invoice_items')).select('*').eq('invoice_id', invoice.id),
      ])
      if (!customer) { issues.push({ severity: 'review', text: `Invoice ${invoice.invoice_number} is missing its generated PDF and has no matching customer to build one from.` }); summary.needsReview += 1; details.problemInvoices.push({ customerName: 'Unknown', accountNumber: '', invoiceNumber: invoice.invoice_number, amount: Number(invoice.amount || 0), status: invoice.status, issue: 'Missing generated PDF, no matching customer' }); continue }
      if (!items?.length) { issues.push({ severity: 'review', text: `Invoice ${invoice.invoice_number} is missing its generated PDF and has no stored line items to build one from.` }); summary.needsReview += 1; flaggedNoItems.add(invoice.id); details.problemInvoices.push({ customerName: customer.company_name, accountNumber: customer.customer_number, invoiceNumber: invoice.invoice_number, amount: Number(invoice.amount || 0), status: invoice.status, issue: 'Missing generated PDF, no line items' }); continue }
      await generateAndAttachCanonicalPdf(admin, table, invoice, customer, items)
      summary.pdfsGenerated += 1; summary.autoFixed += 1
      issues.push({ severity: 'fixed', text: `Generated the missing official PDF for invoice ${invoice.invoice_number}.` })
    } catch (error) {
      summary.needsReview += 1
      issues.push({ severity: 'review', text: `Invoice ${invoice.invoice_number} is missing its generated PDF and it could not be regenerated automatically: ${error.message}` })
      details.problemInvoices.push({ customerName: customersById.get(invoice.customer_id)?.company_name || 'Unknown', accountNumber: customersById.get(invoice.customer_id)?.customer_number || '', invoiceNumber: invoice.invoice_number, amount: Number(invoice.amount || 0), status: invoice.status, issue: 'PDF generation failed' })
    }
  }

  // --- Check (flag only): invoice with zero stored line items. Can't be
  // auto-repaired - fabricating product rows would be guessing at what was
  // actually invoiced.
  //
  // Paginated rather than one .select().in() call: PostgREST caps a single
  // response at 1000 rows, and a customer base this size already has over
  // 1000 invoice_items rows across ~320 invoices - a single unpaginated
  // fetch silently truncated the result and wrongly flagged every invoice
  // whose items happened to land past row 1000 as having none at all
  // (confirmed live: ~300 invoices - including some just imported this
  // session with visibly non-empty items - were false-flagged this way).
  const invoiceIds = invoices.map(i => i.id)
  const invoicesWithItems = new Set()
  if (invoiceIds.length) {
    const pageSize = 1000
    for (let offset = 0; ; offset += pageSize) {
      const { data: page, error: pageErr } = await admin.from(table('invoice_items')).select('invoice_id').in('invoice_id', invoiceIds).range(offset, offset + pageSize - 1)
      if (pageErr) throw pageErr
      for (const row of page || []) invoicesWithItems.add(row.invoice_id)
      if (!page || page.length < pageSize) break
    }
  }
  for (const invoice of invoices) {
    if (!invoicesWithItems.has(invoice.id) && !flaggedNoItems.has(invoice.id)) {
      summary.needsReview += 1
      issues.push({ severity: 'review', text: `Invoice ${invoice.invoice_number} has no stored product line items.` })
      details.problemInvoices.push({ customerName: customersById.get(invoice.customer_id)?.company_name || 'Unknown', accountNumber: customersById.get(invoice.customer_id)?.customer_number || '', invoiceNumber: invoice.invoice_number, amount: Number(invoice.amount || 0), status: invoice.status, issue: 'No product line items' })
    }
  }

  // --- Check + auto-repair: customer.balance doesn't match the deterministic
  // recompute from their own invoices. Safe to auto-fix - this is exactly
  // the same formula recordInvoicePayment/createRecordFromImport already use
  // to set it; correcting it is fixing a stale cache, not inventing a
  // transaction.
  const invoicesByCustomer = new Map()
  for (const invoice of invoices) {
    if (!invoicesByCustomer.has(invoice.customer_id)) invoicesByCustomer.set(invoice.customer_id, [])
    invoicesByCustomer.get(invoice.customer_id).push(invoice)
  }
  for (const customer of customers) {
    const theirInvoices = invoicesByCustomer.get(customer.id) || []
    // Net every unpaid invoice's remaining amount together BEFORE flooring
    // at zero (not per-invoice) - a customer can legitimately have a
    // negative-amount "invoice" that is really a reversal against an
    // earlier charge (confirmed on real statement/invoice data), and it
    // must be allowed to reduce what they owe overall. Flooring each line
    // individually before summing would silently overstate the balance by
    // exactly the value of every such reversal.
    const expected = Math.max(0, theirInvoices.filter(i => i.status !== 'Paid').reduce((sum, i) => sum + (Number(i.amount || 0) - Number(i.amount_paid || 0)), 0))
    const actual = Number(customer.balance || 0)
    if (Math.abs(expected - actual) > 0.01) {
      const { error } = await admin.from(table('customers')).update({ balance: expected }).eq('id', customer.id)
      if (!error) {
        summary.autoFixed += 1
        issues.push({ severity: 'fixed', text: `Corrected ${customer.company_name}'s balance (was £${actual.toFixed(2)}, recalculated to £${expected.toFixed(2)}).` })
      } else {
        summary.needsReview += 1
        issues.push({ severity: 'review', text: `${customer.company_name}'s balance looks wrong (stored £${actual.toFixed(2)}, expected £${expected.toFixed(2)}) and could not be corrected automatically.` })
      }
    }
  }

  // --- Check + auto-repair: email import stuck in "processing" (the worker
  // crashed or the invocation was killed mid-way, and it was never resolved
  // to a final status). Safe to auto-fix - this only changes the tracking
  // row's own status to "failed" with an explanatory note, so the admin can
  // retry it from Email Imports; it never touches any invoice/customer data.
  const stuckCutoff = new Date(Date.now() - 15 * 60_000).toISOString()
  const stuck = emailImports.filter(e => e.status === 'processing' && e.created_at < stuckCutoff)
  for (const row of stuck) {
    const { error } = await admin.from(table('email_imports')).update({ status: 'failed', error_message: 'Stuck in Processing - the mailbox worker did not finish (likely a timeout or crash). Retry it from Email Imports.', processed_at: new Date().toISOString() }).eq('id', row.id)
    if (!error) {
      summary.autoFixed += 1
      issues.push({ severity: 'fixed', text: `Email import "${row.attachment_filename}" was stuck in Processing and has been marked Failed so it can be retried.` })
    }
  }

  // --- Check (flag only): credit note never allocated to an invoice despite
  // referencing one, or sitting unallocated for a while. Applying it
  // automatically would be an accounting decision - always flagged instead.
  for (const note of creditNotes) {
    const untouched = Number(note.remaining_balance) === Number(note.amount)
    const hasReference = Boolean(note.linked_invoice_id || note.original_invoice_reference)
    const isOld = note.created_at < since
    if (untouched && hasReference && isOld) {
      summary.needsReview += 1
      issues.push({ severity: 'review', text: `Credit note ${note.credit_number} references an invoice but has not been allocated to it yet.` })
    }
  }

  // --- Check (flag only): duplicate invoice/credit-note numbers - should be
  // prevented at creation time already, this is a safety-net sweep.
  //
  // Scoped per customer (customer_id + number), matching migration 028's DB
  // constraint and the business rule established this session: Punjab's
  // independent traders each run their own numbering, so two different
  // customers legitimately sharing invoice number "1" is normal, not a
  // duplicate. A raw cross-customer count here was false-flagging dozens of
  // genuine invoices (confirmed live: "1" appeared 60 times, each for a
  // different customer, 0 actual same-customer collisions).
  const invoiceNumberCounts = new Map()
  for (const invoice of invoices) {
    const key = `${invoice.customer_id}:${invoice.invoice_number}`
    invoiceNumberCounts.set(key, (invoiceNumberCounts.get(key) || 0) + 1)
  }
  for (const [key, count] of invoiceNumberCounts) {
    if (count > 1) { summary.needsReview += 1; issues.push({ severity: 'review', text: `Invoice number "${key.split(':')[1]}" appears ${count} times for customer ${customersById.get(key.split(':')[0])?.company_name || key.split(':')[0]}.` }) }
  }
  const creditNumberCounts = new Map()
  for (const note of creditNotes) {
    if (!note.credit_number) continue
    const key = `${note.customer_id}:${note.credit_number}`
    creditNumberCounts.set(key, (creditNumberCounts.get(key) || 0) + 1)
  }
  for (const [key, count] of creditNumberCounts) {
    if (count > 1) { summary.needsReview += 1; issues.push({ severity: 'review', text: `Credit note number "${key.split(':')[1]}" appears ${count} times for customer ${customersById.get(key.split(':')[0])?.company_name || key.split(':')[0]}.` }) }
  }

  // --- Check (flag only): email imports still sitting in Needs Review.
  const needsReviewImports = emailImports.filter(e => e.status === 'needs_review')
  if (needsReviewImports.length) {
    summary.needsReview += needsReviewImports.length
    issues.push({ severity: 'review', text: `${needsReviewImports.length} email import(s) are waiting in Needs Review.` })
  }
  details.documentsNeedingReview = needsReviewImports.map(e => ({
    filename: e.attachment_filename, customerName: e.detected_customer_name || 'Unidentified', reason: e.error_message || 'Needs review',
  }))

  // --- Report only: failed emails/reminders in the last 24h (not auto-
  // retried - could be a real delivery problem worth a human look, not
  // something to silently resend).
  const failedComms = commLogs.filter(c => c.status === 'Failed')
  if (failedComms.length) {
    summary.needsReview += failedComms.length
    issues.push({ severity: 'review', text: `${failedComms.length} email(s) failed to send in the last 24 hours.` })
  }

  // --- Report only: email activity broken down by type - invoice sends,
  // 14/21-day reminders, password resets, admin invitations, etc, each with
  // sent vs failed counts, for the "Email Activity" section of the daily
  // summary.
  const emailBreakdownMap = new Map()
  for (const log of commLogs) {
    const key = log.communication_type || log.channel || 'other'
    if (!emailBreakdownMap.has(key)) emailBreakdownMap.set(key, { type: key, sent: 0, failed: 0 })
    const bucket = emailBreakdownMap.get(key)
    if (log.status === 'Sent') bucket.sent += 1
    else if (log.status === 'Failed') bucket.failed += 1
  }
  details.emailActivity = [...emailBreakdownMap.values()].sort((a, b) => (b.sent + b.failed) - (a.sent + a.failed))

  summary.errorsFound = summary.needsReview + summary.autoFixed

  // --- Write bell notifications for anything an admin should actually see:
  // every auto-repaired PDF (so it's visible even though nothing "broke" from
  // their perspective) and one aggregate notification for review items,
  // rather than a row per review issue (which could be dozens after a bad
  // night and would just spam the bell) - the daily summary email carries the
  // full text list already.
  for (const issue of issues) {
    if (issue.severity === 'fixed' && issue.text.startsWith('Generated the missing official PDF')) {
      await admin.from(table('notifications')).insert({
        type: 'pdf_regenerated', title: 'PDF successfully regenerated', message: issue.text, target_type: 'system', created_by: 'nightly-health-check',
      })
    }
  }
  if (summary.needsReview > 0) {
    await admin.from(table('notifications')).insert({
      type: 'system_health_issue',
      title: `Nightly health check: ${summary.needsReview} item${summary.needsReview === 1 ? '' : 's'} need review`,
      message: issues.filter(i => i.severity === 'review').slice(0, 5).map(i => i.text).join(' · '),
      target_type: 'system', created_by: 'nightly-health-check',
    })
  }

  return { summary, issues, details }
}
