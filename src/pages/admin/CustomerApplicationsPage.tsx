import { useMemo, useState } from "react"
import type { CustomerApplication } from "../../types"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { TextArea } from "../../components/ui/Input"

export function CustomerApplicationsPage({
  applications, onApprove, onReject, onSaveNotes, canManage = true,
}: {
  applications: CustomerApplication[]
  onApprove: (application: CustomerApplication) => Promise<void>
  onReject: (application: CustomerApplication) => Promise<void>
  onSaveNotes: (id: string, notes: string) => Promise<void>
  /** Gates Approve/Reject/Notes — view stays available to everyone who can reach this page. */
  canManage?: boolean
}) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Approved" | "Rejected">("All")
  const [detail, setDetail] = useState<CustomerApplication | null>(null)
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return applications.filter(a =>
      (statusFilter === "All" || a.status === statusFilter) &&
      (!q || `${a.companyName} ${a.contactName} ${a.email}`.toLowerCase().includes(q))
    ).sort((a, b) => b.date.localeCompare(a.date))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applications, query, statusFilter])

  const pendingCount = applications.filter(a => a.status === "Pending").length
  const approvedCount = applications.filter(a => a.status === "Approved").length
  const rejectedCount = applications.filter(a => a.status === "Rejected").length

  const openDetail = (application: CustomerApplication) => {
    setDetail(application); setNotes(application.notes ?? ""); setError("")
  }

  const approve = async (application: CustomerApplication) => {
    setError(""); setBusy(true)
    try { await onApprove(application); setDetail(null) }
    catch { setError("Couldn't approve this application — please try again.") }
    setBusy(false)
  }

  const reject = async (application: CustomerApplication) => {
    setError(""); setBusy(true)
    try { await onReject(application); setDetail(null) }
    catch { setError("Couldn't reject this application — please try again.") }
    setBusy(false)
  }

  const saveNotes = async () => {
    if (!detail) return
    setError(""); setBusy(true)
    try { await onSaveNotes(detail.id, notes.trim()); setDetail(null) }
    catch { setError("Couldn't save notes — please try again.") }
    setBusy(false)
  }

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Customer Applications</h2>
        <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
          Review "Apply For An Account" submissions — approving creates the customer's login.
        </p>
      </div>

      <div className="ps-stats-row">
        <div className="ps-stat"><p className="ps-stat-label">Total Applications</p><p className="ps-stat-value">{applications.length}</p></div>
        <div className="ps-stat"><p className="ps-stat-label">Pending</p><p className="ps-stat-value">{pendingCount}</p></div>
        <div className="ps-stat"><p className="ps-stat-label">Approved</p><p className="ps-stat-value">{approvedCount}</p></div>
        <div className="ps-stat"><p className="ps-stat-label">Rejected</p><p className="ps-stat-value">{rejectedCount}</p></div>
      </div>

      <div className="ps-table-card">
        <div className="ps-toolbar">
          <div className="ps-toolbar-left">
            <label className="form-control" style={{ marginBottom: 0 }}>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}>
                <option value="All">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </label>
          </div>
          <div className="ps-toolbar-right">
            <div className="ps-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="ps-search" placeholder="Search company, contact, email…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr>
              <th>Company</th><th>Contact</th><th>Email</th><th>Phone</th><th>Status</th><th>Date</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(application => (
                <tr key={application.id} className="ps-row cd-row-clickable" onClick={() => openDetail(application)}>
                  <td><strong>{application.companyName}</strong></td>
                  <td>{application.contactName}</td>
                  <td style={{ color: "#6b7280" }}>{application.email}</td>
                  <td style={{ color: "#6b7280" }}>{application.phone || "—"}</td>
                  <td>
                    <span className="ps-badge" style={
                      application.status === "Approved" ? { background: "#dcfce7", color: "#15803d" }
                      : application.status === "Rejected" ? { background: "#fee2e2", color: "#b91c1c" }
                      : { background: "#fef9c3", color: "#a16207" }
                    }>{application.status}</span>
                  </td>
                  <td style={{ color: "#6b7280" }}>{application.date}</td>
                  <td onClick={e => e.stopPropagation()}>
                    {canManage && application.status === "Pending" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <Button className="btn-sm" onClick={() => approve(application)} disabled={busy}>Approve</Button>
                        <Button variant="danger" className="btn-sm" onClick={() => reject(application)} disabled={busy}>Reject</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
              <div style={{ fontWeight: 600, marginBottom: 4, color: "#374151" }}>No applications yet</div>
              Submissions from the public "Apply For An Account" form will appear here.
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      <Modal open={Boolean(detail)} title={detail ? detail.companyName : ""} onClose={() => setDetail(null)}>
        {detail && (
          <div>
            <div className="ord-review">
              <div className="ord-row"><span>Contact</span><strong>{detail.contactName}</strong></div>
              <div className="ord-row"><span>Email</span><strong>{detail.email}</strong></div>
              <div className="ord-row"><span>Phone</span><strong>{detail.phone || "—"}</strong></div>
              <div className="ord-row"><span>Registered Address</span><strong>{detail.registeredAddress || "—"}</strong></div>
              <div className="ord-row"><span>Date</span><strong>{detail.date}</strong></div>
              <div className="ord-row ord-total"><span>Status</span><strong>{detail.status}</strong></div>
            </div>

            {canManage && (
              <>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", margin: "16px 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>Notes</p>
                <TextArea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Internal notes about this application…" />
                {error && <p style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", margin: "10px 0 0" }}>{error}</p>}
                <div className="actions-row" style={{ marginTop: 14 }}>
                  <Button className="btn-sm" variant="secondary" onClick={saveNotes} disabled={busy}>Save Notes</Button>
                  {detail.status === "Pending" && (
                    <>
                      <Button className="btn-sm" onClick={() => approve(detail)} disabled={busy}>{busy ? "Approving…" : "Approve"}</Button>
                      <Button className="btn-sm" variant="danger" onClick={() => reject(detail)} disabled={busy}>Reject</Button>
                    </>
                  )}
                </div>
              </>
            )}

            <div className="actions-row" style={{ marginTop: 16 }}>
              <Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
