import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Customer } from '../../types'
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
  onCreate,
  onUpdate,
  onDelete,
}: {
  customers: Customer[]
  onCreate: (input: typeof initialForm) => Promise<void>
  onUpdate: (id: string, input: Partial<Customer>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [editing, setEditing] = useState<Customer | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

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
    await onUpdate(editing.id, editing)
    setEditing(null)
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
        <DataTable columns={['Company', 'Contact', 'Email', 'Number', 'Delivery Area', 'Payment Terms', 'Actions']}>
          {filtered.map((customer) => (
            <tr key={customer.id}>
              <td>{customer.companyName}</td>
              <td>{customer.contactPerson}</td>
              <td>{customer.email}</td>
              <td>{customer.customerNumber}</td>
              <td>{customer.deliveryArea}</td>
              <td>{customer.paymentTerms}</td>
              <td>
                <div className="table-actions" style={{ display: 'flex', gap: 6 }}>
                  <Button variant="secondary" className="btn-sm" onClick={() => setEditing(customer)}>Edit</Button>
                  <Button variant="ghost" className="btn-sm">Send Payment Prompt</Button>
                  <Button variant="danger" className="btn-sm" onClick={() => onDelete(customer.id)}>Delete</Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
        {filtered.length === 0 && <EmptyState title="No customers yet" description="Create your first customer login above." />}
      </Card>

      <Modal open={Boolean(editing)} title="Edit Customer" onClose={() => setEditing(null)}>
        {editing ? (
          <form className="form-grid" onSubmit={submitEdit}>
            <Input label="Company Name" value={editing.companyName} onChange={(e) => setEditing({ ...editing, companyName: e.target.value })} />
            <Input label="Contact Person" value={editing.contactPerson} onChange={(e) => setEditing({ ...editing, contactPerson: e.target.value })} />
            <Input label="Email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            <Input label="Phone" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            <Input label="Delivery Area" value={editing.deliveryArea} onChange={(e) => setEditing({ ...editing, deliveryArea: e.target.value })} />
            <Select label="Payment Terms" options={['Payment Before Order', '14 Days', '30 Days']} value={editing.paymentTerms} onChange={(value) => setEditing({ ...editing, paymentTerms: value })} />
            <div className="wide actions-row">
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  )
}


