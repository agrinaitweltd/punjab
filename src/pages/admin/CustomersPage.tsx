import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Customer } from '../../types'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input, Select, TextArea } from '../../components/ui/Input'
import { DataTable } from '../../components/ui/Table'
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
  openingBalance: '0',
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
  const [form, setForm] = useState(initialForm)
  const [editing, setEditing] = useState<Customer | null>(null)

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
    await onCreate(form)
    setForm(initialForm)
  }

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    await onUpdate(editing.id, editing)
    setEditing(null)
  }

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0d2b1e' }}>Customers</h2>
        <p style={{ fontSize: 13.5, color: '#6b7a70', marginTop: 3 }}>
          Manage customer login accounts, delivery areas, payment types and balances.
        </p>
      </div>

      <Card title="Create Customer Login" actions={<Button variant="ghost" className="btn-sm" onClick={() => setForm(initialForm)}>Reset</Button>}>
        <form className="form-grid" onSubmit={submitCreate}>
          <Input label="Company Name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
          <Input label="Contact Person" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} required />
          <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          <Input label="Customer Number" value={form.customerNumber} onChange={(e) => setForm({ ...form, customerNumber: e.target.value })} required />
          <Input label="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <Input label="Delivery Area" value={form.deliveryArea} onChange={(e) => setForm({ ...form, deliveryArea: e.target.value })} />
          <Input label="Opening Balance (£)" type="number" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} />
          <Select label="Payment Type" options={['Payment Before Order', '14 Days', '30 Days']} value={form.paymentTerms} onChange={(value) => setForm({ ...form, paymentTerms: value })} />
          <div className="wide">
            <TextArea label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} required />
          </div>
          <div className="wide actions-row">
            <Button type="submit">Create Customer</Button>
          </div>
        </form>
      </Card>

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


