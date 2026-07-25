import { useState } from "react"
import type { AdminStaff, AssignedTask } from "../../types"
import { Button } from "../../components/ui/Button"
import { Select, TextArea, Input } from "../../components/ui/Input"

export function AssignTaskPage({
  tasks, admins, currentAdminId, onAssign, onMarkDone,
}: {
  tasks: AssignedTask[]
  admins: AdminStaff[]
  currentAdminId: string
  onAssign: (assignedToId: string, title: string, description: string) => Promise<void>
  onMarkDone: (id: string) => Promise<void>
}) {
  const assignable = admins.filter(a => a.active !== false)
  const [assignedToId, setAssignedToId] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError("")
    if (!assignedToId) { setError("Choose who this task is for."); return }
    if (!title.trim()) { setError("Enter a short title for the task."); return }
    setBusy(true)
    try {
      await onAssign(assignedToId, title.trim(), description.trim())
      setTitle(""); setDescription(""); setAssignedToId("")
    } catch { setError("Couldn't assign this task — please try again.") }
    setBusy(false)
  }

  const byMe = tasks.filter(t => t.assignedByName)
  const toMe = tasks.filter(t => t.assignedToId === currentAdminId)

  const adminName = (id: string) => admins.find(a => a.id === id)?.name ?? "Unknown"

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Assign Task</h2>
        <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
          Tell an admin something they need to do — they get an email straight away and it shows up in their list below.
        </p>
      </div>

      <div className="ps-table-card" style={{ padding: 20 }}>
        <div className="form-grid">
          <Select label="Assign To" options={["Choose an admin…", ...assignable.map(a => a.name)]}
            value={assignedToId ? adminName(assignedToId) : "Choose an admin…"}
            onChange={v => { const a = assignable.find(x => x.name === v); setAssignedToId(a?.id ?? "") }} />
          <div className="wide"><Input label="Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Chase overdue invoice for VEGCO" required /></div>
          <div className="wide">
            <TextArea label="Details (optional)" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Anything they need to know…" />
          </div>
          {error && <p className="wide" style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{error}</p>}
          <div className="wide actions-row">
            <Button onClick={submit} disabled={busy}>{busy ? "Assigning…" : "Assign Task"}</Button>
          </div>
        </div>
      </div>

      <div className="ps-table-card">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #eaecf0", fontWeight: 700 }}>Assigned to Me ({toMe.filter(t => t.status === "Open").length} open)</div>
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr><th>Title</th><th>Details</th><th>From</th><th>Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {toMe.map(t => (
                <tr key={t.id} className="ps-row">
                  <td><strong>{t.title}</strong></td>
                  <td style={{ color: "#6b7280", maxWidth: 320 }}>{t.description || "—"}</td>
                  <td>{t.assignedByName}</td>
                  <td style={{ color: "#6b7280" }}>{t.createdAt.slice(0, 10)}</td>
                  <td>
                    <span className="ps-badge" style={t.status === "Done" ? { background: "#dcfce7", color: "#15803d" } : { background: "#fef9c3", color: "#a16207" }}>
                      {t.status}
                    </span>
                  </td>
                  <td>
                    {t.status === "Open" && <Button className="btn-sm" onClick={() => onMarkDone(t.id)}>Mark Done</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {toMe.length === 0 && <div style={{ padding: "32px 24px", textAlign: "center", color: "#9ca3af" }}>Nothing assigned to you.</div>}
        </div>
      </div>

      <div className="ps-table-card">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #eaecf0", fontWeight: 700 }}>All Assigned Tasks</div>
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr><th>Title</th><th>Assigned To</th><th>From</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {byMe.map(t => (
                <tr key={t.id} className="ps-row">
                  <td><strong>{t.title}</strong></td>
                  <td>{t.assignedToName}</td>
                  <td>{t.assignedByName}</td>
                  <td style={{ color: "#6b7280" }}>{t.createdAt.slice(0, 10)}</td>
                  <td>
                    <span className="ps-badge" style={t.status === "Done" ? { background: "#dcfce7", color: "#15803d" } : { background: "#fef9c3", color: "#a16207" }}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {byMe.length === 0 && <div style={{ padding: "32px 24px", textAlign: "center", color: "#9ca3af" }}>No tasks assigned yet.</div>}
        </div>
      </div>
    </div>
  )
}
