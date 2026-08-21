import { useMemo, useState } from 'react'
import type { Customer, Invoice } from '../../types'
import { Card } from '../../components/ui/Card'
import { createInvoice } from '../../services/invoiceService'
import { uploadFile } from '../../lib/fileService'
import { sendEmail } from '../../lib/emailService'
import { sendWhatsAppMessage } from '../../lib/whatsapp'

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
  const [sendDraft,setSendDraft]=useState<{customer:Customer;invoice:Invoice;text:string;fileName:string;base64:string}|null>(null)
  const [sendStatus,setSendStatus]=useState('')
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
    try {
      const addressParts = (customer.address || customer.registeredAddress || '').split(',').map(x => x.trim()).filter(Boolean)
      const response = await fetch('/api/generate-invoice-docx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      customer: { name: customer.companyName, accountNumber: customer.customerNumber, addressLine1: addressParts[0] || '', addressLine2: addressParts.slice(1, -1).join(', '), postcode: addressParts.at(-1) || '', phone: customer.phone, balance: customer.balance ?? 0 },
      invoice: { invoiceNumber: generated, date: invoiceDate, packages, totalGoods: totals.goods, vatTotal: totals.vat, grandTotal: totals.total }, items: lines,
      }) })
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Invoice document generation failed')
      const blob = await response.blob()
      const fileName = `Punjab-Invoice-${generated.replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`
      const dataUri = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob) })
      const created=await createInvoice({ customerId: customer.id, invoiceNumber: generated, amount: Math.round(totals.total * 100) / 100, amountPaid: 0, status: 'Unpaid', date: invoiceDate, dueDate: due.toISOString().slice(0, 10) })
      await uploadFile(fileName, blob.type, blob.size, dataUri, `Generated invoice ${generated}`, customer.id, customer.companyName)
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url)
      const draft=`Hello ${customer.companyName},\n\nPlease see the details of your latest Punjab Exotic Foods invoice below.\n\nInvoice: ${generated}\n${lines.map(l=>`${l.product} - Qty ${l.qty} - £${Number(l.price).toFixed(2)}`).join('\n')}\n\nTotal: £${totals.total.toFixed(2)}\nInvoice Date: ${invoiceDate}\nDue Date: ${created.dueDate}\nAccount Number: ${customer.customerNumber}\n\nKind regards,\nPunjab Exotic Foods Limited`
      setSendDraft({customer,invoice:created,text:draft,fileName,base64:dataUri.split(',')[1]||''})
      await onCreated(); setMessage(`Invoice ${generated} created, stored in Files and downloaded.`); setInvoiceNumber(''); setLines([blankLine()])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invoice generation failed. No invoice was saved.')
    } finally {
      setSaving(false)
    }
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
    {sendDraft&&<Card title="Send Invoice"><label className="form-control"><span>Editable invoice message</span><textarea rows={12} value={sendDraft.text} onChange={e=>setSendDraft({...sendDraft,text:e.target.value})}/></label><div className="actions-row" style={{marginTop:12}}><button className="btn btn-primary" disabled={!sendDraft.customer.email} onClick={async()=>{const r=await sendEmail(sendDraft.customer.email,`Invoice ${sendDraft.invoice.invoiceNumber} - Punjab Exotic Foods Limited`,`<div style="white-space:pre-line">${sendDraft.text.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!))}</div>`,[{filename:sendDraft.fileName,content:sendDraft.base64}]);setSendStatus(r.ok?'Invoice document sent by email.':`Email failed: ${r.error}`)}}>Email + Document</button><button className="btn btn-secondary" disabled={!sendDraft.customer.phone} onClick={async()=>{const r=await sendWhatsAppMessage(sendDraft.customer.phone,sendDraft.text,{type:'Invoice Created',customerId:sendDraft.customer.id,customerName:sendDraft.customer.companyName,createdBy:'Admin'});setSendStatus(r.status==='Sent'?'Invoice text sent by WhatsApp.':'WhatsApp send failed and was logged.')}}>Send WhatsApp Text</button></div>{sendStatus&&<p className={sendStatus.includes('failed')?'error-message':'success-message'}>{sendStatus}</p>}</Card>}
  </div>
}
