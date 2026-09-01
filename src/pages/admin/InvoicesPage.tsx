import { useMemo, useState } from 'react'
import type { Customer, CreditNote, CreditNoteAllocation, Invoice } from '../../types'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { DateAccordion } from '../../components/ui/DateAccordion'
import { InvoiceDocumentsModal } from '../../components/InvoiceDocumentsModal'
import { ReminderStatusButton } from '../../components/ReminderStatusButton'
import { PdfBacklogBanner } from '../../components/PdfBacklogBanner'
import { classifyInvoice, invoiceDisplayStatus, invoiceOutstanding } from '../../lib/creditNotes'
import { groupByDate } from '../../lib/dateGrouping'
import { isReminderDueToday, reminderStageFor, type ReminderStage } from '../../lib/reminderTemplates'

type DueFilter = 'all' | 'overdue' | 'yesterday' | 'today' | 'tomorrow' | 'this_week' | 'next_week'
type SortDirection = 'desc' | 'asc'

const DUE_FILTER_LABELS: Record<DueFilter, string> = {
  all: 'All Due Dates', overdue: 'Overdue', yesterday: 'Due Yesterday', today: 'Due Today',
  tomorrow: 'Due Tomorrow', this_week: 'Due This Week', next_week: 'Due Next Week',
}

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
const money = (value: number) => `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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

function matchesDateRange(date: string, from: string, to: string): boolean {
  if (!date) return !from && !to
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export function InvoicesPage({ invoices, customers, creditNotes = [], allocations = [], onOpenCreditNote, onNavigate, onRecordPayment, onSendReminder, onRegeneratePdf, customerId, onClearCustomerFilter, onRefresh }: {
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
      on a customer record lands here instead of the general profile modal. */
  customerId?: string | null
  onClearCustomerFilter?: () => void
  /** Refreshes the invoices list after a bulk generated-PDF backlog repair
      (see PdfBacklogBanner) so newly-regenerated PDFs show correctly. */
  onRefresh?: () => void
}) {
  const [tab, setTab] = useState<'open' | 'paid'>('open')
  const [query, setQuery] = useState('')
  const [dueFilter, setDueFilter] = useState<DueFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [reminderDueOnly, setReminderDueOnly] = useState(false)
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null)
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
      if (!matchesDateRange(invoice.date ?? '', dateFrom, dateTo)) return false
      if (tab === 'open' && reminderDueOnly && !isReminderDueToday(invoice)) return false
      if (!needle) return true
      const haystack = `${customer?.companyName ?? ''} ${customer?.customerNumber ?? ''} ${invoice.invoiceNumber}`.toLowerCase()
      return haystack.includes(needle)
    })
  }, [classified, tab, query, dueFilter, dateFrom, dateTo, reminderDueOnly])

  const groups = useMemo(() => groupByDate(filtered, item => item.invoice.date ?? '', sortDirection), [filtered, sortDirection])

  const markPaid = async (invoice: Invoice) => {
    if (!onRecordPayment) return
    setPayingId(invoice.id)
    try { await onRecordPayment(invoice, invoiceOutstanding(invoice)) }
    finally { setPayingId(null) }
  }

  const regenerate = async () => {
    if (!onRegeneratePdf || !viewInvoice) return
    const customer = customerById.get(viewInvoice.customerId)
    if (!customer) return
    setRegeneratingId(viewInvoice.id)
    try { await onRegeneratePdf(viewInvoice, customer) }
    finally { setRegeneratingId(null) }
  }

  const openRow = (invoice: Invoice, customer: Customer | undefined, kind: 'open' | 'overdue' | 'paid') => {
    const notes = notesByInvoiceId.get(invoice.id) ?? []
    return (
      <tr key={invoice.id}>
        <td>{customer?.companyName ?? invoice.customerId}</td>
        <td>{customer?.customerNumber ?? '—'}</td>
        <td>{invoice.invoiceNumber}</td>
        <td>{invoice.date || '—'}</td>
        <td>{money(invoice.amount)}</td>
        <td>{money(invoiceOutstanding(invoice))}</td>
        <td>
          <span className={`ps-badge ${kind === 'overdue' ? 'ps-badge-red' : kind === 'paid' ? 'ps-badge-green' : ''}`}>{kind === 'overdue' ? 'Overdue' : invoiceDisplayStatus(invoice)}</span>
          {notes.length > 0 && <div style={{ marginTop: 4 }}>{notes.map(note => (
            <button key={note.id} type="button" onClick={() => onOpenCreditNote?.(note.id)}
              style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: onOpenCreditNote ? 'pointer' : 'default', color: '#1d4ed8', fontSize: 11.5, textDecoration: 'underline', display: 'block' }}>
              Credited by {note.creditNumber}
            </button>
          ))}</div>}
        </td>
        <td>{(() => {
          if (kind === 'paid') return <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
          const stage = reminderStageFor(invoice)
          if (!customer || !onSendReminder || !stage) return <span style={{ color: '#9ca3af', fontSize: 12 }}>Not yet due</span>
          return <ReminderStatusButton invoice={invoice} onSend={() => onSendReminder(invoice, customer, stage)} />
        })()}</td>
        <td>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button className="btn-sm" variant="secondary" onClick={() => setViewInvoice(invoice)}>View Invoice</Button>
            {kind !== 'paid' && onRecordPayment && <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5 }}>
              <input type="checkbox" checked={false} disabled={payingId === invoice.id} onChange={() => markPaid(invoice)} />
              {payingId === invoice.id ? 'Saving…' : 'Paid'}
            </label>}
            {customer && onNavigate && <Button className="btn-sm" variant="ghost" onClick={() => onNavigate('customers')}>Customer</Button>}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="stack">
      <PdfBacklogBanner onRepaired={onRefresh} />

      {scopedCustomer && (
        <Card title={`${scopedCustomer.companyName} — Open Invoices`} actions={onClearCustomerFilter && <Button variant="secondary" className="btn-sm" onClick={onClearCustomerFilter}>Back to All Invoices</Button>}>
          <div className="customer-finance-grid">
            <div><span>Account Number</span><strong>{scopedCustomer.customerNumber}</strong></div>
            <div><span>Outstanding Balance</span><strong>{money(scopedCustomer.balance ?? 0)}</strong></div>
            <div><span>Credit Limit</span><strong>{money(scopedCustomer.creditLimit ?? 0)}</strong></div>
            <div><span>Available Credit</span><strong>{money(Math.max(0, (scopedCustomer.creditLimit ?? 0) - (scopedCustomer.balance ?? 0)))}</strong></div>
            <div><span>Open Invoices</span><strong>{openCount}</strong></div>
            <div><span>Overdue Invoices</span><strong>{overdueCount}</strong></div>
          </div>
        </Card>
      )}

      <div className="invoice-tabs">
        <button className={`invoice-tab${tab === 'open' ? ' active' : ''}`} onClick={() => setTab('open')}>Unpaid Invoices ({openCount + overdueCount})</button>
        <button className={`invoice-tab${tab === 'paid' ? ' active' : ''}`} onClick={() => setTab('paid')}>Paid Invoices ({paidCount})</button>
      </div>

      <Card title="Filters">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="search-input" style={{ flex: '1 1 240px' }} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search customer, account number or invoice number…" />
          {tab === 'open' && (
            <select className="search-input" style={{ minWidth: 150 }} value={dueFilter} onChange={e => setDueFilter(e.target.value as DueFilter)} aria-label="Filter by due date">
              {(Object.keys(DUE_FILTER_LABELS) as DueFilter[]).map(key => <option key={key} value={key}>{DUE_FILTER_LABELS[key]}</option>)}
            </select>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#4b5563' }}>
            From <input type="date" className="search-input" style={{ minWidth: 140 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#4b5563' }}>
            To <input type="date" className="search-input" style={{ minWidth: 140 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </label>
          <select className="search-input" style={{ minWidth: 130 }} value={sortDirection} onChange={e => setSortDirection(e.target.value as SortDirection)} aria-label="Sort by date">
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
          {tab === 'open' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#4b5563' }}>
              <input type="checkbox" checked={reminderDueOnly} onChange={e => setReminderDueOnly(e.target.checked)} />
              Reminder due today
            </label>
          )}
        </div>
      </Card>

      <DateAccordion
        groups={groups}
        emptyMessage={tab === 'open' ? 'No unpaid invoices match these filters.' : 'No paid invoices match these filters.'}
        renderGroup={group => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th><th>Account</th><th>Invoice No</th><th>Invoice Date</th><th>Amount</th>
                  <th>Outstanding</th><th>Status</th><th>Reminder Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map(({ invoice, customer, kind }) => openRow(invoice, customer, kind))}
              </tbody>
            </table>
          </div>
        )}
      />

      <InvoiceDocumentsModal
        invoice={viewInvoice}
        onClose={() => setViewInvoice(null)}
        onRegenerate={onRegeneratePdf ? regenerate : undefined}
        regenerating={Boolean(viewInvoice && regeneratingId === viewInvoice.id)}
      />
    </div>
  )
}
