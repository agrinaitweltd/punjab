import { useMemo, useState } from "react"
import type { Customer, Invoice } from "../../types"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { getCreditStatus, type CreditStatus } from "../../lib/creditControl"

export function CreditControlPage({ customers, invoices, onSendReminder, onToggleBlock }: {
  customers: Customer[]
  invoices: Invoice[]
  onSendReminder: (status: CreditStatus) => Promise<void>
  onToggleBlock: (customer: Customer, blocked: boolean) => Promise<void>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<CreditStatus | null>(null)

  const statuses = useMemo(
    () => customers.map(c => getCreditStatus(c, invoices)).sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue) || b.minimumDue - a.minimumDue),
    [customers, invoices],
  )
  const overdue = statuses.filter(s => s.isOverdue)

  const remind = async (s: CreditStatus) => {
    setBusy(s.customer.id)
    try {
      await onSendReminder(s)
      setSent(prev => new Set(prev).add(s.customer.id))
    } finally {
      setBusy(null)
    }
  }

  const toggleBlock = async (s: CreditStatus) => {
    const next = !s.customer.blocked
    if (next && !window.confirm(`Block ${s.customer.companyName}? They won't be able to place orders until unblocked, and should be chased for payment.`)) return
    setBusy(s.customer.id)
    try { await onToggleBlock(s.customer, next) } finally { setBusy(null) }
  }

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Credit Control</h2>
        <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
          Customers with invoices past their credit days, or balances over their credit limit.
          Send payment reminders or block accounts until they pay.
        </p>
      </div>

      <div className="ps-stats-row">
        <div className="ps-stat">
          <p className="ps-stat-label">Overdue Customers</p>
          <p className="ps-stat-value" style={{ color: overdue.length ? "#b91c1c" : undefined }}>{overdue.length}</p>
        </div>
        <div className="ps-stat">
          <p className="ps-stat-label">Total Overdue Amount</p>
          <p className="ps-stat-value">£{overdue.reduce((s, o) => s + o.minimumDue, 0).toFixed(2)}</p>
        </div>
        <div className="ps-stat">
          <p className="ps-stat-label">Blocked Accounts</p>
          <p className="ps-stat-value">{customers.filter(c => c.blocked).length}</p>
        </div>
        <div className="ps-stat">
          <p className="ps-stat-label">Total Outstanding (all)</p>
          <p className="ps-stat-value">£{statuses.reduce((s, o) => s + o.outstanding, 0).toFixed(2)}</p>
        </div>
      </div>

      <div className="ps-table-card">
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr>
              <th>Customer</th>
              <th>Outstanding</th>
              <th>Credit Limit</th>
              <th>Overdue Invoices</th>
              <th>Minimum Due Now</th>
              <th>Status</th>
              <th>Actions</th>
            </tr></thead>
            <tbody>
              {statuses.filter(s => s.unpaidCount > 0 || s.customer.blocked).map(s => (
                <tr key={s.customer.id} className="ps-row cd-row-clickable" onClick={() => setDetail(s)}>
                  <td>
                    <div className="ps-product-cell">
                      <div className="ps-product-avatar" style={{ background: s.isOverdue ? "#fee2e2" : "#e8f8ec", color: s.isOverdue ? "#b91c1c" : "#1a5c2d" }}>
                        {s.customer.companyName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="ps-product-name">{s.customer.companyName}</div>
                        <div className="ps-product-variety">{s.customer.creditDays ?? 14} day terms</div>
                      </div>
                    </div>
                  </td>
                  <td><strong>£{s.outstanding.toFixed(2)}</strong></td>
                  <td style={{ color: "#6b7280" }}>{(s.customer.creditLimit ?? 0) > 0 ? `£${(s.customer.creditLimit ?? 0).toFixed(2)}` : "—"}</td>
                  <td style={{ color: s.overdueInvoices.length ? "#b91c1c" : "#6b7280" }}>
                    {s.overdueInvoices.length || "None"}
                  </td>
                  <td>{s.minimumDue > 0 ? <strong style={{ color: "#b91c1c" }}>£{s.minimumDue.toFixed(2)}</strong> : <span style={{ color: "#6b7280" }}>—</span>}</td>
                  <td>
                    {s.customer.blocked
                      ? <span className="ps-badge" style={{ background: "#111827", color: "#fff" }}>Blocked</span>
                      : s.isOverdue
                        ? <span className="ps-badge ps-badge-red">Overdue</span>
                        : <span className="ps-badge ps-badge-green">In Terms</span>}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {s.isOverdue && (
                        <Button className="btn-sm" disabled={busy === s.customer.id || !s.customer.email}
                          onClick={() => remind(s)}
                          title={s.customer.email ? `Email ${s.customer.email}` : "Customer has no email address"}>
                          {busy === s.customer.id ? "Sending…" : sent.has(s.customer.id) ? "Sent ✓ Send Again" : "Send Payment Email"}
                        </Button>
                      )}
                      <Button variant={s.customer.blocked ? "secondary" : "danger"} className="btn-sm"
                        disabled={busy === s.customer.id} onClick={() => toggleBlock(s)}>
                        {s.customer.blocked ? "Unblock" : "Block"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {statuses.every(s => s.unpaidCount === 0 && !s.customer.blocked) && (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
              <div style={{ fontWeight: 600, marginBottom: 4, color: "#374151" }}>Nothing outstanding</div>
              No customers currently owe anything. Unpaid invoices will appear here automatically.
            </div>
          )}
        </div>
      </div>

      <Modal open={Boolean(detail)} title={detail ? `${detail.customer.companyName} — Credit Detail` : ""} onClose={() => setDetail(null)}>
        {detail && (
          <div>
            <div className="ord-review">
              <div className="ord-row"><span>Outstanding balance</span><strong>£{detail.outstanding.toFixed(2)}</strong></div>
              <div className="ord-row"><span>Credit limit</span><strong>{(detail.customer.creditLimit ?? 0) > 0 ? `£${(detail.customer.creditLimit ?? 0).toFixed(2)}` : "No limit set"}</strong></div>
              <div className="ord-row"><span>Credit days</span><strong>{detail.customer.creditDays ?? 14} days</strong></div>
              {detail.overLimitBy > 0 && (
                <div className="ord-row"><span>Over limit by</span><strong style={{ color: "#b91c1c" }}>£{detail.overLimitBy.toFixed(2)}</strong></div>
              )}
              <div className="ord-row ord-total"><span>Minimum due now</span><strong style={{ color: detail.minimumDue > 0 ? "#b91c1c" : undefined }}>£{detail.minimumDue.toFixed(2)}</strong></div>
            </div>
            {detail.overdueInvoices.length > 0 && (
              <>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", margin: "16px 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Overdue invoices ({detail.overdueInvoices.length})
                </p>
                <div className="ord-items">
                  {detail.overdueInvoices.map(inv => (
                    <div key={inv.id} className="ord-item-row">
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: "#111827" }}>{inv.invoiceNumber}</div>
                        <div style={{ fontSize: 12, color: "#b91c1c" }}>{inv.daysOverdue} day{inv.daysOverdue !== 1 ? "s" : ""} overdue</div>
                      </div>
                      <strong>£{inv.amount.toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
