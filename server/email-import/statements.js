// Customer statement handling for the document/email import pipeline.
//
// A statement is deliberately NOT turned into invoices/payments/credit
// notes: it summarises transactions that mostly already exist as their own
// records, so creating them again would double-count the customer's
// balance. It is stored as a customer document plus a reconciliation
// record, and any transaction the statement mentions that the system does
// NOT already hold is flagged for review rather than silently created.
import { recognisePunjabStatement, parsePunjabCustomerStatement } from '../../server-dist/lib/statementImport.js'
import { normalizeAccountNumber, normalizeCompanyName } from '../../server-dist/lib/importMatching.js'
import { uploadFileServer, notify } from './create-records.js'

const genId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
const money = n => Number(n || 0)

export { recognisePunjabStatement }

/** Statement -> existing customer, using the same priority as the invoice
 *  path (account number, then company name), but NEVER creating a customer
 *  from a statement alone: a statement is a summary document and its
 *  customer block is thinner than an invoice's, so an unmatched statement
 *  is flagged for an admin instead of risking a duplicate account. */
export async function matchStatementCustomer(admin, table, statement) {
  const { data: rows, error } = await admin.from(table('customers')).select('id, company_name, customer_number, address')
  if (error) throw error
  const customers = rows || []

  const account = normalizeAccountNumber(statement.customer.accountNumber)
  if (account) {
    const byAccount = customers.filter(c => normalizeAccountNumber(c.customer_number) === account)
    if (byAccount.length === 1) return { customer: byAccount[0], matchedOn: 'account number' }
  }
  const name = normalizeCompanyName(statement.customer.name)
  if (name) {
    const byName = customers.filter(c => normalizeCompanyName(c.company_name) === name)
    if (byName.length === 1) return { customer: byName[0], matchedOn: 'customer name' }
    if (byName.length > 1) return { ambiguous: true, reason: 'Several customers share this company name.' }
  }
  return {}
}

/** Compares the statement's own figures against what the system already
 *  holds for that customer. Read-only - it never edits an invoice, payment
 *  or balance to make the numbers agree; a mismatch is reported, not fixed. */
export async function reconcileStatement(admin, table, statement, customerId) {
  const notes = []
  const [{ data: invoices }, { data: payments }] = await Promise.all([
    admin.from(table('invoices')).select('invoice_number, amount, amount_paid, status').eq('customer_id', customerId),
    admin.from(table('payments')).select('amount').eq('customer_id', customerId),
  ])
  const systemInvoices = invoices || []
  const knownNumbers = new Set(systemInvoices.map(i => String(i.invoice_number).trim().toLowerCase()))

  // Statement lines the system has no invoice for - reported so an admin can
  // decide whether they need importing, never auto-created here.
  const missing = statement.rows.filter(row => row.invoiceNumber && !knownNumbers.has(String(row.invoiceNumber).trim().toLowerCase()))
  if (missing.length) {
    notes.push({
      type: 'missing_invoices',
      text: `${missing.length} invoice(s) on this statement are not in the system yet.`,
      examples: missing.slice(0, 10).map(r => ({ invoiceNumber: r.invoiceNumber, date: r.date, amount: r.amount })),
    })
  }

  const systemOutstanding = systemInvoices
    .filter(i => i.status !== 'Paid')
    .reduce((sum, i) => sum + Math.max(0, money(i.amount) - money(i.amount_paid)), 0)
  const statementOutstanding = money(statement.totals?.outstanding)
  const difference = Number((statementOutstanding - systemOutstanding).toFixed(2))
  if (Math.abs(difference) > 0.01) {
    notes.push({
      type: 'balance_difference',
      text: `Statement outstanding £${statementOutstanding.toFixed(2)} vs system outstanding £${systemOutstanding.toFixed(2)} (difference £${difference.toFixed(2)}).`,
      statementOutstanding, systemOutstanding, difference,
    })
  }

  if (statement.processingStatus === 'NEEDS_REVIEW' && statement.reviewReasons?.length) {
    notes.push({ type: 'parser_review', text: statement.reviewReasons.join(' ') })
  }

  const paymentsTotal = (payments || []).reduce((sum, p) => sum + money(p.amount), 0)
  return {
    status: notes.length === 0 ? 'reconciled' : 'needs_review',
    notes,
    systemOutstanding,
    systemPaymentsTotal: paymentsTotal,
  }
}

/** Full statement pipeline: parse -> match customer -> store document +
 *  statement record -> reconcile. Returns { statementId, status }. */
export async function createStatementFromImport(admin, table, lines, source) {
  const statement = parsePunjabCustomerStatement(lines)
  if (!statement) throw new Error('This looks like a statement but its contents could not be parsed.')

  const match = await matchStatementCustomer(admin, table, statement)
  if (match.ambiguous) throw new Error(match.reason)
  const customer = match.customer || null

  const statementDate = statement.statementDate || null
  const accountNumber = statement.customer.accountNumber || null

  // Same statement forwarded twice must not create a second record.
  const existing = await admin.from(table('customer_statements')).select('id')
    .eq('customer_id', customer?.id ?? '')
    .eq('statement_date', statementDate)
    .eq('account_number', accountNumber)
    .maybeSingle()
  if (existing.data) {
    const error = new Error('This statement has already been imported for that customer and date.')
    error.code = 'duplicate'
    throw error
  }

  const sourceFile = source
    ? await uploadFileServer(admin, table, {
        name: source.name, type: source.type, size: source.size, dataUri: source.dataUri,
        note: `Statements: ${statement.customer.name} ${statementDate ?? ''} (email import)`.trim(),
        customerId: customer?.id ?? null, customerName: customer?.company_name ?? statement.customer.name ?? 'Unmatched',
        document: { documentRole: 'statement_source', statementDate, accountNumber },
      })
    : undefined

  const reconciliation = customer
    ? await reconcileStatement(admin, table, statement, customer.id)
    : { status: 'unmatched_customer', notes: [{ type: 'unmatched_customer', text: 'No existing customer matched this statement, so it could not be reconciled. Link it to a customer to reconcile.' }] }

  const row = {
    id: genId('stmt'),
    customer_id: customer?.id ?? null,
    customer_name: customer?.company_name ?? statement.customer.name ?? null,
    account_number: accountNumber,
    statement_date: statementDate,
    total_invoiced: money(statement.totals?.invoiceTotal),
    total_paid: money(statement.totals?.paid),
    total_outstanding: money(statement.totals?.outstanding),
    closing_balance: money(statement.totals?.outstanding),
    invoice_count: statement.invoiceCount ?? statement.rows.length,
    reconciliation_status: reconciliation.status,
    reconciliation_notes: reconciliation.notes,
    parsed_data: { rows: statement.rows, totals: statement.totals, ageing: statement.ageing, customer: statement.customer },
    source_document_id: sourceFile?.id ?? null,
    source_file_name: sourceFile?.name ?? source?.name ?? null,
    import_source: 'email',
  }
  const { data: created, error } = await admin.from(table('customer_statements')).insert(row).select().single()
  if (error) throw error

  await notify(admin, table, {
    type: 'statement_received',
    title: reconciliation.status === 'reconciled' ? 'Statement received and reconciled' : 'Statement received - needs review',
    message: `Statement for ${row.customer_name} (${statementDate ?? 'no date'}) - outstanding £${money(statement.totals?.outstanding).toFixed(2)}.${reconciliation.notes.length ? ` ${reconciliation.notes[0].text}` : ''}`,
    targetType: 'customer', targetId: customer?.id ?? null,
  })

  return { statementId: created.id, fileId: sourceFile?.id, status: reconciliation.status, customerId: customer?.id ?? null, customerName: row.customer_name }
}
