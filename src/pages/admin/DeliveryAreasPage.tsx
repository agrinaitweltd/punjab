import { useState } from "react"
import type { FormEvent } from "react"
import type { DeliveryArea } from "../../types"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"

export function DeliveryAreasPage({
  deliveryAreas,
  onCreate,
  onUpdate,
  onDelete,
}: {
  deliveryAreas: DeliveryArea[]
  onCreate: (name: string, charge: number) => Promise<void>
  onUpdate: (id: string, name: string, charge: number) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<DeliveryArea | null>(null)
  const [name, setName] = useState("")
  const [charge, setCharge] = useState("")

  const resetForm = () => { setName(""); setCharge("") }

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault()
    await onCreate(name, Number(charge))
    resetForm(); setShowCreate(false)
  }

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing) return
    await onUpdate(editing.id, name, Number(charge))
    setEditing(null); resetForm()
  }

  const openEdit = (area: DeliveryArea) => {
    setEditing(area)
    setName(area.name)
    setCharge(String(area.chargePerPallet))
  }

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>Delivery Areas</h2>
        <p style={{ fontSize: 13.5, color: "#6b7280", marginTop: 3 }}>
          Manage delivery zones and per-pallet charges.
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Delivery Areas ({deliveryAreas.length})</h3>
          <Button onClick={() => { resetForm(); setShowCreate(true) }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Area
          </Button>
        </div>
        <div style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Area</th>
                  <th>Charge Per Pallet</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deliveryAreas.map(area => (
                  <tr key={area.id}>
                    <td style={{ fontWeight: 600, color: "#111827" }}>{area.name}</td>
                    <td>£{area.chargePerPallet.toFixed(2)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="ps-action-btn" title="Edit" onClick={() => openEdit(area)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="ps-action-btn ps-action-danger" title="Delete" onClick={() => onDelete(area.id)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create modal */}
      <Modal open={showCreate} title="Add Delivery Area" onClose={() => setShowCreate(false)}>
        <form className="form-grid" onSubmit={submitCreate}>
          <Input label="Area Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Birmingham" required />
          <Input label="Charge Per Pallet (£)" type="number" step="0.01" value={charge} onChange={e => setCharge(e.target.value)} required />
          <div className="wide actions-row">
            <Button type="submit">Add Area</Button>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={Boolean(editing)} title="Edit Delivery Area" onClose={() => setEditing(null)}>
        <form className="form-grid" onSubmit={submitEdit}>
          <Input label="Area Name" value={name} onChange={e => setName(e.target.value)} required />
          <Input label="Charge Per Pallet (£)" type="number" step="0.01" value={charge} onChange={e => setCharge(e.target.value)} required />
          <div className="wide actions-row">
            <Button type="submit">Save Changes</Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}