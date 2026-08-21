import { useMemo, useState } from 'react'
import type { Customer, Invoice } from '../../types'
import { Card } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/Table'
import { invoiceOutstanding } from '../../lib/creditNotes'

function dayStart(value: Date) { return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime() }
function money(value: number) { return `£${value.toFixed(2)}` }

export function OutstandingInvoicesPage({ invoices, customers, onRecordPayment }: {
  invoices: Invoice[]
  customers: Customer[]
  onRecordPayment: (invoice: Invoice, amount: number) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [payment, setPayment] = useState('')
  const [confirmStep, setConfirmStep] = useState<1 | 2 | null>(null)
  const today = dayStart(new Date())
  const rows = useMemo(() => invoices.filter(i => invoiceOutstanding(i) > 0).filter(i => {
    const customer = customers.find(c => c.id === i.customerId)
    const haystack = `${customer?.companyName ?? ''} ${customer?.customerNumber ?? ''} ${i.invoiceNumber}`.toLowerCase()
    return haystack.includes(query.toLowerCase())
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [invoices, customers, query])
  const due = (invoice: Invoice) => dayStart(new Date(`${invoice.dueDate}T00:00:00`))
  const dueToday = rows.filter(i => due(i) === today)
  const nextSeven = rows.filter(i => due(i) > today && due(i) <= today + 7 * 86400000)
  const overdue = rows.filter(i => due(i) < today)
  const partPaid = rows.filter(i => (i.amountPaid ?? 0) > 0)
  const total = (list: Invoice[]) => list.reduce((sum, i) => sum + invoiceOutstanding(i), 0)

  return <div className="stack">
    <div className="page-heading"><div><h1>Outstanding Invoices</h1><p>Every unpaid balance, due date and payment action in one place.</p></div></div>
    <div className="overview-grid">
      {[['Total Outstanding', total(rows)], ['Due Today', total(dueToday)], ['Due Next 7 Days', total(nextSeven)], ['Overdue', total(overdue)], ['Part Paid', total(partPaid)]].map(([label, value]) => <Card key={String(label)} title={String(label)}><p className="metric">{money(Number(value))}</p></Card>)}
    </div>
    <Card title="Payment collection queue">
      <div className="table-toolbar"><input className="search-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search customer, account or invoice..." /></div>
      <DataTable columns={['Customer', 'Account No', 'Invoice No', 'Invoice Date', 'Due Date', 'Invoice Total', 'Paid', 'Outstanding', 'Status', 'Actions']}>
        {rows.map(invoice => {
          const customer = customers.find(c => c.id === invoice.customerId)
          const isOverdue = due(invoice) < today
          const status = isOverdue ? 'Overdue' : (invoice.amountPaid ?? 0) > 0 ? 'Part Paid' : 'Unpaid'
          return <tr key={invoice.id}><td><strong>{customer?.companyName ?? invoice.customerId}</strong></td><td>{customer?.customerNumber || '—'}</td><td>{invoice.invoiceNumber}</td><td>{invoice.date || '—'}</td><td>{invoice.dueDate}</td><td>{money(invoice.amount)}</td><td>{money(invoice.amountPaid ?? 0)}</td><td><strong>{money(invoiceOutstanding(invoice))}</strong></td><td><span className={`status-badge ${isOverdue ? 'danger' : status === 'Part Paid' ? 'warning' : 'info'}`}>{status}</span></td><td><div className="table-actions"><button className="btn btn-secondary btn-sm" type="button" onClick={async()=>{const r=await fetch('/api/generate-payment-due-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer:{name:customer?.companyName,accountNumber:customer?.customerNumber,email:customer?.email,phone:customer?.phone},invoice:{number:invoice.invoiceNumber,date:invoice.date,dueDate:invoice.dueDate,total:invoice.amount,paid:invoice.amountPaid,outstanding:invoiceOutstanding(invoice)}})});if(!r.ok)return;const b=await r.blob(),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=`Payment-Due-${invoice.invoiceNumber}.pdf`;a.click();URL.revokeObjectURL(u)}}>Due PDF</button><button className="btn btn-primary btn-sm" type="button" onClick={() => { setSelected(invoice); setPayment(invoiceOutstanding(invoice).toFixed(2)) }}>Record Payment</button></div></td></tr>
        })}
      </DataTable>
      {rows.length === 0 && <div className="empty-state">No outstanding invoices match this search.</div>}
    </Card>
    {selected && <div className="modal-backdrop" role="presentation"><div className="modal-card" role="dialog" aria-modal="true"><h2>{confirmStep ? (confirmStep === 1 ? 'Confirm Customer Payment' : 'Final Confirmation') : 'Record Payment'}</h2><p>{confirmStep === 1 ? `You are about to mark ${selected.invoiceNumber} as fully paid.` : confirmStep === 2 ? `Are you sure the full outstanding payment of ${money(invoiceOutstanding(selected))} has been received?` : `${selected.invoiceNumber} · ${money(invoiceOutstanding(selected))} outstanding`}</p>{!confirmStep && <label>Amount received<input className="input" type="number" min="0.01" max={invoiceOutstanding(selected)} step="0.01" value={payment} onChange={e => setPayment(e.target.value)} /></label>}{!confirmStep && Number(payment) === invoiceOutstanding(selected) && <button className="btn btn-secondary" type="button" style={{ marginTop: 12 }} onClick={() => setConfirmStep(1)}>Customer Has Paid</button>}<div className="modal-actions"><button className="btn btn-ghost" type="button" onClick={() => { setSelected(null); setConfirmStep(null) }}>{confirmStep === 2 ? 'Go Back' : 'Cancel'}</button>{confirmStep === 1 && <button className="btn btn-primary" type="button" onClick={() => setConfirmStep(2)}>Continue</button>}{confirmStep === 2 && <button className="btn btn-primary" type="button" onClick={async () => { await onRecordPayment(selected, invoiceOutstanding(selected)); setSelected(null); setConfirmStep(null) }}>Yes, Payment Has Been Received</button>}{!confirmStep && <button className="btn btn-primary" type="button" onClick={async () => { const amount = Number(payment); if (!Number.isFinite(amount) || amount <= 0 || amount > invoiceOutstanding(selected)) return; await onRecordPayment(selected, amount); setSelected(null) }}>Save Payment</button>}</div></div></div>}
  </div>
}
