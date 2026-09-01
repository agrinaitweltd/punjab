import { useMemo, useState } from 'react'
import type { Customer, Invoice, NotificationLog } from '../../types'
import { Card } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/Table'
import { classifyInvoice, daysOverdue, invoiceOutstanding } from '../../lib/creditNotes'
import { findInvoicePdf } from '../../lib/fileService'
import { formatUkPhoneForDisplay } from '../../lib/whatsapp'
import { showAppError } from '../../lib/appDialogs'

const dayStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
const money = (value: number) => `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function OutstandingInvoicesPage({ invoices, customers, notificationLogs, onRecordPayment, onSendReminder }: {
  invoices: Invoice[]
  customers: Customer[]
  notificationLogs: NotificationLog[]
  onRecordPayment: (invoice: Invoice, amount: number) => Promise<void>
  /** Opens the manual reminder composer for this invoice/customer - does not
      send anything itself (see item 17: admin always reviews/edits first). */
  onSendReminder: (invoice: Invoice, customer: Customer) => void
}) {
  const [query, setQuery] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [payment, setPayment] = useState('')
  const [confirmStep, setConfirmStep] = useState<1 | 2 | null>(null)
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const today = dayStart(new Date())
  // "21+ Days Overdue" - item 9: only invoices past the 21-day grace period,
  // not every invoice that merely has a balance (that's the Open tab on
  // InvoicesPage.tsx). classifyInvoice is the single shared source of truth
  // for this boundary.
  const outstandingInvoices = useMemo(() => invoices.filter(invoice => classifyInvoice(invoice) === 'overdue').sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [invoices])
  const due = (invoice: Invoice) => dayStart(new Date(`${invoice.dueDate}T00:00:00`))
  const total = (list: Invoice[]) => list.reduce((sum, invoice) => sum + invoiceOutstanding(invoice), 0)
  const groups = useMemo(() => customers.map(customer => {
    const rows = outstandingInvoices.filter(invoice => invoice.customerId === customer.id)
    return { customer, rows, outstanding: total(rows), overdue: rows.filter(invoice => due(invoice) < today).length, nextDue: rows[0]?.dueDate ?? '' }
  }).filter(group => group.rows.length > 0).filter(group => `${group.customer.companyName} ${group.customer.customerNumber}`.toLowerCase().includes(query.toLowerCase())), [customers, outstandingInvoices, query, today])
  const selectedGroup = groups.find(group => group.customer.id === customerId) ?? (() => { const customer = customers.find(item => item.id === customerId); if (!customer) return undefined; const rows = outstandingInvoices.filter(invoice => invoice.customerId === customer.id); return { customer, rows, outstanding: total(rows), overdue: rows.filter(invoice => due(invoice) < today).length, nextDue: rows[0]?.dueDate ?? '' } })()
  const openPayment = (invoice: Invoice, fullyPaid = false) => { setSelected(invoice); setPayment(invoiceOutstanding(invoice).toFixed(2)); setConfirmStep(fullyPaid ? 1 : null) }
  const downloadDuePdf = async (invoice: Invoice, customer: Customer) => {
    const file = await findInvoicePdf(customer.id, invoice.invoiceNumber, invoice.id, invoice.amount)
    if (!file) { setNotice(`Official PDF for invoice ${invoice.invoiceNumber} is missing. Upload or regenerate it before retrying.`); return }
    const anchor = document.createElement('a'); anchor.href = file.dataUri; anchor.download = file.name; anchor.click()
  }
  const dueToday = outstandingInvoices.filter(invoice => due(invoice) === today)
  const nextSeven = outstandingInvoices.filter(invoice => due(invoice) > today && due(invoice) <= today + 7 * 86400000)

  const lastReminderFor = (invoiceId: string) => notificationLogs
    .filter(log => log.invoiceId === invoiceId && log.status === 'Sent')
    .sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''))[0]

  return <div className="stack outstanding-page"><div className="page-heading"><div><h1>21+ Days Overdue</h1><p>Invoices that remain outstanding after the 21-day payment period.</p></div></div>
    <div className="overview-grid outstanding-summary">{[['Total Overdue', total(outstandingInvoices)], ['Due Today', total(dueToday)], ['Due Next 7 Days', total(nextSeven)]].map(([label, value]) => <Card key={String(label)} title={String(label)}><p className="metric">{money(Number(value))}</p></Card>)}</div>
    {!selectedGroup ? <Card title="Customers with overdue balances"><div className="table-toolbar"><input className="search-input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search customer name or account number..." /></div><div className="outstanding-customer-list">{groups.map(group => <article className="outstanding-customer-row" key={group.customer.id}><div><h3>{group.customer.companyName}</h3><p>Account {group.customer.customerNumber}</p></div><div><span>Overdue</span><strong>{money(group.outstanding)}</strong></div><div><span>Invoices</span><strong>{group.rows.length}</strong></div><div><span>Next Due</span><strong>{group.nextDue || '—'}</strong></div><button className="btn btn-secondary" onClick={() => setCustomerId(group.customer.id)}>View Unpaid Invoices</button></article>)}</div>{groups.length === 0 && <div className="empty-state">No customer accounts are overdue.</div>}</Card>
    : <Card title={`${selectedGroup.customer.companyName} - Account ${selectedGroup.customer.customerNumber}`} actions={<button className="btn btn-secondary btn-sm" onClick={() => setCustomerId('')}>Back to Customers</button>}><div className="customer-outstanding-heading"><span>Total Overdue</span><strong>{money(selectedGroup.outstanding)}</strong></div><div style={{ padding: '0 16px 12px', color: '#6b7280', fontSize: 13 }}>{selectedGroup.customer.email || 'No email'} · {formatUkPhoneForDisplay(selectedGroup.customer.phone) || 'No phone'}</div><DataTable columns={['Invoice No','Invoice Date','Due Date','Days Overdue','Invoice Total','Outstanding','Last Reminder','Actions']}>{selectedGroup.rows.map(invoice => { const last = lastReminderFor(invoice.id); return <tr key={invoice.id}><td><strong>{invoice.invoiceNumber}</strong></td><td>{invoice.date || '—'}</td><td>{invoice.dueDate}</td><td><span className="status-badge danger">{daysOverdue(invoice)} days</span></td><td>{money(invoice.amount)}</td><td><strong>{money(invoiceOutstanding(invoice))}</strong></td><td>{last ? `${(last.sentAt ?? '').slice(0, 10)} (${last.channel})` : '—'}</td><td><div className="table-actions"><button className="btn btn-secondary btn-sm" onClick={() => downloadDuePdf(invoice, selectedGroup.customer)}>View Invoice</button><button className="btn btn-secondary btn-sm" onClick={() => openPayment(invoice)}>Record Payment</button><button className="btn btn-primary btn-sm" onClick={() => openPayment(invoice, true)}>Customer Has Paid</button><button className="btn btn-secondary btn-sm" onClick={() => onSendReminder(invoice, selectedGroup.customer)}>Send Reminder</button></div></td></tr>})}</DataTable></Card>}
    {notice && <p className="success-message">{notice}</p>}
    {selected && <div className="modal-backdrop" role="presentation"><div className="modal-card" role="dialog" aria-modal="true"><h2>{confirmStep ? (confirmStep === 1 ? 'Confirm Customer Payment' : 'Final Confirmation') : 'Record Payment'}</h2><p>{confirmStep === 1 ? `You are about to mark ${selected.invoiceNumber} as fully paid.` : confirmStep === 2 ? `Are you sure the full outstanding payment of ${money(invoiceOutstanding(selected))} has been received?` : `${selected.invoiceNumber} · ${money(invoiceOutstanding(selected))} outstanding`}</p>{!confirmStep && <label>Amount received<input className="input" type="number" min="0.01" max={invoiceOutstanding(selected)} step="0.01" value={payment} onChange={event => setPayment(event.target.value)} disabled={submitting} /></label>}<div className="modal-actions"><button className="btn btn-ghost" type="button" disabled={submitting} onClick={() => { setSelected(null); setConfirmStep(null) }}>{confirmStep === 2 ? 'Go Back' : 'Cancel'}</button>{confirmStep === 1 && <button className="btn btn-primary" type="button" onClick={() => setConfirmStep(2)}>Continue</button>}{confirmStep === 2 && <button className="btn btn-primary" type="button" disabled={submitting} onClick={async () => {
      if (submitting) return
      setSubmitting(true)
      try { await onRecordPayment(selected, invoiceOutstanding(selected)); setSelected(null); setConfirmStep(null) }
      catch (error) { showAppError(error, { feature: 'Record Payment', context: { invoiceNumber: selected.invoiceNumber } }) }
      finally { setSubmitting(false) }
    }}>{submitting ? 'Saving…' : 'Yes, Payment Has Been Received'}</button>}{!confirmStep && <button className="btn btn-primary" type="button" disabled={submitting} onClick={async () => {
      if (submitting) return
      const amount = Number(payment); if (!Number.isFinite(amount) || amount <= 0 || amount > invoiceOutstanding(selected)) return
      setSubmitting(true)
      try { await onRecordPayment(selected, amount); setSelected(null) }
      catch (error) { showAppError(error, { feature: 'Record Payment', context: { invoiceNumber: selected.invoiceNumber } }) }
      finally { setSubmitting(false) }
    }}>{submitting ? 'Saving…' : 'Save Payment'}</button>}</div></div></div>}
  </div>
}
