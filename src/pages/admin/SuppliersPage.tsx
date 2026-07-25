import { useState } from "react"
import type { Supplier } from "../../types"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { Input } from "../../components/ui/Input"

export function SuppliersPage({
  suppliers, onCreate, onUpdate, onDelete, canManage = true,
}: {
  suppliers: Supplier[]
  onCreate: (input: Omit<Supplier, "id">) => Promise<void>
  onUpdate: (id: string, input: Partial<Supplier>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  canManage?: boolean
}) {
  const [query, setQuery] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: "", contact: "", country: "" })
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)

  const filtered = suppliers.filter(s =>
    !query.trim() || `${s.name} ${s.contact} ${s.country}`.toLowerCase().includes(query.trim().toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name))

  const submitAdd = async () => {
    setError("")
    if (!form.name.trim()) { setError("Enter a supplier name."); return }
    setBusy(true)
    try {
      await onCreate({ name: form.name.trim(), contact: form.contact.trim(), country: form.country.trim() })
      setForm({ name: "", contact: "", country: "" })
      setShowAdd(false)
    } catch { setError("Couldn't add this supplier — please try again.") }
    setBusy(false)
  }

  const submitEdit = async () => {
    if (!editing) return
    setError("")
    if (!editing.name.trim()) { setError("Enter a supplier name."); return }
    setBusy(true)
    try {
      await onUpdate(editing.id, { name: editing.name.trim(), contact: editing.contact.trim(), country: editing.country.trim() })
      setEditing(null)
    } catch { setError("Couldn't save changes — please try again.") }
    setBusy(false)
  }

  const remove = async (supplier: Supplier) => {
    if (!window.confirm(`Delete supplier ${supplier.name}? This cannot be undone.`)) return
    setBusy(true)
    try { await onDelete(supplier.id) } finally { setBusy(false) }
  }

  return (
    <div className="stack">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Suppliers</h2>
          <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
            Manage the suppliers used throughout the Produce Buying Desk.
          </p>
        </div>
        {canManage && <Button onClick={() => { setForm({ name: "", contact: "", country: "" }); setError(""); setShowAdd(true) }}>+ Add Supplier</Button>}
      </div>

      <div className="ps-table-card">
        <div className="ps-toolbar">
          <div className="ps-toolbar-right">
            <div className="ps-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="ps-search" placeholder="Search supplier, contact, country…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr><th>Supplier</th><th>Contact</th><th>Country</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="ps-row">
                  <td><strong>{s.name}</strong></td>
                  <td>{s.contact || "—"}</td>
                  <td>{s.country || "—"}</td>
                  <td>
                    {canManage && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <Button variant="secondary" className="btn-sm" onClick={() => setEditing(s)}>Edit</Button>
                        <Button variant="danger" className="btn-sm" onClick={() => remove(s)} disabled={busy}>Delete</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
              No suppliers yet — add one to start recording buying prices against them.
            </div>
          )}
        </div>
      </div>

      <Modal open={showAdd} title="Add Supplier" onClose={() => setShowAdd(false)}>
        <div className="form-grid">
          <div className="wide"><Input label="Supplier Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required autoFocus /></div>
          <Input label="Contact (phone or email)" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} />
          <Input label="Country" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
          {error && <p className="wide" style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{error}</p>}
          <div className="wide actions-row">
            <Button onClick={submitAdd} disabled={busy}>{busy ? "Adding…" : "Add Supplier"}</Button>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(editing)} title={editing ? `Edit ${editing.name}` : "Edit Supplier"} onClose={() => setEditing(null)}>
        {editing && (
          <div className="form-grid">
            <div className="wide"><Input label="Supplier Name" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} required /></div>
            <Input label="Contact (phone or email)" value={editing.contact} onChange={e => setEditing({ ...editing, contact: e.target.value })} />
            <Input label="Country" value={editing.country} onChange={e => setEditing({ ...editing, country: e.target.value })} />
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
