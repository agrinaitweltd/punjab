import { useMemo, useState } from "react"
import type { WhatsAppLog } from "../../types"
import { Button } from "../../components/ui/Button"

const STATUS_COLORS: Record<WhatsAppLog["status"], { bg: string; color: string }> = {
  Sent: { bg: "#dcfce7", color: "#15803d" },
  Failed: { bg: "#fee2e2", color: "#b91c1c" },
  Pending: { bg: "#fef9c3", color: "#a16207" },
}

export function WhatsAppLogsPage({ logs, onRetry }: {
  logs: WhatsAppLog[]
  onRetry: (log: WhatsAppLog) => Promise<void>
}) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"All" | WhatsAppLog["status"]>("All")
  const [retryingId, setRetryingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return logs.filter(l =>
      (statusFilter === "All" || l.status === statusFilter) &&
      (!q || `${l.customerName ?? ""} ${l.phone} ${l.message} ${l.type}`.toLowerCase().includes(q))
    )
  }, [logs, query, statusFilter])

  const retry = async (log: WhatsAppLog) => {
    setRetryingId(log.id)
    try { await onRetry(log) } finally { setRetryingId(null) }
  }

  const sentCount = logs.filter(l => l.status === "Sent").length
  const failedCount = logs.filter(l => l.status === "Failed").length

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>WhatsApp Logs</h2>
        <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
          Every WhatsApp message sent from the Punjab Exotic Foods Ltd account, via UltraMsg.
        </p>
      </div>

      <div className="ps-stats-row">
        <div className="ps-stat"><p className="ps-stat-label">Total Sent</p><p className="ps-stat-value">{sentCount}</p></div>
        <div className="ps-stat"><p className="ps-stat-label">Failed</p><p className="ps-stat-value">{failedCount}</p></div>
        <div className="ps-stat"><p className="ps-stat-label">Total Messages</p><p className="ps-stat-value">{logs.length}</p></div>
      </div>

      <div className="ps-table-card">
        <div className="ps-toolbar">
          <div className="ps-toolbar-left">
            {(["All", "Sent", "Failed", "Pending"] as const).map(s => (
              <button key={s} type="button" className={"ps-tool-btn" + (statusFilter === s ? " ps-tool-active" : "")} onClick={() => setStatusFilter(s)}>
                {s}
              </button>
            ))}
          </div>
          <div className="ps-toolbar-right">
            <div className="ps-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="ps-search" placeholder="Search customer, phone, message…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr><th>Customer</th><th>Phone</th><th>Message</th><th>Type</th><th>Status</th><th>Sent By</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} className="ps-row">
                  <td><strong>{l.customerName || "—"}</strong></td>
                  <td>{l.phone}</td>
                  <td style={{ maxWidth: 280, color: "#6b7280" }}>{l.message}</td>
                  <td>{l.type}</td>
                  <td>
                    <span className="ps-badge" style={STATUS_COLORS[l.status]}>{l.status}</span>
                  </td>
                  <td>{l.createdBy}</td>
                  <td style={{ color: "#6b7280" }}>{(l.sentAt ?? "").slice(0, 16).replace("T", " ") || "—"}</td>
                  <td>
                    {l.status === "Failed" && (
                      <Button className="btn-sm" disabled={retryingId === l.id} onClick={() => retry(l)}>
                        {retryingId === l.id ? "Retrying…" : "Retry"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
              No WhatsApp messages yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
