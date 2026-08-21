import { useMemo, useState } from 'react'
import type { Customer, Invoice } from '../../types'
import { Card } from '../../components/ui/Card'
import { createInvoice } from '../../services/invoiceService'

type Line = { line: string; qty: string; product: string; variety: string; size: string; price: string; vatRate: string; vatCode: string }
const blankLine = (): Line => ({ line: '', qty: '1', product: '', variety: '', size: '', price: '0', vatRate: '0', vatCode: '0' })
const money = (v: number) => `£${v.toFixed(2)}`

export function CreateInvoicePage({ customers, invoices, onCreated }: { customers: Customer[]; invoices: Invoice[]; onCreated: () => Promise<void> }) {
  const [query, setQuery] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [terms, setTerms] = useState('14')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [packages, setPackages] = useState('1')
  const [lines, setLines] = useState<Line[]>([blankLine()])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const customer = customers.find(c => c.id === customerId)
  const matches = customers.filter(c => `${c.companyName} ${c.customerNumber}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
  const totals = useMemo(() => {
    const goods = lines.reduce((s, l) => s + Math.max(0, Number(l.qty) || 0) * Math.max(0, Number(l.price) || 0), 0)
    const vat = lines.reduce((s, l) => s + (Math.max(0, Number(l.qty) || 0) * Math.max(0, Number(l.price) || 0) * Math.max(0, Number(l.vatRate) || 0)) / 100, 0)
    return { goods, vat, total: goods + vat }
  }, [lines])
  const updateLine = (index: number, key: keyof Line, value: string) => setLines(xs => xs.map((x, i) => i === index ? { ...x, [key]: value } : x))
  const save = async () => {
    if (!customer || totals.total <= 0) { setMessage('Select a customer and add at least one product with a value.'); return }
    setSaving(true); setMessage('')
    const due = new Date(`${invoiceDate}T00:00:00`); due.setDate(due.getDate() + Math.max(0, Number(terms) || 0))
    const existing = invoices.map(i => i.invoiceNumber)
    const generated = invoiceNumber.trim() || `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`
    if (existing.includes(generated)) { setMessage('That invoice number already exists. Choose another number.'); setSaving(false); return }
    await createInvoice({ customerId: customer.id, invoiceNumber: generated, amount: Math.round(totals.total * 100) / 100, amountPaid: 0, status: 'Unpaid', date: invoiceDate, dueDate: due.toISOString().slice(0, 10) })
    await onCreated(); setMessage(`Invoice ${generated} created for ${customer.companyName}.`); setInvoiceNumber(''); setLines([blankLine()])
    setSaving(false)
  }
  return <div className="stack">
    <div className="page-heading"><div><h1>Create Invoice</h1><p>Create a new invoice from the dashboard. Totals are calculated from the product rows.</p></div></div>
    <Card title="Customer and invoice details">
      <div className="form-grid">
        <label className="form-control wide"><span>Customer</span><input value={customer ? `${customer.companyName} - ${customer.customerNumber}` : query} onChange={e => { setQuery(e.target.value); setCustomerId('') }} placeholder="Search company or account number..." />{!customer && query && <div className="create-customer-results">{matches.map(c => <button type="button" key={c.id} onClick={() => { setCustomerId(c.id); setQuery('') }}>{c.companyName} - {c.customerNumber}</button>)}</div>}</label>
        {customer && <div className="wide invoice-customer-summary"><strong>{customer.companyName} - {customer.customerNumber}</strong><span>{customer.address || 'Address not recorded'} · Current S/L balance {money(customer.balance ?? 0)}</span></div>}
        <label className="form-control"><span>Invoice Date</span><input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></label>
        <label className="form-control"><span>Payment Terms (days)</span><input type="number" min="0" value={terms} onChange={e => setTerms(e.target.value)} /></label>
        <label className="form-control"><span>Invoice Number (optional)</span><input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Auto-generated" /></label>
        <label className="form-control"><span>Number of Packages</span><input type="number" min="0" value={packages} onChange={e => setPackages(e.target.value)} /></label>
      </div>
    </Card>
    <Card title="Products" actions={<button className="btn btn-secondary btn-sm" type="button" onClick={() => setLines(xs => [...xs, blankLine()])}>+ Add Product</button>}>
      <div className="invoice-builder-table"><table><thead><tr>{['Line','Qty','Product','Variety','Size','Price','VAT Code','VAT %','Goods','Remove'].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{lines.map((l, i) => <tr key={i}>{(['line','qty','product','variety','size','price','vatCode','vatRate'] as (keyof Line)[]).map(k => <td key={k}><input value={l[k]} onChange={e => updateLine(i, k, e.target.value)} /></td>)}<td>{money((Number(l.qty) || 0) * (Number(l.price) || 0))}</td><td><button className="icon-button" type="button" aria-label="Remove product" onClick={() => setLines(xs => xs.length > 1 ? xs.filter((_, n) => n !== i) : xs)}>×</button></td></tr>)}</tbody></table></div>
      <div className="invoice-total-panel"><span>Total Goods <strong>{money(totals.goods)}</strong></span><span>Total V.A.T <strong>{money(totals.vat)}</strong></span><span className="grand">Grand Total <strong>{money(totals.total)}</strong></span></div>
      {message && <p className={message.startsWith('Invoice') ? 'success-message' : 'error-message'}>{message}</p>}
      <div className="actions-row"><button className="btn btn-primary" type="button" disabled={saving} onClick={save}>{saving ? 'Creating...' : 'Generate Invoice'}</button><button className="btn btn-secondary" type="button" onClick={() => window.print()}>Preview Invoice</button></div>
    </Card>
  </div>
}
