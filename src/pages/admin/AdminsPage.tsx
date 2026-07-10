import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AdminStaff, PermissionSet } from '../../types'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { DataTable } from '../../components/ui/Table'

const basePermissions: PermissionSet = {
  customers: false,
  prices: false,
  stock: false,
  orders: false,
  enquiries: false,
  tickets: false,
  payments: false,
  complaints: false,
  extracts: false,
  stats: false,
  admins: false,
  products: false,
}

export function AdminsPage({
  admins,
  onCreate,
}: {
  admins: AdminStaff[]
  onCreate: (name: string, email: string, password: string, role: string, permissions: PermissionSet) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('Staff')
  const [permissions, setPermissions] = useState(basePermissions)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await onCreate(name, email, password, role, permissions)
    setName('')
    setEmail('')
    setPassword('')
    setRole('Staff')
    setPermissions(basePermissions)
  }

  return (
    <div className="stack">
      <Card title="Create Staff Account">
        <form className="form-grid" onSubmit={submit}>
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Input label="Role" value={role} onChange={(e) => setRole(e.target.value)} required />

          <div className="wide permission-grid">
            {Object.keys(permissions).map((key) => (
              <label key={key} className="checkbox">
                <input
                  type="checkbox"
                  checked={permissions[key as keyof PermissionSet]}
                  onChange={(event) =>
                    setPermissions({
                      ...permissions,
                      [key]: event.target.checked,
                    })
                  }
                />
                <span>{key[0].toUpperCase() + key.slice(1)}</span>
              </label>
            ))}
          </div>

          <div className="wide actions-row">
            <Button type="submit">Create Admin</Button>
          </div>
        </form>
      </Card>

      <Card title="Admin Accounts">
        <DataTable columns={['Name', 'Email', 'Role', 'Permissions']}>
          {admins.map((admin) => (
            <tr key={admin.id}>
              <td>{admin.name}</td>
              <td>{admin.email}</td>
              <td>{admin.role}</td>
              <td>{Object.entries(admin.permissions).filter((entry) => entry[1]).map((entry) => entry[0]).join(', ') || 'None'}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  )
}


