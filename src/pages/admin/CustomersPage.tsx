import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Customer, CreditNote, CreditNoteAllocation, DeliveryArea, Invoice, Payment, WhatsAppTemplate } from '../../types'
import { parseStatementPdf, type PunjabStatement, type StatementRow } from '../../lib/statementImport'
import { importStatementInvoices } from '../../api/miscApi'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input, Select } from '../../components/ui/Input'
import { DataTable } from '../../components/ui/Table'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { CustomerStatementModal } from './CustomerStatementModal'
import { SendWhatsAppModal } from '../../components/SendWhatsAppModal'
import { getCreditStatus, creditWarningLabel } from '../../lib/creditControl'
import { SALESMEN } from '../../lib/salesmen'
import { parseLegacyInvoice, type ImportedLegacyInvoice } from '../../lib/invoiceImport'

const initialForm = {
  companyName: '',
  contactPerson: '',
  email: '',
  phone: '',
  customerNumber: '',
  password: '',
  address: '',
  deliveryArea: 'Birmingham',
  paymentTerms: '14 Days',
}

const initialFullForm = {
  companyName: '',
  contactPerson: '',
  email: '',
  password: '',
  phone: '',
  registeredAddress: '',
  address: '', // delivery address
  vatNumber: '',
  creditLimit: '0',
  creditDays: '14',
  notes: '',
  salesmanId: '',
  salesmanName: '',
}

export function CustomersPage({
  customers,
  deliveryAreas,
  invoices = [],
  payments = [],
  creditNotes = [],
  creditNoteAllocations = [],
  onCreate,
  onUpdate,
  onDelete,
  canDelete = true,
  whatsappTemplates = [],
  onSendWhatsApp,
  onSaveWhatsAppTemplate,
  onCreateFromInvoice,
  onNavigate,
  onInviteCustomer,
}: {
  customers: Customer[]
  deliveryAreas: DeliveryArea[]
  invoices?: Invoice[]
  payments?: Payment[]
  creditNotes?: CreditNote[]
  creditNoteAllocations?: CreditNoteAllocation[]
  onCreate: (input: typeof initialForm & Partial<Pick<Customer, 'registeredAddress' | 'vatNumber' | 'creditLimit' | 'creditDays' | 'notes' | 'salesmanId' | 'salesmanName'>>) => Promise<void>
  onUpdate: (id: string, input: Partial<Customer>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  /** Gates the Delete button — Salesperson/Cashier-type roles can view and
      create customers but shouldn't be able to delete them. */
  canDelete?: boolean
  whatsappTemplates?: WhatsAppTemplate[]
  onSendWhatsApp?: (phone: string, message: string, customer: Customer) => Promise<void>
  onSaveWhatsAppTemplate?: (name: string, message: string) => Promise<void>
  onCreateFromInvoice?: (data: ImportedLegacyInvoice) => Promise<void>
  onNavigate?: (page: string) => void
  onInviteCustomer?: (accountNumber: string, email: string, phone: string) => Promise<void>
}) {
  const [whatsappTarget, setWhatsappTarget] = useState<Customer | null>(null)
  const [whatsappBusy, setWhatsappBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [editing, setEditing] = useState<Customer | null>(null)
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [addMode, setAddMode] = useState<'invoice' | 'invite' | 'full'>('invoice')
  const [invoiceReview, setInvoiceReview] = useState<ImportedLegacyInvoice | null>(null)
  const [invoiceReading, setInvoiceReading] = useState('')
  const [onboardingCustomer, setOnboardingCustomer] = useState('')
  const [onboardingContact, setOnboardingContact] = useState(false)
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [onboardingAccount, setOnboardingAccount] = useState('')
  const [accountProfile, setAccountProfile] = useState<Customer | null>(null)
  const [profileTab, setProfileTab] = useState('Overview')
  const [fullForm, setFullForm] = useState(initialFullForm)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [statementTarget, setStatementTarget] = useState<Customer | null>(null)
  // One-time statement import
  const [importTarget, setImportTarget] = useState<Customer | null>(null)
  const [importRows, setImportRows] = useState<StatementRow[]>([])
  const [importStatement, setImportStatement] = useState<PunjabStatement | null>(null)
  const [importChecked, setImportChecked] = useState<Set<string>>(new Set())
  const [importBusy, setImportBusy] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [importProgress, setImportProgress] = useState('')
  const [importDone, setImportDone] = useState('')

  const filtered = useMemo(
    () =>
      customers.filter((item) => {
        if (Boolean(item.archived) !== showArchived) return false
        const source = `${item.companyName} ${item.contactPerson} ${item.email} ${item.customerNumber}`.toLowerCase()
        return source.includes(query.toLowerCase())
      }),
    [customers, query, showArchived],
  )
  const archivedCount = useMemo(() => customers.filter(c => c.archived).length, [customers])
  const fmtMoney = (value: number | undefined | null) => `£${(value ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault()
    const email = newEmail.trim().toLowerCase()
    if (customers.some(c => c.email?.toLowerCase() === email)) {
      setAddError('A customer with that email already exists.')
      return
    }
    setAddError(''); setAdding(true)
    // Stub account — the customer completes their own details (name, phone,
    // address, password) during first-time login with the emailed code.
    const nums = customers.map(c => parseInt(c.customerNumber.replace(/\D/g, '')) || 0)
    const nextNum = `CUST-${String(Math.max(1000, ...nums) + 1)}`
    try {
      await onCreate({
        ...initialForm,
        email,
        companyName: email.split('@')[0],
        contactPerson: '',
        customerNumber: nextNum,
        password: `pending-${Math.random().toString(36).slice(2, 10)}`,
      })
      setNewEmail('')
      setShowAdd(false)
    } catch {
      setAddError('Could not create the customer — please try again.')
    }
    setAdding(false)
  }

  const submitFullCreate = async (event: FormEvent) => {
    event.preventDefault()
    const email = fullForm.email.trim().toLowerCase()
    if (!fullForm.companyName.trim()) { setAddError('Company name is required.'); return }
    if (!email || !email.includes('@')) { setAddError('Enter a valid email address.'); return }
    if (!fullForm.password || fullForm.password.length < 6) { setAddError('Password must be at least 6 characters.'); return }
    if (customers.some(c => c.email?.toLowerCase() === email)) { setAddError('A customer with that email already exists.'); return }
    setAddError(''); setAdding(true)
    const nums = customers.map(c => parseInt(c.customerNumber.replace(/\D/g, '')) || 0)
    const nextNum = `CUST-${String(Math.max(1000, ...nums) + 1)}`
    try {
      await onCreate({
        ...initialForm,
        companyName: fullForm.companyName.trim(),
        contactPerson: fullForm.contactPerson.trim(),
        email,
        password: fullForm.password,
        phone: fullForm.phone.trim(),
        address: fullForm.address.trim(),
        customerNumber: nextNum,
        deliveryArea: initialForm.deliveryArea,
        paymentTerms: initialForm.paymentTerms,
        registeredAddress: fullForm.registeredAddress.trim(),
        vatNumber: fullForm.vatNumber.trim() || undefined,
        creditLimit: parseFloat(fullForm.creditLimit) || 0,
        creditDays: parseInt(fullForm.creditDays) || 14,
        notes: fullForm.notes.trim() || undefined,
        salesmanId: fullForm.salesmanId || undefined,
        salesmanName: fullForm.salesmanName || undefined,
      })
      setFullForm(initialFullForm)
      setShowAdd(false)
    } catch {
      setAddError('Could not create the customer — please try again.')
    }
    setAdding(false)
  }

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    setEditError('')
    if (!editing.companyName.trim()) { setEditError('Company name is required.'); return }
    if (!editing.email.trim() || !editing.email.includes('@')) { setEditError('Enter a valid email address.'); return }
    if ((editing.creditLimit ?? 0) < 0) { setEditError('Credit limit cannot be negative.'); return }
    if ((editing.creditDays ?? 0) < 1) { setEditError('Credit days must be at least 1.'); return }
    setSavingEdit(true)
    try {
      await onUpdate(editing.id, editing)
      setEditing(null)
    } catch {
      setEditError('Could not save changes — please try again.')
    }
    setSavingEdit(false)
  }

  const archiveCustomer = async (customer: Customer) => {
    if (!window.confirm(`Archive ${customer.companyName}? They'll be hidden from the customer list but can be restored at any time.`)) return
    setDeletingId(customer.id)
    try { await onUpdate(customer.id, { archived: true }) } finally { setDeletingId(null) }
  }

  const restoreCustomer = async (customer: Customer) => {
    setDeletingId(customer.id)
    try { await onUpdate(customer.id, { archived: false }) } finally { setDeletingId(null) }
  }

  const confirmDelete = async (customer: Customer) => {
    if (!window.confirm(`Permanently delete ${customer.companyName}? This removes their login and cannot be undone.`)) return
    setDeletingId(customer.id)
    try { await onDelete(customer.id) } finally { setDeletingId(null) }
  }

  const openImport = (customer: Customer) => {
    setImportTarget(customer); setImportRows([]); setImportChecked(new Set())
    setImportStatement(null); setImportMsg(''); setImportDone('')
  }

  const readFirstInvoice = async (file?: File) => {
    if (!file) return
    setAddError(''); setInvoiceReview(null); setInvoiceReading('Reading invoice...')
    try { setInvoiceReview(await parseLegacyInvoice(file, setInvoiceReading)) } catch { setAddError('Could not read that invoice. Try the original PDF, JPG or PNG file.') }
    setInvoiceReading('')
  }

  const submitInvoiceCustomer = async () => {
    if (!invoiceReview || !onCreateFromInvoice) return
    if (!/^\d{6}$/.test(invoiceReview.customer.accountNumber)) { setAddError('Account Number must be exactly six digits from the invoice Num field.'); return }
    if (!invoiceReview.customer.companyName.trim()) { setAddError('Company name is required.'); return }
    setAdding(true); setAddError('')
    try { await onCreateFromInvoice(invoiceReview); setOnboardingCustomer(`${invoiceReview.customer.companyName} - ${invoiceReview.customer.accountNumber}`); setOnboardingAccount(invoiceReview.customer.accountNumber); setContactEmail(invoiceReview.customer.email); setContactPhone(invoiceReview.customer.phone); setInvoiceReview(null) } catch (error) { setAddError(error instanceof Error ? error.message : 'Could not create the customer and invoice.') }
    setAdding(false)
  }

  const handleStatementFile = async (file: File | undefined) => {
    if (!file) return
    setImportBusy(true); setImportMsg(''); setImportProgress('Reading statement…'); setImportRows([]); setImportDone('')
    try {
      const { rows, renderFailed, statement } = await parseStatementPdf(file, msg => setImportProgress(msg))
      if (rows.length === 0 && renderFailed) {
        setImportMsg("This PDF's scan couldn't be read (some scanned/exported PDFs aren't compatible with the in-browser reader). Please upload the original photo or screenshot instead (JPG/PNG) — that reads reliably.")
      } else if (rows.length === 0) {
        setImportMsg("No invoice lines found — the file may have unclear text or an unusual layout. Check it and try again, or send it to support so we can improve the reader.")
      } else {
        setImportStatement(statement ?? null)
        setImportRows(rows)
        setImportChecked(new Set(rows.map(r => r.invoiceNumber)))
        if (statement?.processingStatus === 'NEEDS_REVIEW') setImportMsg(`Statement requires review: ${statement.reviewReasons.join(' ')}`)
      }
    } catch {
      setImportMsg("Couldn't read that file — check it isn't password-protected and try again.")
    }
    setImportProgress('')
    setImportBusy(false)
  }

  const confirmImport = async () => {
    if (!importTarget) return
    const rows = importRows.filter(r => importChecked.has(r.invoiceNumber))
    if (rows.length === 0) return
    setImportBusy(true)
    const { created, updated, failed } = await importStatementInvoices(importTarget.id, rows, importTarget.creditDays ?? 14)
    void updated
    // Opening balance = total of everything just imported (plus any existing balance)
    const importedTotal = rows.filter(r => !failed.includes(r.invoiceNumber)).reduce((s, r) => s + (r.outstandingAmount ?? r.amount), 0)
    await onUpdate(importTarget.id, { balance: importedTotal })
    setImportDone(
      `${created} invoice${created !== 1 ? 's' : ''} imported (£${importedTotal.toFixed(2)})` +
      (failed.length ? ` — ${failed.length} skipped as duplicates: ${failed.join(', ')}` : ''),
    )
    setImportRows([]); setImportBusy(false)
  }

  return (
    <div className="stack">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0d2b1e' }}>Customers</h2>
          <p style={{ fontSize: 13.5, color: '#6b7a70', marginTop: 3 }}>
            Manage customer login accounts, delivery areas and payment types.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => setShowArchived(a => !a)}>
            {showArchived ? '← Back to Customers' : `Archived Customers${archivedCount > 0 ? ` (${archivedCount})` : ''}`}
          </Button>
          {!showArchived && <Button onClick={() => { setNewEmail(''); setFullForm(initialFullForm); setAddMode('invoice'); setInvoiceReview(null); setOnboardingCustomer(''); setOnboardingContact(false); setAddError(''); setShowAdd(true) }}>+ Add Customer</Button>}
        </div>
      </div>

      <Modal open={showAdd} title={addMode === 'invoice' ? 'Create Customer from Invoice' : addMode === 'invite' ? 'Invite New Customer' : 'Create Customer Account'} onClose={() => setShowAdd(false)} wide={addMode !== 'invite'}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button type="button" onClick={() => { setAddMode('invoice'); setAddError('') }}
            style={{ flex: 1, padding: '9px 14px', borderRadius: 8, cursor: 'pointer', border: addMode === 'invoice' ? '2px solid #1f7a3a' : '1.5px solid #e5e7eb', background: addMode === 'invoice' ? '#f0fdf4' : '#fff', fontWeight: 700, fontSize: 13 }}>
            From Invoice
          </button>
          <button type="button" onClick={() => { setAddMode('invite'); setAddError('') }}
            style={{ flex: 1, padding: '9px 14px', borderRadius: 10, cursor: 'pointer', border: addMode === 'invite' ? '2px solid #1f7a3a' : '1.5px solid #e5e7eb', background: addMode === 'invite' ? '#f0fdf4' : '#fff', fontWeight: 700, fontSize: 13, color: addMode === 'invite' ? '#14532d' : '#374151' }}>
            Invite by Email
          </button>
          <button type="button" onClick={() => { setAddMode('full'); setAddError('') }}
            style={{ flex: 1, padding: '9px 14px', borderRadius: 10, cursor: 'pointer', border: addMode === 'full' ? '2px solid #1f7a3a' : '1.5px solid #e5e7eb', background: addMode === 'full' ? '#f0fdf4' : '#fff', fontWeight: 700, fontSize: 13, color: addMode === 'full' ? '#14532d' : '#374151' }}>
            Enter Full Details
          </button>
        </div>

        {addMode === 'invoice' ? (
          <div className="stack">
            {onboardingCustomer && !invoiceReview && !onboardingContact && <div className="onboarding-success"><strong>Customer Created / Invoice Added</strong><span>{onboardingCustomer}</span><p>Would you like to add another invoice for this customer?</p><div className="actions-row"><Button onClick={()=>setOnboardingCustomer('')}>+ Add Another Invoice</Button><Button variant="secondary" onClick={()=>setOnboardingContact(true)}>Finished Adding Invoices</Button></div></div>}
            {onboardingContact && <div className="stack"><div className="onboarding-success"><strong>Customer Contact & Portal Access</strong><span>{onboardingCustomer}</span></div><div className="form-grid"><Input label="Email Address" type="email" value={contactEmail} onChange={e=>setContactEmail(e.target.value)}/><Input label="Telephone Number" value={contactPhone} onChange={e=>setContactPhone(e.target.value)}/></div><h3>Invite Customer to Portal?</h3><div className="actions-row"><Button disabled={!contactEmail||adding} onClick={async()=>{if(!onInviteCustomer)return;setAdding(true);await onInviteCustomer(onboardingAccount,contactEmail,contactPhone);setAdding(false);setShowAdd(false);setOnboardingContact(false);setOnboardingCustomer('')}}>{adding?'Sending...':'Send Invitation'}</Button><Button variant="secondary" onClick={()=>{setShowAdd(false);setOnboardingContact(false);setOnboardingCustomer('')}}>Not Now</Button><Button variant="ghost" onClick={()=>{setOnboardingContact(false);setOnboardingCustomer('')}}>+ Add Another Invoice</Button></div></div>}
            {!onboardingCustomer && !onboardingContact && <>
            <label className="invoice-upload-zone"><strong>Upload First Invoice</strong><span>PDF, JPG, JPEG or PNG</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={e => readFirstInvoice(e.target.files?.[0])} /></label>
            {invoiceReading && <p className="processing-message">{invoiceReading}</p>}
            {invoiceReview && <>
              <div className="form-grid">
                <Input label="Company Name" value={invoiceReview.customer.companyName} onChange={e => setInvoiceReview({ ...invoiceReview, customer: { ...invoiceReview.customer, companyName: e.target.value } })} />
                <Input label="Account Number" value={invoiceReview.customer.accountNumber} onChange={e => setInvoiceReview({ ...invoiceReview, customer: { ...invoiceReview.customer, accountNumber: e.target.value.replace(/\D/g,'').slice(0,6) } })} />
                <div className="wide"><Input label="Address" value={invoiceReview.customer.address} onChange={e => setInvoiceReview({ ...invoiceReview, customer: { ...invoiceReview.customer, address: e.target.value } })} /></div>
                <Input label="Telephone" value={invoiceReview.customer.phone} onChange={e => setInvoiceReview({ ...invoiceReview, customer: { ...invoiceReview.customer, phone: e.target.value } })} />
                <Input label="Email" value={invoiceReview.customer.email} onChange={e => setInvoiceReview({ ...invoiceReview, customer: { ...invoiceReview.customer, email: e.target.value } })} />
                <Input label="Invoice Number" value={invoiceReview.invoice.invoiceNumber} onChange={e => setInvoiceReview({ ...invoiceReview, invoice: { ...invoiceReview.invoice, invoiceNumber: e.target.value } })} />
                <Input label="Invoice Date" type="date" value={invoiceReview.invoice.date} onChange={e => setInvoiceReview({ ...invoiceReview, invoice: { ...invoiceReview.invoice, date: e.target.value } })} />
                <Input label="Grand Total (£)" type="number" value={String(invoiceReview.invoice.grandTotal)} onChange={e => setInvoiceReview({ ...invoiceReview, invoice: { ...invoiceReview.invoice, grandTotal: Number(e.target.value) || 0 } })} />
                <Input label="Packages" type="number" value={String(invoiceReview.invoice.packages)} onChange={e => setInvoiceReview({ ...invoiceReview, invoice: { ...invoiceReview.invoice, packages: Number(e.target.value) || 0 } })} />
              </div>
              <div className="invoice-builder-table"><table><thead><tr>{['Line','Qty','Product','Variety','Size','Price','VAT %','Remove'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{invoiceReview.items.map((item,index)=><tr key={index}>{(['line','quantity','product','variety','size','price','vatRate'] as const).map(key=><td key={key}><input value={String(item[key])} onChange={e=>setInvoiceReview({...invoiceReview,items:invoiceReview.items.map((x,i)=>i===index?{...x,[key]:['quantity','price','vatRate'].includes(key)?Number(e.target.value):e.target.value}:x)})}/></td>)}<td><button className="icon-button" onClick={()=>setInvoiceReview({...invoiceReview,items:invoiceReview.items.filter((_,i)=>i!==index)})}>×</button></td></tr>)}</tbody></table></div>
              <Button variant="secondary" onClick={()=>setInvoiceReview({...invoiceReview,items:[...invoiceReview.items,{line:'',quantity:1,product:'',variety:'',size:'',price:0,goodsValue:0,vatCode:'',vatRate:0}]})}>+ Add Product</Button>
              {customers.find(c => c.customerNumber === invoiceReview.customer.accountNumber) && <p className="processing-message">Existing Customer Found: {customers.find(c => c.customerNumber === invoiceReview.customer.accountNumber)?.companyName}</p>}
              {invoiceReview.warnings.map(w => <p className="error-message" key={w}>{w}</p>)}
              <div className="actions-row"><Button onClick={submitInvoiceCustomer} disabled={adding}>{adding ? 'Saving...' : customers.some(c => c.customerNumber === invoiceReview.customer.accountNumber) ? 'Add Invoice to Existing Customer' : 'Create Customer & Add Invoice'}</Button></div>
            </>}
            {addError && <p className="error-message">{addError}</p>}
            </>}
          </div>
        ) : addMode === 'invite' ? (
          <form onSubmit={submitCreate}>
            <div className="inv-hero">
              <span className="inv-ico">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </span>
              <p>Just enter their email — we'll send an invitation and they'll fill in their company details, phone and password themselves on first login.</p>
            </div>
            <label className="form-control">
              <span>Customer Email</span>
              <input type="email" placeholder="orders@company.co.uk" value={newEmail} onChange={(e) => { setNewEmail(e.target.value); setAddError('') }} required autoFocus />
            </label>
            {addError && <p style={{ color: '#b91c1c', fontSize: 13, background: '#fef2f2', borderRadius: 8, padding: '8px 12px', marginTop: 10 }}>{addError}</p>}
            <div className="actions-row" style={{ marginTop: 16 }}>
              <Button type="submit" disabled={adding}>{adding ? 'Sending invite…' : 'Send Invitation'}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <form className="form-grid" onSubmit={submitFullCreate}>
            <p className="wide" style={{ fontSize: 12.5, color: '#6b7a70', margin: '0 0 -6px' }}>
              Manually create the account now — the customer can log in immediately with the email and password you set below.
            </p>
            <Input label="Customer Name" value={fullForm.contactPerson} onChange={(e) => setFullForm({ ...fullForm, contactPerson: e.target.value })} required autoFocus />
            <Input label="Company Name" value={fullForm.companyName} onChange={(e) => setFullForm({ ...fullForm, companyName: e.target.value })} required />
            <Input label="Email" type="email" value={fullForm.email} onChange={(e) => setFullForm({ ...fullForm, email: e.target.value })} required />
            <Input label="Password" type="password" value={fullForm.password} onChange={(e) => setFullForm({ ...fullForm, password: e.target.value })} required />
            <Input label="Phone Number" value={fullForm.phone} onChange={(e) => setFullForm({ ...fullForm, phone: e.target.value })} />
            <Input label="VAT Number (optional)" value={fullForm.vatNumber} onChange={(e) => setFullForm({ ...fullForm, vatNumber: e.target.value })} />
            <div className="wide"><Input label="Registered Company Address" value={fullForm.registeredAddress} onChange={(e) => setFullForm({ ...fullForm, registeredAddress: e.target.value })} /></div>
            <div className="wide"><Input label="Delivery Address" value={fullForm.address} onChange={(e) => setFullForm({ ...fullForm, address: e.target.value })} /></div>
            <Input label="Credit Limit (£)" type="number" min="0" step="0.01" value={fullForm.creditLimit} onChange={(e) => setFullForm({ ...fullForm, creditLimit: e.target.value })} />
            <Input label="Credit Days" type="number" min="1" step="1" value={fullForm.creditDays} onChange={(e) => setFullForm({ ...fullForm, creditDays: e.target.value })} />
            <Select label="Salesman" options={['Unassigned', ...SALESMEN.map(s => s.name)]}
              value={fullForm.salesmanName || 'Unassigned'}
              onChange={(value) => {
                const sm = SALESMEN.find(s => s.name === value)
                setFullForm({ ...fullForm, salesmanId: sm?.id ?? '', salesmanName: sm?.name ?? '' })
              }} />
            <div className="wide">
              <label className="form-control">
                <span>Notes</span>
                <textarea rows={2} value={fullForm.notes} onChange={(e) => setFullForm({ ...fullForm, notes: e.target.value })} placeholder="Internal notes about this customer…" />
              </label>
            </div>
            {addError && <p className="wide" style={{ color: '#b91c1c', fontSize: 13, background: '#fef2f2', borderRadius: 8, padding: '8px 12px', margin: 0 }}>{addError}</p>}
            <div className="wide actions-row">
              <Button type="submit" disabled={adding}>{adding ? 'Creating…' : 'Create Customer'}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </Modal>

      <Card title="Customers" actions={<Input label="Search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company, contact, email or number" />}>
        <DataTable columns={['Company', 'Contact', 'Email', 'Number', 'Delivery Area', 'Terms', 'Status', 'Actions']}>
          {filtered.map((customer) => (
            <tr key={customer.id}>
              <td>{customer.companyName}</td>
              <td>{customer.contactPerson}</td>
              <td>{customer.email}</td>
              <td>{customer.customerNumber}</td>
              <td>{customer.deliveryArea || '—'}</td>
              <td>{customer.paymentTerms}</td>
              <td>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {customer.blocked ? (
                    <span className="ps-badge" style={{ background: '#111827', color: '#fff' }}>Blocked</span>
                  ) : customer.status === 'inactive' ? (
                    <span className="ps-badge ps-badge-gray">Inactive</span>
                  ) : (
                    <span className="ps-badge ps-badge-green">Active</span>
                  )}
                  {(() => {
                    const label = creditWarningLabel(getCreditStatus(customer, invoices))
                    return label ? <span className="ps-badge ps-badge-red" title={label}>{label}</span> : null
                  })()}
                </div>
              </td>
              <td>
                <div className="table-actions" style={{ display: 'flex', gap: 6 }}>
                  {showArchived ? (
                    canDelete && (
                      <>
                        <Button variant="secondary" className="btn-sm" disabled={deletingId === customer.id} onClick={() => restoreCustomer(customer)}>
                          {deletingId === customer.id ? 'Restoring…' : 'Restore'}
                        </Button>
                        <Button variant="danger" className="btn-sm" disabled={deletingId === customer.id} onClick={() => confirmDelete(customer)}>
                          Delete Permanently
                        </Button>
                      </>
                    )
                  ) : (
                    <>
                      <Button variant="secondary" className="btn-sm" onClick={() => { setEditError(''); setEditing(customer) }}>Edit</Button>
                      <Button variant="secondary" className="btn-sm" onClick={() => { setAccountProfile(customer); setProfileTab('Overview') }}>Open Account</Button>
                      <Button variant="ghost" className="btn-sm" onClick={() => setStatementTarget(customer)}>Statement</Button>
                      <Button variant="ghost" className="btn-sm" onClick={() => openImport(customer)}>Import Statement</Button>
                      {onSendWhatsApp && (
                        <Button variant="ghost" className="btn-sm" onClick={() => setWhatsappTarget(customer)}>Send WhatsApp</Button>
                      )}
                      {canDelete && (
                        <Button variant="danger" className="btn-sm" disabled={deletingId === customer.id} onClick={() => archiveCustomer(customer)}>
                          {deletingId === customer.id ? 'Archiving…' : 'Archive'}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
        {filtered.length === 0 && (
          <EmptyState
            title={showArchived ? "No archived customers" : "No customers yet"}
            description={showArchived ? "Customers you archive will appear here for restoring later." : "Create your first customer login above."}
          />
        )}
      </Card>

      <Modal open={Boolean(accountProfile)} title={accountProfile ? `${accountProfile.companyName} - ${accountProfile.customerNumber}` : 'Customer Account'} onClose={() => setAccountProfile(null)} wide>
        {accountProfile && (() => {
          const myInvoices=invoices.filter(i=>i.customerId===accountProfile.id), myPayments=payments.filter(p=>p.customerId===accountProfile.id)
          const invoiced=myInvoices.reduce((s,i)=>s+i.amount,0), paid=myInvoices.reduce((s,i)=>s+(i.amountPaid??0),0), outstanding=Math.max(0,invoiced-paid)
          const overdue=myInvoices.filter(i=>i.status!=='Paid'&&i.dueDate<new Date().toISOString().slice(0,10)).reduce((s,i)=>s+Math.max(0,i.amount-(i.amountPaid??0)),0)
          return <div className="stack"><div className="customer-action-bar"><button onClick={()=>{setAccountProfile(null);onNavigate?.('create-invoice')}}>+ Create Invoice</button><button onClick={()=>{setAccountProfile(null);openImport(accountProfile)}}>+ Add Invoice</button><button onClick={()=>{setAccountProfile(null);onNavigate?.('outstanding')}}>Record Payment</button><button onClick={()=>{setAccountProfile(null);onNavigate?.('expenses')}}>Record Expense</button><button onClick={()=>{setAccountProfile(null);onNavigate?.('files')}}>Upload Document</button>{onSendWhatsApp&&<button onClick={()=>setWhatsappTarget(accountProfile)}>Send Message</button>}</div><div className="customer-finance-grid">{[['Total Invoiced',invoiced],['Total Paid',paid],['Outstanding',outstanding],['Overdue',overdue],['Current S/L Balance',outstanding]].map(([l,v])=><div key={String(l)}><span>{l}</span><strong>{fmtMoney(Number(v))}</strong></div>)}</div><div className="profile-tabs">{['Overview','Invoices','Outstanding','Payments','Documents','Statements','Activity'].map(t=><button className={profileTab===t?'active':''} onClick={()=>setProfileTab(t)} key={t}>{t}</button>)}</div>{profileTab==='Overview'&&<div className="form-grid"><div><strong>Email</strong><p>{accountProfile.email}</p></div><div><strong>Telephone</strong><p>{accountProfile.phone||'—'}</p></div><div className="wide"><strong>Address</strong><p>{accountProfile.address||'—'}</p></div></div>}{['Invoices','Outstanding'].includes(profileTab)&&<DataTable columns={['Invoice','Date','Due','Total','Paid','Outstanding','Status']}>{myInvoices.filter(i=>profileTab!=='Outstanding'||i.status!=='Paid').map(i=><tr key={i.id}><td>{i.invoiceNumber}</td><td>{i.date}</td><td>{i.dueDate}</td><td>{fmtMoney(i.amount)}</td><td>{fmtMoney(i.amountPaid)}</td><td>{fmtMoney(i.amount-(i.amountPaid??0))}</td><td>{i.status}</td></tr>)}</DataTable>}{profileTab==='Payments'&&<DataTable columns={['Reference','Date','Method','Amount']}>{myPayments.map(p=><tr key={p.id}><td>{p.paymentReference}</td><td>{p.date}</td><td>{p.method}</td><td>{fmtMoney(p.amount)}</td></tr>)}</DataTable>}{profileTab==='Documents'&&<button className="btn btn-primary" onClick={()=>{setAccountProfile(null);onNavigate?.('files')}}>Open Customer Files</button>}{profileTab==='Statements'&&<button className="btn btn-primary" onClick={()=>{setAccountProfile(null);setStatementTarget(accountProfile)}}>View Statement</button>}{profileTab==='Activity'&&<p className="empty-state">Customer invoice uploads, payments and communications appear in Recent Activity and communication history.</p>}</div>
        })()}
      </Modal>

      <Modal open={Boolean(editing)} title={editing ? `Edit ${editing.companyName || 'Customer'}` : 'Edit Customer'} onClose={() => setEditing(null)}>
        {editing ? (
          <form className="form-grid" onSubmit={submitEdit}>
            <p className="wide" style={{ fontSize: 11.5, fontWeight: 700, color: '#6b7a70', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 -6px' }}>
              Company Details
            </p>
            <Input label="Company Name" value={editing.companyName} onChange={(e) => setEditing({ ...editing, companyName: e.target.value })} required />
            <Input label="Contact Person" value={editing.contactPerson} onChange={(e) => setEditing({ ...editing, contactPerson: e.target.value })} />
            <Input label="Email" type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} required />
            <Input label="Phone" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            <Input label="VAT Number (optional)" value={editing.vatNumber ?? ''} onChange={(e) => setEditing({ ...editing, vatNumber: e.target.value })} />
            <div className="wide"><Input label="Registered Company Address" value={editing.registeredAddress ?? ''} onChange={(e) => setEditing({ ...editing, registeredAddress: e.target.value })} placeholder="Street, city, postcode" /></div>
            <div className="wide"><Input label="Delivery Address" value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} placeholder="Street, city, postcode" /></div>

            <p className="wide" style={{ fontSize: 11.5, fontWeight: 700, color: '#6b7a70', textTransform: 'uppercase', letterSpacing: 0.5, margin: '10px 0 -6px' }}>
              Delivery &amp; Account
            </p>
            <Select label="Delivery Area" options={deliveryAreas.length ? deliveryAreas.map(a => a.name) : [editing.deliveryArea || 'Unassigned']}
              value={editing.deliveryArea} onChange={(value) => setEditing({ ...editing, deliveryArea: value })} />
            <Select label="Account Status" options={['active', 'inactive']} value={editing.status}
              onChange={(value) => setEditing({ ...editing, status: value as Customer['status'] })} />
            <Select label="Salesman" options={['Unassigned', ...SALESMEN.map(s => s.name)]}
              value={editing.salesmanName || 'Unassigned'}
              onChange={(value) => {
                const sm = SALESMEN.find(s => s.name === value)
                setEditing({ ...editing, salesmanId: sm?.id, salesmanName: sm?.name })
              }} />

            <p className="wide" style={{ fontSize: 11.5, fontWeight: 700, color: '#6b7a70', textTransform: 'uppercase', letterSpacing: 0.5, margin: '10px 0 -6px' }}>
              Credit Control
            </p>
            <Select label="Payment Terms" options={['Payment Before Order', '14 Days', '30 Days']} value={editing.paymentTerms} onChange={(value) => setEditing({ ...editing, paymentTerms: value })} />
            <Input label="Current Balance (£)" value={`£${(editing.balance ?? 0).toFixed(2)}`} disabled title="Balance updates automatically from orders, statement imports and payments" />
            <Input label="Credit Limit (£)" type="number" min="0" step="0.01" value={String(editing.creditLimit ?? 0)}
              onChange={(e) => setEditing({ ...editing, creditLimit: parseFloat(e.target.value) || 0 })} />
            <Input label="Credit Days" type="number" min="1" step="1" value={String(editing.creditDays ?? 14)}
              onChange={(e) => setEditing({ ...editing, creditDays: parseInt(e.target.value) || 0 })} />
            <p className="wide" style={{ fontSize: 12.5, color: '#6b7a70', margin: 0 }}>
              Credit limit is the maximum outstanding balance allowed (0 = no limit). Credit days is how long each invoice can stay unpaid before it's overdue.
            </p>

            <p className="wide" style={{ fontSize: 11.5, fontWeight: 700, color: '#6b7a70', textTransform: 'uppercase', letterSpacing: 0.5, margin: '10px 0 -6px' }}>
              Notes
            </p>
            <div className="wide">
              <label className="form-control">
                <span>Internal Notes</span>
                <textarea rows={3} value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="Internal notes about this customer…" />
              </label>
            </div>

            {editError && <p className="wide" style={{ color: '#b91c1c', fontSize: 13, background: '#fef2f2', borderRadius: 8, padding: '8px 12px', margin: 0 }}>{editError}</p>}
            <div className="wide actions-row">
              <Button type="submit" disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save Changes'}</Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* One-time statement import */}
      <Modal open={Boolean(importTarget)} title={importTarget ? `Import Statement — ${importTarget.companyName}` : 'Import Statement'} onClose={() => setImportTarget(null)} wide>
        {importTarget && (
          <div>
            <p style={{ fontSize: 13.5, color: '#6b7a70', marginBottom: 12 }}>
              Upload this customer's Punjab statement PDF. Each invoice row is matched to the statement columns,
              and the customer's balance is synced to the outstanding amount that has not been paid.
              If it's a scanned statement, a photo or screenshot (JPG/PNG) usually reads more reliably than a scanned PDF.
            </p>
            <input
              type="file" accept="application/pdf,image/*"
              onChange={e => handleStatementFile(e.target.files?.[0])}
              disabled={importBusy}
              style={{ marginBottom: 12 }}
            />
            {importBusy && <p style={{ fontSize: 13, color: '#6b7a70' }}>{importProgress || 'Working…'}</p>}
            {importMsg && <p style={{ color: '#b91c1c', fontSize: 13, background: '#fef2f2', borderRadius: 8, padding: '8px 12px' }}>{importMsg}</p>}
            {importDone && <p style={{ color: '#15803d', fontSize: 13, background: '#f0fdf4', borderRadius: 8, padding: '8px 12px' }}>{importDone}</p>}

            {importStatement && (
              <div className="stmt-preview">
                <div className="stmt-preview-head">
                  <div className="stmt-issuer"><strong>Punjab Exotic Foods Ltd</strong><span>Customer Statement Import</span></div>
                  <div className="stmt-meta">
                    <span>StmtDate: <strong>{importStatement.statementDate || 'Needs review'}</strong></span>
                    <span>Acc No: <strong>{importStatement.customer.accountNumber || 'Needs review'}</strong></span>
                  </div>
                </div>
                <div className="stmt-customer-row">
                  <div className="stmt-customer-block">
                    <strong>{importStatement.customer.name || 'Customer needs review'}</strong>
                    {importStatement.customer.address.map(line => <span key={line}>{line}</span>)}
                    {importStatement.customer.postcode && <span>{importStatement.customer.postcode}</span>}
                  </div>
                  <span className="ps-badge" style={importStatement.reconciled ? { background: '#dcfce7', color: '#15803d' } : { background: '#fef2f2', color: '#b91c1c' }}>
                    {importStatement.reconciled ? 'Statement reconciled successfully' : 'Statement requires review'}
                  </span>
                </div>
                <div className="stmt-summary-grid">
                  <div><span>Outstanding Balance</span><strong>{fmtMoney(importStatement.totals.outstanding)}</strong></div>
                  <div><span>Total Invoiced</span><strong>{fmtMoney(importStatement.totals.invoiceTotal)}</strong></div>
                  <div><span>Total Paid</span><strong>{fmtMoney(importStatement.totals.paid)}</strong></div>
                  <div><span>Invoices</span><strong>{importStatement.invoiceCount}</strong></div>
                </div>
                <div className="stmt-ageing">
                  <strong>Outstanding Ageing</strong>
                  <span>Current <b>{fmtMoney(importStatement.ageing.current)}</b></span>
                  <span>7+ Days <b>{fmtMoney(importStatement.ageing.days7Plus)}</b></span>
                  <span>14+ Days <b>{fmtMoney(importStatement.ageing.days14Plus)}</b></span>
                  <span>21+ Days <b>{fmtMoney(importStatement.ageing.days21Plus)}</b></span>
                  <span>Older <b>{fmtMoney(importStatement.ageing.older)}</b></span>
                </div>
              </div>
            )}

            {importRows.length > 0 && (
              <>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: '#374151', margin: '10px 0 6px' }}>
                  Found {importRows.length} invoice{importRows.length !== 1 ? 's' : ''} — untick any that shouldn't be imported:
                </p>
                <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                  <table className="ps-table" style={{ width: '100%' }}>
                    <thead><tr><th></th><th>Inv Date</th><th>Inv No</th><th style={{ textAlign: 'right' }}>GoodsAmt</th><th style={{ textAlign: 'right' }}>Vat</th><th style={{ textAlign: 'right' }}>Inv Total</th><th>DatePaid</th><th style={{ textAlign: 'right' }}>Amt Paid</th><th style={{ textAlign: 'right' }}>Item O/S</th><th style={{ textAlign: 'right' }}>TotalO/S</th><th>Status</th></tr></thead>
                    <tbody>
                      {importRows.map(r => (
                        <tr key={r.invoiceNumber} title={r.raw}>
                          <td>
                            <input type="checkbox" checked={importChecked.has(r.invoiceNumber)}
                              onChange={() => setImportChecked(prev => {
                                const next = new Set(prev)
                                if (next.has(r.invoiceNumber)) next.delete(r.invoiceNumber); else next.add(r.invoiceNumber)
                                return next
                              })} />
                          </td>
                          <td>{r.date}</td>
                          <td><code className="ps-code">{r.invoiceNumber}</code></td>
                          <td style={{ textAlign: 'right' }}>{fmtMoney(r.goodsAmount ?? r.amount)}</td>
                          <td style={{ textAlign: 'right' }}>{fmtMoney(r.vatAmount)}</td>
                          <td style={{ textAlign: 'right' }}><strong>{fmtMoney(r.amount)}</strong></td>
                          <td>{r.datePaid || ''}</td>
                          <td style={{ textAlign: 'right' }}>{fmtMoney(r.amountPaid)}</td>
                          <td style={{ textAlign: 'right' }}>{fmtMoney(r.outstandingAmount ?? r.amount)}</td>
                          <td style={{ textAlign: 'right' }}>{fmtMoney(r.runningOutstandingBalance ?? r.outstandingAmount ?? r.amount)}</td>
                          <td>{r.status ?? 'Unpaid'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <span style={{ fontSize: 13.5 }}>
                    Selected outstanding:{' '}
                    <strong>{fmtMoney(importRows.filter(r => importChecked.has(r.invoiceNumber)).reduce((s, r) => s + (r.outstandingAmount ?? r.amount), 0))}</strong>
                  </span>
                  <Button onClick={confirmImport} disabled={importBusy || importChecked.size === 0}>
                    {importBusy ? 'Importing…' : `Import ${importChecked.size} Invoice${importChecked.size !== 1 ? 's' : ''}`}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <CustomerStatementModal
        open={Boolean(statementTarget)}
        onClose={() => setStatementTarget(null)}
        customer={statementTarget}
        invoices={invoices}
        payments={payments}
        creditNotes={creditNotes}
        allocations={creditNoteAllocations}
      />

      {onSendWhatsApp && (
        <SendWhatsAppModal
          open={Boolean(whatsappTarget)}
          onClose={() => setWhatsappTarget(null)}
          customer={whatsappTarget}
          templates={whatsappTemplates}
          busy={whatsappBusy}
          onSend={async (phone, message) => {
            if (!whatsappTarget) return
            setWhatsappBusy(true)
            try { await onSendWhatsApp(phone, message, whatsappTarget) } finally { setWhatsappBusy(false) }
          }}
          onSaveTemplate={onSaveWhatsAppTemplate}
        />
      )}
    </div>
  )
}


