import { useMemo, useState } from 'react'
import type { Customer, CreditNote, CreditNoteAllocation, Invoice } from '../../types'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/Table'
import { StoredFileModal } from '../../components/StoredFileModal'
import { classifyInvoice, invoiceDisplayStatus, invoiceOutstanding } from '../../lib/creditNotes'
import type { ReminderStage } from '../../lib/reminderTemplates'

type DueFilter = 'all' | 'overdue' | 'yesterday' | 'today' | 'tomorrow' | 'this_week' | 'next_week'
type DateFilter = 'all' | 'today' | 'yesterday' | 'this_week' | 'older'

const DUE_FILTER_LABELS: Record<DueFilter, string> = {
  all: 'All Due Dates', overdue: 'Overdue', yesterday: 'Due Yesterday', today: 'Due Today',
  tomorrow: 'Due Tomorrow', this_week: 'Due This Week', next_week: 'Due Next Week',
}
const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  all: 'All Dates', today: 'Today', yesterday: 'Yesterday', this_week: 'This Week', older: 'Older',
}

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

/** Days-from-today filter for the Open Invoices due-date dropdown - "This
    week"/"Next week" mean the calendar week (Mon-Sun) relative to today, not
    a rolling 7-day window, matching how an admin planning collections would
    naturally think about it. */
function matchesDueFilter(dueDate: string, filter: DueFilter): boolean {
  if (filter === 'all' || !dueDate) return filter === 'all'
  const due = dayStart(new Date(`${dueDate}T00:00:00`))
  if (Number.isNaN(due)) return false
  const today = dayStart(new Date())
  const diffDays = Math.round((due - today) / 86_400_000)
  if (filter === 'overdue') return diffDays < 0
  if (filter === 'yesterday') return diffDays === -1
  if (filter === 'today') return diffDays === 0
  if (filter === 'tomorrow') return diffDays === 1
  const todayDow = (new Date(today).getDay() + 6) % 7 // Monday = 0
  if (filter === 'this_week') return diffDays >= -todayDow && diffDays <= 6 - todayDow
  if (filter === 'next_week') return diffDays >= 7 - todayDow && diffDays <= 13 - todayDow
  return true
}

/** Item 11 - group/batch invoices sensibly by (issue) date. Implemented as a
    filter dropdown, same UI pattern as the existing due-date filter above,
    rather than fighting DataTable's own column sort/pagination with
    injected header rows - the admin can already sort the Date column
    newest/oldest via its header. */
function matchesDateFilter(date: string, filter: DateFilter): boolean {
  if (filter === 'all' || !date) return filter === 'all'
  const issued = dayStart(new Date(`${date}T00:00:00`))
  if (Number.isNaN(issued)) return false
  const today = dayStart(new Date())
  const diffDays = Math.round((today - issued) / 86_400_000)
  if (filter === 'today') return diffDays === 0
  if (filter === 'yesterday') return diffDays === 1
  if (filter === 'this_week') return diffDays >= 2 && diffDays <= 6
  return diffDays > 6
}

export function InvoicesPage({ invoices, customers, creditNotes = [], allocations = [], onOpenCreditNote, onNavigate, onRecordPayment, onSendReminder, onRegeneratePdf, customerId, onClearCustomerFilter }: {
  invoices: Invoice[]
  customers: Customer[]
  creditNotes?: CreditNote[]
  allocations?: CreditNoteAllocation[]
  onOpenCreditNote?: (creditNoteId: string) => void
  onNavigate?: (page: string) => void
  onRecordPayment?: (invoice: Invoice, amount: number) => Promise<void>
  /** Opens the manual reminder composer - see item 17. */
  onSendReminder?: (invoice: Invoice, customer: Customer, stage: ReminderStage) => void
  onRegeneratePdf?: (invoice: Invoice, customer: Customer) => Promise<void>
  /** Scopes the view to one customer's invoices - the "Open Invoices" link
      on a customer record (item 10-11) lands here instead of the general
      profile modal. */
  customerId?: string | null
  onClearCustomerFilter?: () => void
}) {
  const [tab, setTab] = useState<'open' | 'paid'>('open')
  const [query, setQuery] = useState('')
  const [dueFilter, setDueFilter] = useState<DueFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [viewFile, setViewFile] = useState<{ id: string; title: string } | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)

  const customerById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers])
  const scopedCustomer = customerId ? customerById.get(customerId) : null
  const scopedInvoices = useMemo(() => customerId ? invoices.filter(i => i.customerId === customerId) : invoices, [invoices, customerId])
  const notesByInvoiceId = useMemo(() => {
    const map = new Map<string, CreditNote[]>()
    for (const allocation of allocations) {
      const note = creditNotes.find(c => c.id === allocation.creditNoteId)
      if (!note) continue
      const list = map.get(allocation.invoiceId)
      if (list) list.push(note); else map.set(allocation.invoiceId, [note])
    }
    return map
  }, [allocations, creditNotes])

  const classified = useMemo(() => scopedInvoices.map(invoice => ({ invoice, kind: classifyInvoice(invoice), customer: customerById.get(invoice.customerId) })), [scopedInvoices, customerById])
  const openCount = useMemo(() => classified.filter(c => c.kind === 'open').length, [classified])
  const overdueCount = useMemo(() => classified.filter(c => c.kind === 'overdue').length, [classified])
  const paidCount = useMemo(() => classified.filter(c => c.kind === 'paid').length, [classified])

  const filtered = useMemo(() => {
    const wanted = tab === 'open' ? ['open', 'overdue'] : ['paid']
    const needle = query.trim().toLowerCase()
    return classified.filter(({ invoice, kind, customer }) => {
      if (!wanted.includes(kind)) return false
      if (tab === 'open' && !matchesDueFilter(invoice.dueDate, dueFilter)) return false
      if (!matchesDateFilter(invoice.date ?? '', dateFilter)) return false
      if (!needle) return true
      const haystack = `${customer?.companyName ?? ''} ${customer?.customerNumber ?? ''} ${invoice.invoiceNumber}`.toLowerCase()
      return haystack.includes(needle)
    })
  }, [classified, tab, query, dueFilter, dateFilter])

  const markPaid = async (invoice: Invoice) => {
    if (!onRecordPayment) return
    setPayingId(invoice.id)
    try { await onRecordPayment(invoice, invoiceOutstanding(invoice)) }
    finally { setPayingId(null) }
  }

  const regenerate = async (invoice: Invoice, customer?: Customer) => {
    if (!onRegeneratePdf || !customer) return
    setRegeneratingId(invoice.id)
    try { await onRegeneratePdf(invoice, customer) }
    finally { setRegeneratingId(null) }
  }

  const pdfActions = (invoice: Invoice, customer?: Customer) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <Button className="btn-sm" variant="secondary" disabled={!invoice.sourceDocumentId} onClick={() => setViewFile({ id: invoice.sourceDocumentId!, title: `Original — Invoice ${invoice.invoiceNumber}` })}>
        {invoice.sourceDocumentId ? 'View Original' : 'No Original'}
      </Button>
      <Button className="btn-sm" variant="secondary" disabled={!invoice.canonicalDocumentId} onClick={() => setViewFile({ id: invoice.canonicalDocumentId!, title: `Generated — Invoice ${invoice.invoiceNumber}` })}>
        {invoice.canonicalDocumentId ? 'View Generated' : 'No Generated PDF'}
      </Button>
      {onRegeneratePdf && customer && (
        <Button className="btn-sm" variant="ghost" disabled={regeneratingId === invoice.id} onClick={() => regenerate(invoice, customer)}>
          {regeneratingId === invoice.id ? 'Regenerating…' : 'Regenerate'}
        </Button>
      )}
    </div>
  )

  const openRows = useMemo(() => filtered.map(({ invoice, customer, kind }) => {
    const notes = notesByInvoiceId.get(invoice.id) ?? []
    return (
      <tr key={invoice.id}>
        <td>{customer?.companyName ?? invoice.customerId}</td>
        <td>{customer?.customerNumber ?? '—'}</td>
        <td>{invoice.invoiceNumber}</td>
        <td>{invoice.date || '—'}</td>
        <td>{invoice.dueDate}</td>
        <td>£{invoice.amount.toFixed(2)}</td>
        <td>£{invoiceOutstanding(invoice).toFixed(2)}</td>
        <td>
          <span className={`ps-badge ${kind === 'overdue' ? 'ps-badge-red' : 'ps-badge-green'}`}>{kind === 'overdue' ? 'Overdue' : invoiceDisplayStatus(invoice)}</span>
          {notes.length > 0 && <div style={{ marginTop: 4 }}>{notes.map(note => (
            <button key={note.id} type="button" onClick={() => onOpenCreditNote?.(note.id)}
              style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: onOpenCreditNote ? 'pointer' : 'default', color: '#1d4ed8', fontSize: 11.5, textDecoration: 'underline', display: 'block' }}>
              Credited by {note.creditNumber}
            </button>
          ))}</div>}
        </td>
        <td>{pdfActions(invoice, customer)}</td>
        <td>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {onSendReminder && customer && <Button className="btn-sm" onClick={() => onSendReminder(invoice, customer, kind === 'overdue' ? '21-plus' : 'day-14')}>Send Reminder</Button>}
            {onRecordPayment && <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5 }}>
              <input type="checkbox" checked={false} disabled={payingId === invoice.id} onChange={() => markPaid(invoice)} />
              {payingId === invoice.id ? 'Saving…' : 'Paid'}
            </label>}
            {customer && onNavigate && <Button className="btn-sm" variant="ghost" onClick={() => onNavigate('customers')}>Customer</Button>}
          </div>
        </td>
      </tr>
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [filtered, notesByInvoiceId, onOpenCreditNote, onRecordPayment, onSendReminder, onRegeneratePdf, payingId, regeneratingId, onNavigate])

  const paidRows = useMemo(() => filtered.map(({ invoice, customer }) => (
    <tr key={invoice.id}>
      <td>{customer?.companyName ?? invoice.customerId}</td>
      <td>{customer?.customerNumber ?? '—'}</td>
      <td>{invoice.invoiceNumber}</td>
      <td>£{invoice.amount.toFixed(2)}</td>
      <td>{invoice.date || '—'}</td>
      <td>Paid</td>
      <td>{pdfActions(invoice, customer)}</td>
    </tr>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  )), [filtered])

  return (
    <div className="stack">
      {scopedCustomer && (
        <Card title={`${scopedCustomer.companyName} — Open Invoices`} actions={onClearCustomerFilter && <Button variant="secondary" className="btn-sm" onClick={onClearCustomerFilter}>Back to All Invoices</Button>}>
          <div className="customer-finance-grid">
            <div><span>Account Number</span><strong>{scopedCustomer.customerNumber}</strong></div>
            <div><span>Outstanding Balance</span><strong>£{(scopedCustomer.balance ?? 0).toFixed(2)}</strong></div>
            <div><span>Credit Limit</span><strong>£{(scopedCustomer.creditLimit ?? 0).toFixed(2)}</strong></div>
            <div><span>Available Credit</span><strong>£{Math.max(0, (scopedCustomer.creditLimit ?? 0) - (scopedCustomer.balance ?? 0)).toFixed(2)}</strong></div>
            <div><span>Open Invoices</span><strong>{openCount}</strong></div>
            <div><span>Overdue Invoices</span><strong>{overdueCount}</strong></div>
          </div>
        </Card>
      )}

      <div className="invoice-tabs">
        <button className={`invoice-tab${tab === 'open' ? ' active' : ''}`} onClick={() => setTab('open')}>Open Invoices ({openCount + overdueCount})</button>
        <button className={`invoice-tab${tab === 'paid' ? ' active' : ''}`} onClick={() => setTab('paid')}>Paid Invoices ({paidCount})</button>
      </div>

      <Card title={tab === 'open' ? 'Open Invoices' : 'Paid Invoices'} actions={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {tab === 'open' && (
            <select className="search-input" style={{ minWidth: 150 }} value={dueFilter} onChange={e => setDueFilter(e.target.value as DueFilter)} aria-label="Filter by due date">
              {(Object.keys(DUE_FILTER_LABELS) as DueFilter[]).map(key => <option key={key} value={key}>{DUE_FILTER_LABELS[key]}</option>)}
            </select>
          )}
          <select className="search-input" style={{ minWidth: 130 }} value={dateFilter} onChange={e => setDateFilter(e.target.value as DateFilter)} aria-label="Filter by invoice date">
            {(Object.keys(DATE_FILTER_LABELS) as DateFilter[]).map(key => <option key={key} value={key}>{DATE_FILTER_LABELS[key]}</option>)}
          </select>
          <input className="search-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search customer, account number or invoice number…" />
        </div>
      }>
        {tab === 'open' ? (
          <DataTable columns={['Customer', 'Account', 'Invoice No', 'Invoice Date', 'Due Date', 'Amount', 'Outstanding', 'Status', 'PDFs', 'Actions']}>
            {openRows}
          </DataTable>
        ) : (
          <DataTable columns={['Customer', 'Account', 'Invoice No', 'Amount', 'Invoice Date', 'Status', 'PDFs']}>
            {paidRows}
          </DataTable>
        )}
      </Card>

      <StoredFileModal fileId={viewFile?.id ?? null} title={viewFile?.title ?? ''} onClose={() => setViewFile(null)} />
    </div>
  )
}
