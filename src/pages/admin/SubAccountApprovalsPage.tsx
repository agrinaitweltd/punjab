import { useState } from "react"
import type { CustomerSubAccount } from "../../types"
import { Button } from "../../components/ui/Button"

const PERM_LABELS: Record<keyof CustomerSubAccount["permissions"], string> = {
  placeOrders: "Place Orders",
  viewOrders: "View Orders",
  viewInvoicesBalance: "View Invoices & Balance",
  raiseTickets: "Raise Support Tickets",
  viewDocuments: "View Documents",
}

export function SubAccountApprovalsPage({
  subAccounts, onDecide,
}: {
  subAccounts: CustomerSubAccount[]
  onDecide: (account: CustomerSubAccount, status: "Approved" | "Rejected") => Promise<void>
}) {
  const [busyId, setBusyId] = useState<string | null>(null)

  const decide = async (account: CustomerSubAccount, status: "Approved" | "Rejected") => {
    setBusyId(account.id)
    try { await onDecide(account, status) } finally { setBusyId(null) }
  }

  const pending = subAccounts.filter(a => a.status === "Pending")
  const decided = subAccounts.filter(a => a.status !== "Pending")

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Sub-Account Approvals</h2>
        <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
          Employee logins customers have invited onto their own account — approve or reject before they can sign in.
        </p>
      </div>

      <div className="ps-table-card">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #eaecf0", fontWeight: 700 }}>Pending ({pending.length})</div>
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr><th>Name</th><th>Email</th><th>Customer</th><th>Permissions</th><th>Requested</th><th>Actions</th></tr></thead>
            <tbody>
              {pending.map(a => (
                <tr key={a.id} className="ps-row">
                  <td><strong>{a.name}</strong></td>
                  <td>{a.email}</td>
                  <td>{a.customerName}</td>
                  <td style={{ fontSize: 12.5, color: "#6b7280" }}>
                    {(Object.keys(a.permissions) as (keyof CustomerSubAccount["permissions"])[])
                      .filter(k => a.permissions[k]).map(k => PERM_LABELS[k]).join(", ") || "—"}
                  </td>
                  <td style={{ color: "#6b7280" }}>{a.createdAt.slice(0, 10)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Button className="btn-sm" disabled={busyId === a.id} onClick={() => decide(a, "Approved")}>Approve</Button>
                      <Button variant="danger" className="btn-sm" disabled={busyId === a.id} onClick={() => decide(a, "Rejected")}>Reject</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pending.length === 0 && <div style={{ padding: "32px 24px", textAlign: "center", color: "#9ca3af" }}>No pending requests.</div>}
        </div>
      </div>

      <div className="ps-table-card">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #eaecf0", fontWeight: 700 }}>Decided</div>
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr><th>Name</th><th>Email</th><th>Customer</th><th>Status</th></tr></thead>
            <tbody>
              {decided.map(a => (
                <tr key={a.id} className="ps-row">
                  <td>{a.name}</td>
                  <td>{a.email}</td>
                  <td>{a.customerName}</td>
                  <td>
                    <span className="ps-badge" style={a.status === "Approved" ? { background: "#dcfce7", color: "#15803d" } : { background: "#fee2e2", color: "#b91c1c" }}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {decided.length === 0 && <div style={{ padding: "32px 24px", textAlign: "center", color: "#9ca3af" }}>Nothing decided yet.</div>}
        </div>
      </div>
    </div>
  )
}
