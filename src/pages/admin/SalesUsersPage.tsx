import { useState } from "react"
import type { Salesman } from "../../types"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { Input } from "../../components/ui/Input"
import { confirmAction } from "../../lib/appDialogs"

const emptyForm = { number: "", username: "", name: "", code: "" }

export function SalesUsersPage({
  salesmen, onCreate, onUpdate, onDelete,
}: {
  salesmen: Salesman[]
  onCreate: (input: Omit<Salesman, "id">) => Promise<void>
  onUpdate: (id: string, input: Partial<Salesman>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<Salesman | null>(null)

  const submitAdd = async () => {
    setError("")
    if (!form.number.trim() || !form.username.trim() || !form.name.trim() || !form.code.trim()) {
      setError("Fill in every field."); return
    }
    setBusy(true)
    try {
      await onCreate({ number: form.number.trim(), username: form.username.trim().toLowerCase(), name: form.name.trim(), code: form.code.trim() })
      setForm(emptyForm); setShowAdd(false)
    } catch { setError("Couldn't add this sales user — please try again.") }
    setBusy(false)
  }

  const submitEdit = async () => {
    if (!editing) return
    setError("")
    if (!editing.number.trim() || !editing.username.trim() || !editing.name.trim() || !editing.code.trim()) {
      setError("Fill in every field."); return
    }
    setBusy(true)
    try {
      await onUpdate(editing.id, { number: editing.number.trim(), username: editing.username.trim().toLowerCase(), name: editing.name.trim(), code: editing.code.trim() })
      setEditing(null)
    } catch { setError("Couldn't save changes — please try again.") }
    setBusy(false)
  }

  const remove = async (s: Salesman) => {
    if (!await confirmAction(`Delete sales user ${s.name} (#${s.number})? This cannot be undone.`)) return
    setBusy(true)
    try { await onDelete(s.id) } finally { setBusy(false) }
  }

  return (
    <div className="stack">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Sales Users</h2>
          <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
            Login accounts for the Sales module — number, username and code. Link one or more to an admin from Admin Users so they can review that salesman's orders.
          </p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setError(""); setShowAdd(true) }}>+ Add Sales User</Button>
      </div>

      <div className="ps-table-card">
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr><th>Number</th><th>Username</th><th>Name</th><th>Code</th><th>Actions</th></tr></thead>
            <tbody>
              {[...salesmen].sort((a, b) => a.number.localeCompare(b.number)).map(s => (
                <tr key={s.id} className="ps-row">
                  <td><strong>{s.number}</strong></td>
                  <td>{s.username}</td>
                  <td>{s.name}</td>
                  <td><code className="ps-code">{s.code}</code></td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Button variant="secondary" className="btn-sm" onClick={() => setEditing(s)}>Edit</Button>
                      <Button variant="danger" className="btn-sm" onClick={() => remove(s)} disabled={busy}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {salesmen.length === 0 && (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
              No sales users yet — add one to let a salesperson log into the Sales module.
            </div>
          )}
        </div>
      </div>

      <Modal open={showAdd} title="Add Sales User" onClose={() => setShowAdd(false)}>
        <div className="form-grid">
          <Input label="Number" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} placeholder="e.g. 1" required autoFocus />
          <Input label="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="e.g. mohsen" required />
          <Input label="Full Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mohsen" required />
          <Input label="Code" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="e.g. 0908" required />
          {error && <p className="wide" style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{error}</p>}
          <div className="wide actions-row">
            <Button onClick={submitAdd} disabled={busy}>{busy ? "Adding…" : "Add Sales User"}</Button>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(editing)} title={editing ? `Edit ${editing.name}` : "Edit Sales User"} onClose={() => setEditing(null)}>
        {editing && (
          <div className="form-grid">
            <Input label="Number" value={editing.number} onChange={e => setEditing({ ...editing, number: e.target.value })} required />
            <Input label="Username" value={editing.username} onChange={e => setEditing({ ...editing, username: e.target.value })} required />
            <Input label="Full Name" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} required />
            <Input label="Code" value={editing.code} onChange={e => setEditing({ ...editing, code: e.target.value })} required />
            {error && <p className="wide" style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{error}</p>}
            <div className="wide actions-row">
              <Button onClick={submitEdit} disabled={busy}>{busy ? "Saving…" : "Save Changes"}</Button>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
