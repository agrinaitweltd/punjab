import { useMemo, useState } from "react"
import type { Customer, Invoice, NotificationLog } from "../../types"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { invoiceOutstanding } from "../../lib/creditNotes"

export function PaymentRemindersPage({
  invoices, customers, notificationLogs, canManage = true, onSendNow, onSchedule, onResend,
}: {
  invoices: Invoice[]
  customers: Customer[]
  notificationLogs: NotificationLog[]
  /** Gates Send/Schedule/Resend — history stays viewable to everyone who can reach this page. */
  canManage?: boolean
  onSendNow: (invoice: Invoice, customer: Customer) => Promise<void>
  onSchedule: (invoice: Invoice, customer: Customer, scheduledFor: string) => Promise<void>
  onResend: (log: NotificationLog) => Promise<void>
}) {
  const [query, setQuery] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [scheduleTarget, setScheduleTarget] = useState<Invoice | null>(null)
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleError, setScheduleError] = useState("")

  const customerName = (id: string) => customers.find(c => c.id === id)?.companyName ?? id

  const outstandingInvoices = useMemo(() => invoices.filter(i => i.status !== "Paid" && invoiceOutstanding(i) > 0), [invoices])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return outstandingInvoices.filter(i =>
      !q || `${i.invoiceNumber} ${customerName(i.customerId)}`.toLowerCase().includes(q)
    ).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outstandingInvoices, query, customers])

  const logsForInvoice = (invoiceId: string) => notificationLogs.filter(l => l.invoiceId === invoiceId)

  const sendNow = async (invoice: Invoice) => {
    const customer = customers.find(c => c.id === invoice.customerId)
    if (!customer) return
    setBusyId(invoice.id)
    try { await onSendNow(invoice, customer) } finally { setBusyId(null) }
  }

  const openSchedule = (invoice: Invoice) => {
    setScheduleTarget(invoice); setScheduleDate(""); setScheduleError("")
  }

  const submitSchedule = async () => {
    if (!scheduleTarget) return
    if (!scheduleDate) { setScheduleError("Pick a date and time."); return }
    const customer = customers.find(c => c.id === scheduleTarget.customerId)
    if (!customer) return
    setBusyId(scheduleTarget.id)
    try {
      await onSchedule(scheduleTarget, customer, scheduleDate)
      setScheduleTarget(null)
    } catch { setScheduleError("Couldn't schedule this reminder — please try again.") }
    setBusyId(null)
  }

  const resend = async (log: NotificationLog) => {
    setBusyId(log.id)
    try { await onResend(log) } finally { setBusyId(null) }
  }

  const sentCount = notificationLogs.filter(l => l.status === "Sent").length
  const scheduledCount = notificationLogs.filter(l => l.status === "Scheduled").length
  const failedCount = notificationLogs.filter(l => l.status === "Failed").length

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Payment Reminders</h2>
        <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
          Send or schedule payment reminders for outstanding invoices. WhatsApp is not yet connected — email is fully live.
        </p>
      </div>

      <div className="ps-stats-row">
        <div className="ps-stat"><p className="ps-stat-label">Outstanding Invoices</p><p className="ps-stat-value">{outstandingInvoices.length}</p></div>
        <div className="ps-stat"><p className="ps-stat-label">Reminders Sent</p><p className="ps-stat-value">{sentCount}</p></div>
        <div className="ps-stat"><p className="ps-stat-label">Scheduled</p><p className="ps-stat-value">{scheduledCount}</p></div>
        <div className="ps-stat"><p className="ps-stat-label">Failed</p><p className="ps-stat-value">{failedCount}</p></div>
      </div>

      <div className="ps-table-card">
        <div className="ps-toolbar">
          <div className="ps-toolbar-right">
            <div className="ps-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="ps-search" placeholder="Search invoice or customer…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr>
              <th>Customer</th><th>Invoice</th><th>Amount Outstanding</th><th>Due Date</th><th>Last Reminder</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(invoice => {
                const invLogs = logsForInvoice(invoice.id).sort((a, b) => (b.sentAt ?? b.scheduledFor ?? "").localeCompare(a.sentAt ?? a.scheduledFor ?? ""))
                const last = invLogs[0]
                return (
                  <tr key={invoice.id} className="ps-row">
                    <td><strong>{customerName(invoice.customerId)}</strong></td>
                    <td><code className="ps-code">{invoice.invoiceNumber}</code></td>
                    <td>£{invoiceOutstanding(invoice).toFixed(2)}</td>
                    <td style={{ color: "#6b7280" }}>{invoice.dueDate}</td>
                    <td>
                      {last ? (
                        <span className="ps-badge" style={
                          last.status === "Sent" ? { background: "#dcfce7", color: "#15803d" }
                          : last.status === "Failed" ? { background: "#fee2e2", color: "#b91c1c" }
                          : { background: "#fef9c3", color: "#a16207" }
                        }>{last.status} ({last.channel}) {last.sentAt ? last.sentAt.slice(0, 10) : last.scheduledFor?.slice(0, 10)}</span>
                      ) : "—"}
                    </td>
                    <td>
                      {canManage && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <Button className="btn-sm" onClick={() => sendNow(invoice)} disabled={busyId === invoice.id}>
                            {busyId === invoice.id ? "Sending…" : "Send Now"}
                          </Button>
                          <Button variant="secondary" className="btn-sm" onClick={() => openSchedule(invoice)}>Schedule</Button>
                          <Button variant="secondary" className="btn-sm" disabled title="WhatsApp isn't configured yet — connect a WhatsApp Business/Twilio account to enable">WhatsApp</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
              No outstanding invoices need a reminder right now.
            </div>
          )}
        </div>
      </div>

      <div className="ps-table-card">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #eaecf0", fontWeight: 700 }}>Send History</div>
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr><th>Customer</th><th>Invoice</th><th>Channel</th><th>Status</th><th>When</th><th>Actions</th></tr></thead>
            <tbody>
              {notificationLogs.slice(0, 100).map(log => {
                const invoice = invoices.find(i => i.id === log.invoiceId)
                return (
                  <tr key={log.id} className="ps-row">
                    <td>{customerName(log.customerId)}</td>
                    <td><code className="ps-code">{invoice?.invoiceNumber ?? log.invoiceId}</code></td>
                    <td style={{ textTransform: "capitalize" }}>{log.channel}</td>
                    <td>
                      <span className="ps-badge" style={
                        log.status === "Sent" ? { background: "#dcfce7", color: "#15803d" }
                        : log.status === "Failed" ? { background: "#fee2e2", color: "#b91c1c" }
                        : { background: "#fef9c3", color: "#a16207" }
                      }>{log.status}</span>
                      {log.error && <div style={{ fontSize: 11.5, color: "#b91c1c", marginTop: 2 }}>{log.error}</div>}
                    </td>
                    <td style={{ color: "#6b7280" }}>{(log.sentAt ?? log.scheduledFor ?? "").slice(0, 16).replace("T", " ")}</td>
                    <td>
                      {canManage && invoice && (
                        <Button className="btn-sm" variant="secondary" onClick={() => resend(log)} disabled={busyId === log.id}>
                          {busyId === log.id ? "Resending…" : "Resend"}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {notificationLogs.length === 0 && <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>No reminders sent yet.</div>}
        </div>
      </div>

      {/* Schedule modal */}
      <Modal open={Boolean(scheduleTarget)} title={scheduleTarget ? `Schedule Reminder — ${scheduleTarget.invoiceNumber}` : ""} onClose={() => setScheduleTarget(null)}>
        {scheduleTarget && (
          <div>
            <label className="form-control">
              <span>Send at</span>
              <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
            </label>
            <p style={{ fontSize: 12.5, color: "#6b7a70", margin: "8px 0 0" }}>
              This creates a scheduled entry visible in Send History. It's sent the next time an admin opens this page after the scheduled time, or can be sent immediately with "Send Now".
            </p>
            {scheduleError && <p style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", marginTop: 10 }}>{scheduleError}</p>}
            <div className="actions-row" style={{ marginTop: 16 }}>
              <Button onClick={submitSchedule} disabled={busyId === scheduleTarget.id}>{busyId === scheduleTarget.id ? "Scheduling…" : "Schedule Reminder"}</Button>
              <Button variant="secondary" onClick={() => setScheduleTarget(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
