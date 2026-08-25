import { useMemo, useState } from 'react'
import type { Customer, Invoice } from '../../types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { parseFinancialDocument, type ImportedCreditNote, type ImportedInvoiceItem } from '../../lib/invoiceImport'
import { invoiceOutstanding } from '../../lib/creditNotes'
import { findCreditInvoiceMatch } from '../../lib/importMatching'

const money = (value: number) => `£${value.toFixed(2)}`

export function CustomerCreditNoteModal({ open, customer, invoices, onClose, onConfirm }: {
  open: boolean
  customer: Customer | null
  invoices: Invoice[]
  onClose: () => void
  onConfirm: (document: ImportedCreditNote, invoiceId?: string) => Promise<void>
}) {
  const [review, setReview] = useState<ImportedCreditNote | null>(null)
  const [invoiceId, setInvoiceId] = useState('')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const customerInvoices = useMemo(() => invoices.filter(invoice => invoice.customerId === customer?.id), [customer, invoices])
  const currentBalance = customerInvoices.reduce((sum, invoice) => sum + invoiceOutstanding(invoice), 0)
  const selectedInvoice = customerInvoices.find(invoice => invoice.id === invoiceId)
  const amount = Math.abs(review?.creditNote.grandTotal ?? 0)
  const reference = review?.creditNote.originalInvoiceReference ?? ''
  const exactMatch = customer ? findCreditInvoiceMatch(customerInvoices, customer.id, reference) : undefined
  const newBalance = selectedInvoice ? Math.max(0, currentBalance - amount) : currentBalance

  const reset = () => { setReview(null); setInvoiceId(''); setProgress(''); setError(''); setBusy(false) }
  const close = () => { reset(); onClose() }

  const readFile = async (file?: File) => {
    if (!file) return
    setError(''); setProgress('Reading credit note...')
    try {
      const parsed = await parseFinancialDocument(file, setProgress)
      if (parsed.documentType !== 'credit_note') {
        setReview(null)
        setError('This document is labelled as an invoice, not a credit note. Import it as an invoice so it cannot reduce the customer balance incorrectly.')
        return
      }
      const matched = customer ? findCreditInvoiceMatch(customerInvoices, customer.id, parsed.creditNote.originalInvoiceReference) : undefined
      setReview({ ...parsed, customer: { ...parsed.customer, accountNumber: customer?.customerNumber ?? parsed.customer.accountNumber, companyName: customer?.companyName ?? parsed.customer.companyName } })
      setInvoiceId(matched?.id ?? '')
    } catch { setError('Could not read that credit note. Try the original PDF, JPG or PNG file.') }
    finally { setProgress('') }
  }

  const updateItem = (index: number, key: keyof ImportedInvoiceItem, value: string) => {
    if (!review) return
    const numeric = ['quantity', 'price', 'goodsValue', 'vatRate', 'vatAmount'].includes(key)
    setReview({ ...review, items: review.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: numeric ? Number(value) : value } : item) })
  }

  const submit = async () => {
    if (!review) return
    setError('')
    if (!review.creditNote.date) { setError('Confirm the credit note date before saving.'); return }
    if (!review.items.length || review.items.some(item => !item.product.trim())) { setError('The credit note needs at least one valid product line.'); return }
    if (amount <= 0) { setError('The total credit must be greater than zero.'); return }
    if (selectedInvoice && amount > invoiceOutstanding(selectedInvoice)) {
      setError(`This credit is ${money(amount)}, but invoice ${selectedInvoice.invoiceNumber} only has ${money(invoiceOutstanding(selectedInvoice))} outstanding. Reduce the credit or save it as unallocated.`)
      return
    }
    setBusy(true)
    try { await onConfirm(review, invoiceId || undefined); close() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the credit note.') }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} title={customer ? `Add Credit Note - ${customer.companyName}` : 'Add Credit Note'} onClose={close} wide>
      <div className="stack">
        {!review && <label className="invoice-upload-zone"><strong>Upload Credit Note</strong><span>PDF, JPG, JPEG or PNG</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={event => readFile(event.target.files?.[0])} /></label>}
        {progress && <p className="processing-message">{progress}</p>}
        {review && customer && <>
          <div className="customer-finance-grid">
            <div><span>Customer</span><strong>{customer.companyName}</strong></div>
            <div><span>Account Number</span><strong>{customer.customerNumber}</strong></div>
            <div><span>Credit Note Number</span><strong>{review.creditNote.creditNumber || 'Generated when saved'}</strong></div>
            <div><span>Current Balance</span><strong>{money(currentBalance)}</strong></div>
          </div>
          <div className="form-grid">
            <Input label="Credit Note Date" type="date" value={review.creditNote.date} onChange={event => setReview({ ...review, creditNote: { ...review.creditNote, date: event.target.value } })} />
            <Input label="Referenced Invoice" value={reference} readOnly />
            <Input label="Credit Goods" type="number" value={String(review.creditNote.totalGoods)} onChange={event => setReview({ ...review, creditNote: { ...review.creditNote, totalGoods: Number(event.target.value) || 0 } })} />
            <Input label="VAT Credit" type="number" value={String(review.creditNote.vat)} onChange={event => setReview({ ...review, creditNote: { ...review.creditNote, vat: Number(event.target.value) || 0 } })} />
            <Input label="Total Credit" type="number" value={String(review.creditNote.grandTotal)} onChange={event => setReview({ ...review, creditNote: { ...review.creditNote, grandTotal: Number(event.target.value) || 0 } })} />
            <label className="form-control"><span>Apply Credit To</span><select value={invoiceId} onChange={event => setInvoiceId(event.target.value)}><option value="">Save as Unallocated Credit</option>{customerInvoices.map(invoice => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} - {money(invoiceOutstanding(invoice))} outstanding</option>)}</select></label>
          </div>
          {reference && !exactMatch && <p className="error-message">Original invoice not found. Select another invoice, import the missing invoice first, or save this as Unallocated Credit.</p>}
          {exactMatch && <p className="processing-message">Suggested match found: {exactMatch.invoiceNumber}. Confirm the selection below before applying the credit.</p>}
          <div className="invoice-builder-table"><table><thead><tr>{['Line','Qty','Product','Variety','Size','Price','Credit Value','VC','VAT %','VAT'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{review.items.map((item, index) => <tr key={index}>{(['line','quantity','product','variety','size','price','goodsValue','vatCode','vatRate','vatAmount'] as const).map(key => <td key={key}><input value={String(item[key] ?? '')} onChange={event => updateItem(index, key, event.target.value)} /></td>)}</tr>)}</tbody></table></div>
          <div className="customer-finance-grid">
            <div><span>Credit Amount</span><strong>{money(amount)}</strong></div>
            <div><span>Invoice Outstanding</span><strong>{selectedInvoice ? money(invoiceOutstanding(selectedInvoice)) : 'Not allocated'}</strong></div>
            <div><span>New Customer Balance</span><strong>{money(newBalance)}</strong></div>
            <div><span>Result</span><strong>{selectedInvoice ? `Apply to ${selectedInvoice.invoiceNumber}` : 'Unallocated Credit'}</strong></div>
          </div>
          {review.warnings.map(warning => <p className="error-message" key={warning}>{warning}</p>)}
        </>}
        {error && <p className="error-message">{error}</p>}
        {review && <div className="actions-row"><Button onClick={submit} disabled={busy}>{busy ? 'Saving...' : invoiceId ? 'Confirm Credit' : 'Save Unallocated Credit'}</Button><Button variant="secondary" onClick={close}>Cancel</Button></div>}
      </div>
    </Modal>
  )
}
