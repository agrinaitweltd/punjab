import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Customer, DeliveryArea } from '../../types'
import { parseStatementPdf, type StatementRow } from '../../lib/statementImport'
import { importStatementInvoices } from '../../api/miscApi'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input, Select } from '../../components/ui/Input'
import { DataTable } from '../../components/ui/Table'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'

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

export function CustomersPage({
  customers,
  deliveryAreas,
  onCreate,
  onUpdate,
  onDelete,
}: {
  customers: Customer[]
  deliveryAreas: DeliveryArea[]
  onCreate: (input: typeof initialForm) => Promise<void>
  onUpdate: (id: string, input: Partial<Customer>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [editing, setEditing] = useState<Customer | null>(null)
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // One-time statement import
  const [importTarget, setImportTarget] = useState<Customer | null>(null)
  const [importRows, setImportRows] = useState<StatementRow[]>([])
  const [importChecked, setImportChecked] = useState<Set<string>>(new Set())
  const [importBusy, setImportBusy] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [importProgress, setImportProgress] = useState('')
  const [importDone, setImportDone] = useState('')

  const filtered = useMemo(
    () =>
      customers.filter((item) => {
        const source = `${item.companyName} ${item.contactPerson} ${item.email} ${item.customerNumber}`.toLowerCase()
        return source.includes(query.toLowerCase())
      }),
    [customers, query],
  )

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

  const confirmDelete = async (customer: Customer) => {
    if (!window.confirm(`Delete ${customer.companyName}? This removes their login and cannot be undone.`)) return
    setDeletingId(customer.id)
    try { await onDelete(customer.id) } finally { setDeletingId(null) }
  }

  const openImport = (customer: Customer) => {
    setImportTarget(customer); setImportRows([]); setImportChecked(new Set())
    setImportMsg(''); setImportDone('')
  }

  const handleStatementFile = async (file: File | undefined) => {
    if (!file) return
    setImportBusy(true); setImportMsg(''); setImportProgress('Reading statement…'); setImportRows([]); setImportDone('')
    try {
      const { rows, renderFailed } = await parseStatementPdf(file, msg => setImportProgress(msg))
      if (rows.length === 0 && renderFailed) {
        setImportMsg("This PDF's scan couldn't be read (some scanned/exported PDFs aren't compatible with the in-browser reader). Please upload the original photo or screenshot instead (JPG/PNG) — that reads reliably.")
      } else if (rows.length === 0) {
        setImportMsg("No invoice lines found — the file may have unclear text or an unusual layout. Check it and try again, or send it to support so we can improve the reader.")
      } else {
        setImportRows(rows)
        setImportChecked(new Set(rows.map(r => r.invoiceNumber)))
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
    const { created, failed } = await importStatementInvoices(importTarget.id, rows, importTarget.creditDays ?? 14)
    // Opening balance = total of everything just imported (plus any existing balance)
    const importedTotal = rows.filter(r => !failed.includes(r.invoiceNumber)).reduce((s, r) => s + r.amount, 0)
    await onUpdate(importTarget.id, { balance: (importTarget.balance ?? 0) + importedTotal })
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
        <Button onClick={() => { setNewEmail(''); setAddError(''); setShowAdd(true) }}>+ Add Customer</Button>
      </div>

      <Modal open={showAdd} title="Invite New Customer" onClose={() => setShowAdd(false)}>
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
                {customer.blocked ? (
                  <span className="ps-badge" style={{ background: '#111827', color: '#fff' }}>Blocked</span>
                ) : customer.status === 'inactive' ? (
                  <span className="ps-badge ps-badge-gray">Inactive</span>
                ) : (
                  <span className="ps-badge ps-badge-green">Active</span>
                )}
              </td>
              <td>
                <div className="table-actions" style={{ display: 'flex', gap: 6 }}>
                  <Button variant="secondary" className="btn-sm" onClick={() => { setEditError(''); setEditing(customer) }}>Edit</Button>
                  <Button variant="ghost" className="btn-sm" onClick={() => openImport(customer)}>Import Statement</Button>
                  <Button variant="danger" className="btn-sm" disabled={deletingId === customer.id} onClick={() => confirmDelete(customer)}>
                    {deletingId === customer.id ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
        {filtered.length === 0 && <EmptyState title="No customers yet" description="Create your first customer login above." />}
      </Card>

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
            <div className="wide"><Input label="Delivery Address" value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} placeholder="Street, city, postcode" /></div>

            <p className="wide" style={{ fontSize: 11.5, fontWeight: 700, color: '#6b7a70', textTransform: 'uppercase', letterSpacing: 0.5, margin: '10px 0 -6px' }}>
              Delivery &amp; Account
            </p>
            <Select label="Delivery Area" options={deliveryAreas.length ? deliveryAreas.map(a => a.name) : [editing.deliveryArea || 'Unassigned']}
              value={editing.deliveryArea} onChange={(value) => setEditing({ ...editing, deliveryArea: value })} />
            <Select label="Account Status" options={['active', 'inactive']} value={editing.status}
              onChange={(value) => setEditing({ ...editing, status: value as Customer['status'] })} />

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
              One-time migration from your old system: upload this customer's statement PDF. Every line with a date,
              invoice number and amount becomes an unpaid invoice on their account, and their opening balance is set to the total.
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

            {importRows.length > 0 && (
              <>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: '#374151', margin: '10px 0 6px' }}>
                  Found {importRows.length} invoice{importRows.length !== 1 ? 's' : ''} — untick any that shouldn't be imported:
                </p>
                <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                  <table className="ps-table" style={{ width: '100%' }}>
                    <thead><tr><th></th><th>Date</th><th>Invoice No.</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
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
                          <td style={{ textAlign: 'right' }}><strong>£{r.amount.toFixed(2)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <span style={{ fontSize: 13.5 }}>
                    Selected total:{' '}
                    <strong>£{importRows.filter(r => importChecked.has(r.invoiceNumber)).reduce((s, r) => s + r.amount, 0).toFixed(2)}</strong>
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
    </div>
  )
}


