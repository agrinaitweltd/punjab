import { useMemo, useState } from 'react'
import type { Customer, Invoice } from '../../types'
import { Card } from '../../components/ui/Card'
import { createInvoice, updateInvoice } from '../../services/invoiceService'
import { saveInvoiceItems } from '../../services/invoiceItemService'
import { createNotificationLog } from '../../services/notificationService'
import { createCustomer, updateCustomer } from '../../api/customersApi'
import { uploadFile } from '../../lib/fileService'
import { sendEmail } from '../../lib/emailService'
import { sendWhatsAppDocument } from '../../lib/whatsapp'
import { authenticatedFetch } from '../../lib/apiFetch'

type Line = { line: string; qty: string; product: string; variety: string; size: string; price: string; vatRate: string; vatCode: string }
type ManualCustomer = { name: string; accountNumber: string; address: string; email: string; phone: string }
type Generated = { customer: Customer | null; manual: ManualCustomer; invoiceNumber: string; dueDate: string; pdf: Blob; pdfDataUri: string; pdfBase64: string; pdfFileName: string; docx: Blob; docxFileName: string; provider: string; savedInvoice?: Invoice }
type SendMode = 'email' | 'whatsapp' | 'both'
const blankLine = (): Line => ({ line: '', qty: '1', product: '', variety: '', size: '', price: '0', vatRate: '0', vatCode: '0' })
const blankManual = (): ManualCustomer => ({ name: '', accountNumber: '', address: '', email: '', phone: '' })
const money = (value: number) => `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const blobToDataUri = (blob: Blob) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob) })
const download = (blob: Blob, fileName: string) => { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 500) }

export function CreateInvoicePage({ customers, invoices, userName, onCreated }: { customers: Customer[]; invoices: Invoice[]; userName: string; onCreated: () => Promise<void> }) {
  const [query, setQuery] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [manualMode, setManualMode] = useState(false)
  const [manual, setManual] = useState<ManualCustomer>(blankManual())
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [terms, setTerms] = useState('14')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [packages, setPackages] = useState('1')
  const [lines, setLines] = useState<Line[]>([blankLine()])
  const [progress, setProgress] = useState('')
  const [message, setMessage] = useState('')
  const [generated, setGenerated] = useState<Generated | null>(null)
  const [wordFallback, setWordFallback] = useState<{ blob: Blob; fileName: string } | null>(null)
  const [actionBusy, setActionBusy] = useState('')
  const [sendPanel, setSendPanel] = useState(false)
  const [sendMode, setSendMode] = useState<SendMode>('email')
  const [sendEmailAddress, setSendEmailAddress] = useState('')
  const [sendPhone, setSendPhone] = useState('')
  const [sendMessage, setSendMessage] = useState('')
  const [sendOnlyConfirmed, setSendOnlyConfirmed] = useState(false)
  const customer = customers.find(item => item.id === customerId)
  const matches = customers.filter(item => `${item.companyName} ${item.customerNumber}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
  const totals = useMemo(() => {
    const goods = lines.reduce((sum, line) => sum + Math.max(0, Number(line.qty) || 0) * Math.max(0, Number(line.price) || 0), 0)
    const vat = lines.reduce((sum, line) => sum + Math.max(0, Number(line.qty) || 0) * Math.max(0, Number(line.price) || 0) * Math.max(0, Number(line.vatRate) || 0) / 100, 0)
    return { goods, vat, total: goods + vat }
  }, [lines])
  const activeCustomer = customer ? { name: customer.companyName, accountNumber: customer.customerNumber, address: customer.address || customer.registeredAddress || '', email: customer.email, phone: customer.phone } : manual
  const updateLine = (index: number, key: keyof Line, value: string) => setLines(current => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line))

  const generate = async () => {
    if (!activeCustomer.name.trim() || !/^\d{6}$/.test(activeCustomer.accountNumber)) { setMessage('Select a customer or enter a customer name and six-digit account number.'); return }
    if (totals.total <= 0 || !lines.some(line => line.product.trim())) { setMessage('Add at least one product with a value.'); return }
    const generatedNumber = invoiceNumber.trim() || `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`
    if (invoices.some(invoice => invoice.invoiceNumber === generatedNumber)) { setMessage('That invoice number already exists. Choose another number.'); return }
    setMessage(''); setWordFallback(null); setProgress('Generating official Punjab Exotic Foods invoice...')
    const due = new Date(`${invoiceDate}T00:00:00`); due.setDate(due.getDate() + Math.max(0, Number(terms) || 0))
    const addressParts = activeCustomer.address.split(',').map(value => value.trim()).filter(Boolean)
    const payload = { customer: { name: activeCustomer.name, accountNumber: activeCustomer.accountNumber, address: activeCustomer.address, addressLine1: addressParts[0] || '', addressLine2: addressParts.slice(1, -1).join(', '), postcode: addressParts.at(-1) || '', phone: activeCustomer.phone, balance: customer?.balance ?? 0 }, invoice: { invoiceNumber: generatedNumber, date: invoiceDate, packages, totalGoods: totals.goods, vatTotal: totals.vat, grandTotal: totals.total }, items: lines }
    try {
      const wordResponse = await authenticatedFetch('/api/generate-invoice-docx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!wordResponse.ok) throw new Error((await wordResponse.json().catch(() => ({}))).error || 'Invoice document generation failed')
      const docx = await wordResponse.blob(), docxDataUri = await blobToDataUri(docx), docxBase64 = docxDataUri.split(',')[1] || ''
      const docxFileName = `Punjab-Invoice-${generatedNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`
      setWordFallback({ blob: docx, fileName: docxFileName })
      setProgress('Converting invoice to PDF...')
      const pdfResponse = await authenticatedFetch('/api/convert-invoice-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docxBase64, fileName: docxFileName, data: payload }) })
      if (!pdfResponse.ok) throw new Error((await pdfResponse.json().catch(() => ({}))).error || 'PDF conversion failed')
      const pdf = await pdfResponse.blob(), pdfDataUri = await blobToDataUri(pdf), pdfBase64 = pdfDataUri.split(',')[1] || ''
      const pdfFileName = `Punjab-Invoice-${generatedNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}-${activeCustomer.accountNumber}.pdf`
      const result: Generated = { customer: customer ?? null, manual: { ...activeCustomer }, invoiceNumber: generatedNumber, dueDate: due.toISOString().slice(0, 10), pdf, pdfDataUri, pdfBase64, pdfFileName, docx, docxFileName, provider: pdfResponse.headers.get('X-PDF-Provider') || 'PDF service' }
      download(pdf, pdfFileName); setGenerated(result); setWordFallback(null); setSendEmailAddress(activeCustomer.email || ''); setSendPhone(activeCustomer.phone || '')
      setSendMessage(`Hello ${activeCustomer.name},\n\nPlease find attached invoice ${generatedNumber} for ${money(totals.total)}.\nInvoice date: ${invoiceDate}\nDue date: ${result.dueDate}\nAccount: ${activeCustomer.accountNumber}\n\nKind regards,\nPunjab Exotic Foods Limited`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'PDF generation failed.'); setGenerated(null) }
    finally { setProgress('') }
  }

  const ensureSaved = async (): Promise<Generated> => {
    if (!generated) throw new Error('Generate the invoice first.')
    if (generated.savedInvoice) return generated
    let savedCustomer = generated.customer
    if (!savedCustomer) savedCustomer = await createCustomer({ companyName: generated.manual.name, contactPerson: '', email: generated.manual.email || `${generated.manual.accountNumber}@pending.punjab.local`, phone: generated.manual.phone, customerNumber: generated.manual.accountNumber, password: `pending-${Math.random().toString(36).slice(2, 12)}`, address: generated.manual.address, deliveryArea: '', paymentTerms: `${terms} Days`, creditDays: Math.max(0, Number(terms) || 0) })
    const savedInvoice = await createInvoice({ customerId: savedCustomer.id, invoiceNumber: generated.invoiceNumber, amount: Math.round(totals.total * 100) / 100, amountPaid: 0, status: 'Unpaid', date: invoiceDate, dueDate: generated.dueDate })
    await saveInvoiceItems(savedInvoice.id, lines.map(line => ({ line: line.line, quantity: Number(line.qty) || 0, product: line.product, variety: line.variety, size: line.size, price: Number(line.price) || 0, goodsValue: (Number(line.qty) || 0) * (Number(line.price) || 0), vatCode: line.vatCode, vatRate: Number(line.vatRate) || 0 })))
    const official = await uploadFile(generated.pdfFileName, 'application/pdf', generated.pdf.size, generated.pdfDataUri, `Invoices: ${generated.invoiceNumber}`, savedCustomer.id, savedCustomer.companyName, { invoiceId: savedInvoice.id, invoiceNumber: savedInvoice.invoiceNumber, documentRole: 'canonical_invoice' })
    const linkedInvoice = await updateInvoice(savedInvoice.id, { canonicalDocumentId: official.id, canonicalPdfFileName: official.name, canonicalPdfGeneratedAt: new Date().toISOString() })
    if (!linkedInvoice) throw new Error('The invoice PDF was saved but could not be linked to the invoice record.')
    const previousOutstanding = invoices.filter(invoice => invoice.customerId === savedCustomer.id).reduce((sum, invoice) => sum + Math.max(0, invoice.amount - (invoice.amountPaid ?? 0)), 0)
    await updateCustomer(savedCustomer.id, { balance: previousOutstanding + totals.total })
    const next = { ...generated, customer: savedCustomer, savedInvoice: linkedInvoice }; setGenerated(next); await onCreated(); return next
  }

  const send = async () => {
    if (!generated) return
    if ((sendMode === 'email' || sendMode === 'both') && !sendEmailAddress.includes('@')) { setMessage('Enter a valid email address.'); return }
    if ((sendMode === 'whatsapp' || sendMode === 'both') && !sendPhone.trim()) { setMessage('Enter a telephone number.'); return }
    setActionBusy('send'); setMessage(''); const results: boolean[] = []
    if (sendMode === 'email' || sendMode === 'both') { const result = await sendEmail(sendEmailAddress, `Invoice ${generated.invoiceNumber} - Punjab Exotic Foods Limited`, `<div style="white-space:pre-line">${sendMessage.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]!))}</div>`, [{ filename: generated.pdfFileName, content: generated.pdfBase64 }], { category: 'notifications', customerId: generated.savedInvoice?.customerId, invoiceId: generated.savedInvoice?.id, idempotencyKey: generated.savedInvoice ? `invoice:${generated.savedInvoice.id}:issued:email` : undefined, communicationType: 'invoice_issued' }); results.push(result.ok); if (generated.savedInvoice) await createNotificationLog({ invoiceId: generated.savedInvoice.id, customerId: generated.savedInvoice.customerId, channel: 'email', status: result.ok ? 'Sent' : 'Failed', sentAt: new Date().toISOString(), error: result.error }) }
    if (sendMode === 'whatsapp' || sendMode === 'both') { const result = await sendWhatsAppDocument(sendPhone, sendMessage, generated.pdfFileName, generated.pdfBase64, { customerId: generated.savedInvoice?.customerId, customerName: generated.customer?.companyName || generated.manual.name, createdBy: userName }); results.push(result.status === 'Sent') }
    setActionBusy(''); setMessage(results.every(Boolean) ? 'Invoice PDF sent successfully.' : generated.savedInvoice ? 'Invoice saved, but sending failed. Check Communication History and retry.' : 'Sending failed. Check the contact details and retry.'); if (results.every(Boolean)) { setSendPanel(false); setGenerated(null) }
  }
  const chooseSave = async (andSend: boolean) => { setActionBusy(andSend ? 'save-send' : 'save'); setMessage(''); try { const saved = await ensureSaved(); if (andSend) { setGenerated(saved); setSendPanel(true) } else { setMessage(`Invoice ${saved.invoiceNumber} saved to the customer account.`); setGenerated(null) } } catch (error) { setMessage(error instanceof Error ? error.message : 'Invoice could not be saved. Nothing was sent.') } finally { setActionBusy('') } }

  return <div className="stack create-invoice-page"><div className="page-heading"><div><h1>Create Invoice</h1><p>Build an official invoice, generate its PDF, then choose whether to save or send it.</p></div></div>
    {wordFallback && !generated && <div className="modal-backdrop"><div className="modal-card"><h2>PDF Generation Failed</h2><p>The invoice Word document was generated successfully, but PDF conversion was unsuccessful.</p><div className="modal-actions"><button className="btn btn-primary" onClick={generate}>Retry PDF Generation</button><button className="btn btn-secondary" onClick={() => download(wordFallback.blob, wordFallback.fileName)}>Download Word Copy</button><button className="btn btn-ghost" onClick={() => setWordFallback(null)}>Close</button></div></div></div>}
    <Card title="Customer"><div className="invoice-mode-toggle"><button className={!manualMode ? 'active' : ''} onClick={() => setManualMode(false)}>Select Customer</button><button className={manualMode ? 'active' : ''} onClick={() => { setManualMode(true); setCustomerId('') }}>Enter Customer</button></div>{!manualMode ? <div className="form-grid"><label className="form-control wide"><span>Search customer</span><input value={customer ? `${customer.companyName} - ${customer.customerNumber}` : query} onChange={event => { setQuery(event.target.value); setCustomerId('') }} placeholder="Search customer name or account number..." />{!customer && query && <div className="create-customer-results">{matches.map(item => <button type="button" key={item.id} onClick={() => { setCustomerId(item.id); setQuery('') }}>{item.companyName} - Account {item.customerNumber}</button>)}</div>}</label>{customer && <div className="wide invoice-customer-summary"><strong>{customer.companyName}</strong><span>Account {customer.customerNumber} · {customer.email || 'No email'} · {customer.phone || 'No telephone'}</span></div>}</div> : <div className="form-grid">{([['name','Customer Name'],['accountNumber','Account Number'],['email','Email'],['phone','Telephone'],['address','Address']] as const).map(([key, label]) => <label className={`form-control ${key === 'address' ? 'wide' : ''}`} key={key}><span>{label}</span><input value={manual[key]} onChange={event => setManual(current => ({ ...current, [key]: key === 'accountNumber' ? event.target.value.replace(/\D/g, '').slice(0, 6) : event.target.value }))} /></label>)}</div>}</Card>
    <Card title="Invoice Details"><div className="form-grid"><label className="form-control"><span>Invoice Number</span><input value={invoiceNumber} onChange={event => setInvoiceNumber(event.target.value)} placeholder="Auto-generate" /></label><label className="form-control"><span>Invoice Date</span><input type="date" value={invoiceDate} onChange={event => setInvoiceDate(event.target.value)} /></label><label className="form-control"><span>Payment Terms</span><input type="number" min="0" value={terms} onChange={event => setTerms(event.target.value)} /></label><label className="form-control"><span>Packages</span><input type="number" min="0" value={packages} onChange={event => setPackages(event.target.value)} /></label></div></Card>
    <Card title="Products" actions={<button className="btn btn-secondary btn-sm" type="button" onClick={() => setLines(current => [...current, blankLine()])}>+ Add Product</button>}><div className="invoice-builder-table"><table><thead><tr>{['Line','Qty','Product','Variety','Size','Price','VAT %','Goods',''].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{lines.map((line, index) => <tr key={index}>{(['line','qty','product','variety','size','price','vatRate'] as (keyof Line)[]).map(key => <td key={key}><input value={line[key]} onChange={event => updateLine(index, key, event.target.value)} /></td>)}<td>{money((Number(line.qty) || 0) * (Number(line.price) || 0))}</td><td><button className="icon-button" type="button" aria-label="Remove product" onClick={() => setLines(current => current.length > 1 ? current.filter((_, row) => row !== index) : current)}>×</button></td></tr>)}</tbody></table></div><div className="invoice-total-panel"><span>Total Goods <strong>{money(totals.goods)}</strong></span><span>VAT <strong>{money(totals.vat)}</strong></span><span className="grand">Grand Total <strong>{money(totals.total)}</strong></span></div>{progress && <p className="processing-message">{progress}</p>}{message && <p className={/success|saved to|sent successfully/i.test(message) ? 'success-message' : 'error-message'}>{message}</p>}<div className="actions-row"><button className="btn btn-primary" type="button" disabled={Boolean(progress)} onClick={generate}>{progress ? 'Please wait...' : 'Generate Invoice PDF'}</button></div></Card>
    {generated && <div className="modal-backdrop"><div className="modal-card invoice-ready-modal"><h2>Invoice Ready</h2><div className="invoice-ready-summary"><span>Customer<strong>{generated.customer?.companyName || generated.manual.name}</strong></span><span>Account<strong>{generated.customer?.customerNumber || generated.manual.accountNumber}</strong></span><span>Invoice<strong>{generated.invoiceNumber}</strong></span><span>Total<strong>{money(totals.total)}</strong></span></div><p>The PDF download has started. What would you like to do with this invoice?</p><div className="invoice-action-grid"><button disabled={Boolean(actionBusy)} onClick={() => chooseSave(true)}><strong>{actionBusy === 'save-send' ? 'Saving...' : 'Save & Send'}</strong><span>Record it, update finances, then choose email or WhatsApp.</span></button><button disabled={Boolean(actionBusy)} onClick={() => chooseSave(false)}><strong>{actionBusy === 'save' ? 'Saving...' : 'Save to Customer'}</strong><span>Record the invoice and PDF without sending it.</span></button><button disabled={Boolean(actionBusy)} onClick={() => { if (!sendOnlyConfirmed) setSendOnlyConfirmed(true); else setSendPanel(true) }}><strong>Send Only</strong><span>Send the PDF without changing customer finances.</span></button><button onClick={() => { download(generated.pdf, generated.pdfFileName); setGenerated(null) }}><strong>Download Only</strong><span>Download again and close without saving.</span></button></div>{sendOnlyConfirmed && !sendPanel && <div className="send-only-warning"><strong>This invoice will be sent but will not be recorded against the customer's account or outstanding balance.</strong><button className="btn btn-danger btn-sm" onClick={() => setSendPanel(true)}>Confirm Send Only</button></div>}<div className="modal-actions"><button className="btn btn-secondary" onClick={() => download(generated.pdf, generated.pdfFileName)}>Download Again</button><button className="btn btn-ghost" onClick={() => setGenerated(null)}>Close</button></div>{sendPanel && <div className="send-invoice-panel"><h3>Send Invoice</h3><div className="invoice-mode-toggle">{([['email','Email'],['whatsapp','WhatsApp'],['both','Email + WhatsApp']] as const).map(([value,label]) => <button className={sendMode === value ? 'active' : ''} onClick={() => setSendMode(value)} key={value}>{label}</button>)}</div><div className="form-grid"><label className="form-control"><span>Email</span><input value={sendEmailAddress} onChange={event => setSendEmailAddress(event.target.value)} /></label><label className="form-control"><span>Telephone</span><input value={sendPhone} onChange={event => setSendPhone(event.target.value)} /></label><label className="form-control wide"><span>Message</span><textarea rows={7} value={sendMessage} onChange={event => setSendMessage(event.target.value)} /></label></div><div className="actions-row"><button className="btn btn-primary" disabled={actionBusy === 'send'} onClick={send}>{actionBusy === 'send' ? 'Sending...' : 'Send PDF'}</button><button className="btn btn-secondary" onClick={() => setSendPanel(false)}>Back</button></div></div>}</div></div>}
  </div>
}
