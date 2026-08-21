import { useEffect, useMemo, useState } from "react"
import type { CreditNote, CreditNoteAllocation, Customer, Invoice, SupportTicket } from "../../types"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { Input, Select, TextArea } from "../../components/ui/Input"
import { invoiceOutstanding } from "../../lib/creditNotes"
import { confirmAction, showNotice } from "../../lib/appDialogs"

type IssueMode = "invoice" | "account"

export function CreditNotesPage({
  creditNotes, allocations, customers, invoices, tickets, onIssue, onEdit, onVoid, onApply, canManage = true, openCreditNoteId,
}: {
  creditNotes: CreditNote[]
  allocations: CreditNoteAllocation[]
  customers: Customer[]
  invoices: Invoice[]
  tickets: SupportTicket[]
  onIssue: (input: { customerId: string; amount: number; reason: string; linkedTicketId?: string; linkedInvoiceId?: string }, mode: IssueMode) => Promise<void>
  onEdit: (id: string, input: { reason: string; amount: number }) => Promise<void>
  onVoid: (note: CreditNote) => Promise<void>
  onApply: (note: CreditNote, invoiceId: string, amount: number) => Promise<void>
  /** Gates Issue / Edit / Void / Apply — view + print stay available to
      everyone who can reach this page. */
  canManage?: boolean
  /** Set (e.g. from an invoice's "credited by CN-xxx" link) to auto-open that
      credit note's detail modal when this page mounts. */
  openCreditNoteId?: string | null
}) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Void">("All")
  const [showIssue, setShowIssue] = useState(false)
  const [issueMode, setIssueMode] = useState<IssueMode>("invoice")
  const [issueCustomerId, setIssueCustomerId] = useState("")
  const [issueInvoiceId, setIssueInvoiceId] = useState("")
  const [issueTicketId, setIssueTicketId] = useState("")
  const [issueAmount, setIssueAmount] = useState("")
  const [issueReason, setIssueReason] = useState("")
  const [issueError, setIssueError] = useState("")
  const [issueBusy, setIssueBusy] = useState(false)

  const [detail, setDetail] = useState<CreditNote | null>(null)
  const [editReason, setEditReason] = useState("")
  const [editAmount, setEditAmount] = useState("")
  const [editError, setEditError] = useState("")

  const [applyInvoiceId, setApplyInvoiceId] = useState("")
  const [applyAmount, setApplyAmount] = useState("")
  const [applyError, setApplyError] = useState("")
  const [busy, setBusy] = useState(false)

  const customerName = (id: string) => customers.find(c => c.id === id)?.companyName ?? id
  const invoiceNumber = (id?: string) => id ? (invoices.find(i => i.id === id)?.invoiceNumber ?? id) : ""

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return creditNotes.filter(c =>
      (statusFilter === "All" || c.status === statusFilter) &&
      (!q || `${c.creditNumber} ${customerName(c.customerId)} ${c.reason}`.toLowerCase().includes(q))
    ).sort((a, b) => b.date.localeCompare(a.date))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditNotes, query, statusFilter, customers])

  const totalActive = creditNotes.filter(c => c.status === "Active").reduce((s, c) => s + c.remainingBalance, 0)
  const totalIssued = creditNotes.reduce((s, c) => s + c.amount, 0)
  const voidCount = creditNotes.filter(c => c.status === "Void").length

  const resetIssueForm = () => {
    setIssueMode("invoice"); setIssueCustomerId(""); setIssueInvoiceId(""); setIssueTicketId("")
    setIssueAmount(""); setIssueReason(""); setIssueError("")
  }

  const customerInvoices = (customerId: string, unpaidOnly: boolean) =>
    invoices.filter(i => i.customerId === customerId && (!unpaidOnly || invoiceOutstanding(i) > 0))
  const customerTickets = (customerId: string) => tickets.filter(t => t.customerId === customerId)

  const submitIssue = async () => {
    setIssueError("")
    const amount = parseFloat(issueAmount)
    if (!issueCustomerId) { setIssueError("Select a customer."); return }
    if (!issueReason.trim()) { setIssueError("Enter a reason for this credit note."); return }
    if (!amount || amount <= 0) { setIssueError("Enter a valid amount."); return }
    if (issueMode === "invoice") {
      if (!issueInvoiceId) { setIssueError("Select the invoice to credit."); return }
      const invoice = invoices.find(i => i.id === issueInvoiceId)
      if (invoice && amount > invoiceOutstanding(invoice)) {
        setIssueError(`This invoice only has £${invoiceOutstanding(invoice).toFixed(2)} outstanding — reduce the amount or issue an account credit instead.`)
        return
      }
    } else if (issueMode === "account") {
      const invoice = invoices.find(i => i.id === issueInvoiceId)
      if (issueInvoiceId && invoiceOutstanding(invoice!) > 0) {
        setIssueError("Account credit is for invoices that are already fully paid. Use \"Issue against invoice\" instead.")
        return
      }
    }
    setIssueBusy(true)
    try {
      await onIssue({
        customerId: issueCustomerId, amount, reason: issueReason.trim(),
        linkedTicketId: issueTicketId || undefined,
        linkedInvoiceId: issueMode === "invoice" ? issueInvoiceId : undefined,
      }, issueMode)
      resetIssueForm(); setShowIssue(false)
    } catch {
      setIssueError("Couldn't issue the credit note — please try again.")
    }
    setIssueBusy(false)
  }

  const openDetail = (note: CreditNote) => {
    setDetail(note); setEditReason(note.reason); setEditAmount(String(note.amount))
    setEditError(""); setApplyError(""); setApplyInvoiceId(""); setApplyAmount(String(note.remainingBalance))
  }

  useEffect(() => {
    if (!openCreditNoteId) return
    const note = creditNotes.find(c => c.id === openCreditNoteId)
    if (note) openDetail(note)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCreditNoteId, creditNotes])

  const saveEdit = async () => {
    if (!detail) return
    setEditError("")
    const amount = parseFloat(editAmount)
    if (detail.remainingBalance !== detail.amount) { setEditError("This credit note has already been partly or fully applied — only unapplied credit notes can be edited."); return }
    if (!amount || amount <= 0) { setEditError("Enter a valid amount."); return }
    setBusy(true)
    try {
      await onEdit(detail.id, { reason: editReason.trim(), amount })
      setDetail(null)
    } catch {
      setEditError("Couldn't save changes.")
    }
    setBusy(false)
  }

  const voidNote = async (note: CreditNote) => {
    if (note.remainingBalance !== note.amount) {
      showNotice("This credit note has already been applied to an invoice and can't be voided. Contact support if it needs reversing.")
      return
    }
    if (!await confirmAction(`Void credit note ${note.creditNumber}? This cannot be undone.`)) return
    setBusy(true)
    try { await onVoid(note); setDetail(null) } finally { setBusy(false) }
  }

  const submitApply = async () => {
    if (!detail) return
    setApplyError("")
    const amount = parseFloat(applyAmount)
    if (!applyInvoiceId) { setApplyError("Select an invoice to apply this credit to."); return }
    if (!amount || amount <= 0) { setApplyError("Enter a valid amount."); return }
    if (amount > detail.remainingBalance) { setApplyError(`Only £${detail.remainingBalance.toFixed(2)} remains on this credit note.`); return }
    const invoice = invoices.find(i => i.id === applyInvoiceId)
    if (invoice && amount > invoiceOutstanding(invoice)) { setApplyError(`That invoice only has £${invoiceOutstanding(invoice).toFixed(2)} outstanding.`); return }
    setBusy(true)
    try {
      await onApply(detail, applyInvoiceId, amount)
      setDetail(null)
    } catch {
      setApplyError("Couldn't apply the credit — please try again.")
    }
    setBusy(false)
  }

  const printNote = (note: CreditNote) => {
    const w = window.open("", "_blank", "width=680,height=800")
    if (!w) return
    w.document.write(`
      <html><head><title>Credit Note ${note.creditNumber}</title>
      <style>body{font-family:Segoe UI,Arial,sans-serif;padding:40px;color:#111827}
      h1{font-size:20px;margin-bottom:4px}.muted{color:#6b7280;font-size:13px}
      table{width:100%;border-collapse:collapse;margin-top:24px;font-size:14px}
      td{padding:8px 0;border-bottom:1px solid #eee}.label{color:#6b7280;width:200px}
      .total{font-size:18px;font-weight:800;margin-top:20px}</style></head>
      <body>
        <h1>Punjab Exotic Foods — Credit Note</h1>
        <p class="muted">Gate 9, Stand 1B–1D, New Spitalfields Market, Sherrin Road, London E10 5SQ</p>
        <table>
          <tr><td class="label">Credit Note No.</td><td>${note.creditNumber}</td></tr>
          <tr><td class="label">Date</td><td>${note.date}</td></tr>
          <tr><td class="label">Customer</td><td>${customerName(note.customerId)}</td></tr>
          <tr><td class="label">Reason</td><td>${note.reason}</td></tr>
          ${note.linkedInvoiceId ? `<tr><td class="label">Applied to Invoice</td><td>${invoiceNumber(note.linkedInvoiceId)}</td></tr>` : ""}
          <tr><td class="label">Status</td><td>${note.status}</td></tr>
          <tr><td class="label">Remaining Balance</td><td>£${note.remainingBalance.toFixed(2)}</td></tr>
        </table>
        <p class="total">Amount: £${note.amount.toFixed(2)}</p>
        <script>window.print()</script>
      </body></html>
    `)
    w.document.close()
  }

  return (
    <div className="stack">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Credit Notes</h2>
          <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
            Issue credit against an order/ticket, or as account credit for future invoices.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => { resetIssueForm(); setShowIssue(true) }}>+ Issue Credit Note</Button>
        )}
      </div>

      <div className="ps-stats-row">
        <div className="ps-stat"><p className="ps-stat-label">Total Credit Notes</p><p className="ps-stat-value">{creditNotes.length}</p></div>
        <div className="ps-stat"><p className="ps-stat-label">Active Credit Available</p><p className="ps-stat-value">£{totalActive.toFixed(2)}</p></div>
        <div className="ps-stat"><p className="ps-stat-label">Total Issued</p><p className="ps-stat-value">£{totalIssued.toFixed(2)}</p></div>
        <div className="ps-stat"><p className="ps-stat-label">Voided</p><p className="ps-stat-value">{voidCount}</p></div>
      </div>

      <div className="ps-table-card">
        <div className="ps-toolbar">
          <div className="ps-toolbar-left">
            <label className="form-control" style={{ marginBottom: 0 }}>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}>
                <option value="All">All statuses</option>
                <option value="Active">Active</option>
                <option value="Void">Void</option>
              </select>
            </label>
          </div>
          <div className="ps-toolbar-right">
            <div className="ps-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="ps-search" placeholder="Search credit number, customer, reason…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr>
              <th>Credit No.</th><th>Customer</th><th>Amount</th><th>Remaining</th>
              <th>Linked</th><th>Status</th><th>Date</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(note => (
                <tr key={note.id} className="ps-row cd-row-clickable" onClick={() => openDetail(note)}>
                  <td><code className="ps-code">{note.creditNumber}</code></td>
                  <td>{customerName(note.customerId)}</td>
                  <td><strong>£{note.amount.toFixed(2)}</strong></td>
                  <td style={{ color: note.remainingBalance > 0 ? "#15803d" : "#9ca3af" }}>£{note.remainingBalance.toFixed(2)}</td>
                  <td style={{ color: "#6b7280" }}>{note.linkedInvoiceId ? invoiceNumber(note.linkedInvoiceId) : "Account credit"}</td>
                  <td>
                    <span className="ps-badge" style={note.status === "Void" ? { background: "#fee2e2", color: "#b91c1c" } : { background: "#dcfce7", color: "#15803d" }}>
                      {note.status}
                    </span>
                  </td>
                  <td style={{ color: "#6b7280" }}>{note.date}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Button variant="secondary" className="btn-sm" onClick={() => printNote(note)}>Print</Button>
                      {canManage && note.status === "Active" && (
                        <Button variant="danger" className="btn-sm" onClick={() => voidNote(note)}>Void</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
              <div style={{ fontWeight: 600, marginBottom: 4, color: "#374151" }}>No credit notes yet</div>
              Issue one against an invoice/ticket, or as standalone account credit.
            </div>
          )}
        </div>
      </div>

      {/* Issue modal */}
      <Modal open={showIssue} title="Issue Credit Note" onClose={() => setShowIssue(false)}>
        <div className="form-grid">
          <div className="wide" style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => setIssueMode("invoice")}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 10, cursor: "pointer", border: issueMode === "invoice" ? "2px solid #1f7a3a" : "1.5px solid #e5e7eb", background: issueMode === "invoice" ? "#f0fdf4" : "#fff", fontWeight: 700, fontSize: 13.5, color: issueMode === "invoice" ? "#14532d" : "#374151" }}>
              Against Invoice/Ticket
            </button>
            <button type="button" onClick={() => setIssueMode("account")}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 10, cursor: "pointer", border: issueMode === "account" ? "2px solid #1f7a3a" : "1.5px solid #e5e7eb", background: issueMode === "account" ? "#f0fdf4" : "#fff", fontWeight: 700, fontSize: 13.5, color: issueMode === "account" ? "#14532d" : "#374151" }}>
              Account Credit
            </button>
          </div>
          <p className="wide" style={{ fontSize: 12.5, color: "#6b7a70", margin: 0 }}>
            {issueMode === "invoice"
              ? "Reduces the selected invoice's balance immediately — e.g. damaged produce on a specific order."
              : "For invoices already fully paid — becomes available credit the customer can use against future invoices."}
          </p>

          <Select label="Customer" options={customers.map(c => c.companyName)}
            value={customers.find(c => c.id === issueCustomerId)?.companyName ?? ""}
            onChange={name => { setIssueCustomerId(customers.find(c => c.companyName === name)?.id ?? ""); setIssueInvoiceId(""); setIssueTicketId("") }} />

          {issueMode === "invoice" && (
            <label className="form-control">
              <span>Invoice</span>
              <select value={issueInvoiceId} onChange={e => setIssueInvoiceId(e.target.value)} disabled={!issueCustomerId}>
                <option value="">Select an invoice…</option>
                {customerInvoices(issueCustomerId, true).map(i => (
                  <option key={i.id} value={i.id}>{i.invoiceNumber} — £{invoiceOutstanding(i).toFixed(2)} outstanding</option>
                ))}
              </select>
            </label>
          )}

          <label className="form-control">
            <span>Linked Ticket (optional)</span>
            <select value={issueTicketId} onChange={e => setIssueTicketId(e.target.value)} disabled={!issueCustomerId}>
              <option value="">None</option>
              {customerTickets(issueCustomerId).map(t => <option key={t.id} value={t.id}>{t.subject}</option>)}
            </select>
          </label>

          <Input label="Credit Amount (£)" type="number" min="0.01" step="0.01" value={issueAmount} onChange={e => setIssueAmount(e.target.value)} />
          <div className="wide"><TextArea label="Reason" value={issueReason} onChange={e => setIssueReason(e.target.value)} rows={2} placeholder="e.g. Damaged produce" /></div>

          {issueError && <p className="wide" style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{issueError}</p>}
          <div className="wide actions-row">
            <Button onClick={submitIssue} disabled={issueBusy}>{issueBusy ? "Issuing…" : "Issue Credit Note"}</Button>
            <Button variant="secondary" onClick={() => setShowIssue(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Detail / edit / apply modal */}
      <Modal open={Boolean(detail)} title={detail ? `Credit Note ${detail.creditNumber}` : ""} onClose={() => setDetail(null)} wide>
        {detail && (
          <div>
            <div className="ord-review">
              <div className="ord-row"><span>Customer</span><strong>{customerName(detail.customerId)}</strong></div>
              <div className="ord-row"><span>Date</span><strong>{detail.date}</strong></div>
              <div className="ord-row"><span>Linked</span><strong>{detail.linkedInvoiceId ? invoiceNumber(detail.linkedInvoiceId) : "Account credit"}</strong></div>
              <div className="ord-row"><span>Status</span><strong>{detail.status}</strong></div>
              <div className="ord-row ord-total"><span>Remaining Balance</span><strong>£{detail.remainingBalance.toFixed(2)} / £{detail.amount.toFixed(2)}</strong></div>
            </div>

            <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", margin: "16px 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>Allocation History</p>
            <div className="ord-items">
              {allocations.filter(a => a.creditNoteId === detail.id).map(a => (
                <div key={a.id} className="ord-item-row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: "#111827" }}>Applied to {invoiceNumber(a.invoiceId)}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{a.date}</div>
                  </div>
                  <strong>£{a.amount.toFixed(2)}</strong>
                </div>
              ))}
              {allocations.filter(a => a.creditNoteId === detail.id).length === 0 && (
                <p style={{ fontSize: 13, color: "#9ca3af" }}>Not yet applied to any invoice.</p>
              )}
            </div>

            {canManage && detail.status === "Active" && (
              <>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", margin: "18px 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>Edit</p>
                <div className="form-grid">
                  <div className="wide"><TextArea label="Reason" value={editReason} onChange={e => setEditReason(e.target.value)} rows={2} /></div>
                  <Input label="Amount (£)" type="number" min="0.01" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                    disabled={detail.remainingBalance !== detail.amount} />
                  {editError && <p className="wide" style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{editError}</p>}
                  <div className="wide actions-row">
                    <Button className="btn-sm" onClick={saveEdit} disabled={busy}>Save Changes</Button>
                    <Button className="btn-sm" variant="danger" onClick={() => voidNote(detail)} disabled={busy}>Void</Button>
                  </div>
                </div>

                {detail.remainingBalance > 0 && (
                  <>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", margin: "18px 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>Apply Credit to Invoice</p>
                    <div className="form-grid">
                      <label className="form-control">
                        <span>Invoice</span>
                        <select value={applyInvoiceId} onChange={e => setApplyInvoiceId(e.target.value)}>
                          <option value="">Select an invoice…</option>
                          {customerInvoices(detail.customerId, true).map(i => (
                            <option key={i.id} value={i.id}>{i.invoiceNumber} — £{invoiceOutstanding(i).toFixed(2)} outstanding</option>
                          ))}
                        </select>
                      </label>
                      <Input label="Amount (£)" type="number" min="0.01" step="0.01" value={applyAmount} onChange={e => setApplyAmount(e.target.value)} />
                      {applyError && <p className="wide" style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{applyError}</p>}
                      <div className="wide actions-row">
                        <Button className="btn-sm" onClick={submitApply} disabled={busy}>{busy ? "Applying…" : "Apply Credit"}</Button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="actions-row" style={{ marginTop: 16 }}>
              <Button variant="secondary" onClick={() => printNote(detail)}>Print</Button>
              <Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
