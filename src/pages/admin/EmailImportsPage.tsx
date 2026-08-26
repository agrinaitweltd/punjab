import { useMemo, useState } from "react"
import type { Customer } from "../../types"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { Spinner } from "../../components/ui/Spinner"
import { getFileById } from "../../lib/fileService"
import type { EmailImportRow, EmailImportStatus } from "../../lib/secureAdminApi"
import { retryEmailImport as retryEmailImportRequest } from "../../lib/secureAdminApi"
import { showAppError } from "../../lib/appDialogs"

const STATUS_COLORS: Record<EmailImportStatus, { bg: string; color: string }> = {
  processing: { bg: "#e0e7ff", color: "#4338ca" },
  imported: { bg: "#dcfce7", color: "#15803d" },
  needs_review: { bg: "#fef9c3", color: "#a16207" },
  failed: { bg: "#fee2e2", color: "#b91c1c" },
  duplicate: { bg: "#f3f4f6", color: "#6b7280" },
}
const STATUS_LABELS: Record<EmailImportStatus, string> = {
  processing: "Processing", imported: "Imported", needs_review: "Needs Review", failed: "Failed", duplicate: "Duplicate",
}

const fmt = (value: string | null) => value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"

export function EmailImportsPage({ imports, customers, onRefresh }: {
  imports: EmailImportRow[]
  customers: Customer[]
  onRefresh: () => Promise<void>
}) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"All" | EmailImportStatus>("All")
  const [preview, setPreview] = useState<{ name: string; dataUri: string } | 'loading' | 'missing' | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [pickerFor, setPickerFor] = useState<EmailImportRow | null>(null)
  const [pickedCustomerId, setPickedCustomerId] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return imports.filter(row =>
      (statusFilter === "All" || row.status === statusFilter) &&
      (!q || `${row.sender ?? ""} ${row.subject ?? ""} ${row.attachment_filename} ${row.detected_customer_name ?? ""} ${row.detected_invoice_number ?? ""}`.toLowerCase().includes(q))
    )
  }, [imports, query, statusFilter])

  const counts = useMemo(() => {
    const c: Partial<Record<EmailImportStatus, number>> = {}
    for (const row of imports) c[row.status] = (c[row.status] ?? 0) + 1
    return c
  }, [imports])

  const viewFile = async (fileId: string | null) => {
    if (!fileId) return
    setPreview('loading')
    const file = await getFileById(fileId)
    setPreview(file ? { name: file.name, dataUri: file.dataUri } : 'missing')
  }

  const retry = async (row: EmailImportRow, customerId?: string) => {
    setRetryingId(row.id)
    try {
      await retryEmailImportRequest(row.id, customerId)
      await onRefresh()
      setPickerFor(null)
    } catch (error) {
      showAppError(error, { feature: 'Retry Email Import', context: { attachment: row.attachment_filename } })
    } finally {
      setRetryingId(null)
    }
  }

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Email Imports</h2>
        <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
          PDF invoices and credit notes received at receivables@punjabexoticfoods.com, imported through the same pipeline as a manual upload.
        </p>
      </div>

      <div className="ps-stats-row">
        <div className="ps-stat"><p className="ps-stat-label">Imported</p><p className="ps-stat-value">{counts.imported ?? 0}</p></div>
        <div className="ps-stat"><p className="ps-stat-label">Needs Review</p><p className="ps-stat-value">{counts.needs_review ?? 0}</p></div>
        <div className="ps-stat"><p className="ps-stat-label">Failed</p><p className="ps-stat-value">{counts.failed ?? 0}</p></div>
        <div className="ps-stat"><p className="ps-stat-label">Duplicate</p><p className="ps-stat-value">{counts.duplicate ?? 0}</p></div>
      </div>

      <div className="ps-table-card">
        <div className="ps-toolbar">
          <div className="ps-toolbar-left">
            {(["All", "imported", "needs_review", "failed", "duplicate", "processing"] as const).map(s => (
              <button key={s} type="button" className={"ps-tool-btn" + (statusFilter === s ? " ps-tool-active" : "")} onClick={() => setStatusFilter(s)}>
                {s === "All" ? "All" : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="ps-toolbar-right">
            <div className="ps-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="ps-search" placeholder="Search sender, subject, filename, customer…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr><th>Received</th><th>Sender</th><th>Subject</th><th>Attachment</th><th>Customer</th><th>Invoice No.</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id} className="ps-row">
                  <td style={{ color: "#6b7280", whiteSpace: "nowrap" }}>{fmt(row.received_at)}</td>
                  <td>{row.sender || "—"}</td>
                  <td style={{ maxWidth: 220, color: "#6b7280" }}>{row.subject || "—"}</td>
                  <td>{row.attachment_filename}</td>
                  <td>{row.detected_customer_name || "—"}</td>
                  <td>{row.detected_invoice_number || "—"}</td>
                  <td>
                    <span className="ps-badge" style={STATUS_COLORS[row.status]}>{STATUS_LABELS[row.status]}</span>
                    {row.error_message && row.status !== 'imported' && (
                      <div style={{ marginTop: 4, fontSize: 11.5, color: "#9ca3af", maxWidth: 220 }}>{row.error_message}</div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {row.file_id && <Button className="btn-sm" variant="secondary" onClick={() => viewFile(row.file_id)}>View</Button>}
                      {(row.status === "needs_review" || row.status === "failed") && (
                        <Button className="btn-sm" disabled={retryingId === row.id} onClick={() => row.detected_customer_id ? retry(row) : (setPickerFor(row), setPickedCustomerId(row.detected_customer_id ?? ''))}>
                          {retryingId === row.id ? "Retrying…" : "Retry"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
              No email imports yet. Send or forward a PDF invoice to receivables@punjabexoticfoods.com.
            </div>
          )}
        </div>
      </div>

      <Modal open={preview !== null} title={typeof preview === 'object' && preview ? preview.name : 'Preview'} onClose={() => setPreview(null)} wide>
        <div className="invoice-pdf-modal">
          {preview === 'loading' && <div className="invoice-pdf-loading"><Spinner size={20} /> <span>Loading PDF…</span></div>}
          {preview === 'missing' && <p className="error-message">This PDF could not be found — it may have been removed.</p>}
          {typeof preview === 'object' && preview && <embed src={preview.dataUri} type="application/pdf" className="invoice-pdf-embed" />}
        </div>
      </Modal>

      <Modal open={Boolean(pickerFor)} title="Select the customer for this document" onClose={() => setPickerFor(null)}>
        <p style={{ fontSize: 13, color: "#6b7a70", marginBottom: 10 }}>
          {pickerFor?.error_message || "A matching customer account could not be found automatically."}
        </p>
        <label className="form-control">
          <span>Customer</span>
          <select value={pickedCustomerId} onChange={e => setPickedCustomerId(e.target.value)}>
            <option value="">Select a customer…</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.companyName} ({c.customerNumber})</option>)}
          </select>
        </label>
        <div className="actions-row" style={{ marginTop: 16 }}>
          <Button disabled={!pickedCustomerId || retryingId === pickerFor?.id} onClick={() => pickerFor && retry(pickerFor, pickedCustomerId)}>
            {retryingId === pickerFor?.id ? "Retrying…" : "Retry With This Customer"}
          </Button>
          <Button variant="secondary" onClick={() => setPickerFor(null)}>Cancel</Button>
        </div>
      </Modal>
    </div>
  )
}
