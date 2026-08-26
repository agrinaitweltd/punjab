import { useMemo, useState } from "react"
import type { Customer } from "../../types"
import type { ImportedFinancialDocument, ImportedInvoiceItem } from "../../lib/invoiceImport"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { Spinner } from "../../components/ui/Spinner"
import { getFileById } from "../../lib/fileService"
import type { EmailImportRow, EmailImportStatus } from "../../lib/secureAdminApi"
import { retryEmailImport as retryEmailImportRequest, getReviewDocument, approveReviewedDocument, rejectReviewedDocument } from "../../lib/secureAdminApi"
import { showAppError, showSuccess } from "../../lib/appDialogs"

const STATUS_COLORS: Record<EmailImportStatus, { bg: string; color: string }> = {
  processing: { bg: "#e0e7ff", color: "#4338ca" },
  imported: { bg: "#dcfce7", color: "#15803d" },
  needs_review: { bg: "#fef9c3", color: "#a16207" },
  failed: { bg: "#fee2e2", color: "#b91c1c" },
  duplicate: { bg: "#f3f4f6", color: "#6b7280" },
  rejected: { bg: "#f3f4f6", color: "#991b1b" },
}
const STATUS_LABELS: Record<EmailImportStatus, string> = {
  processing: "Processing", imported: "Imported", needs_review: "Needs Review", failed: "Failed", duplicate: "Duplicate", rejected: "Rejected",
}

function emptyItem(): ImportedInvoiceItem {
  return { line: "", quantity: 0, product: "", variety: "", size: "", price: 0, goodsValue: 0, vatCode: "", vatRate: 0 }
}

const fmt = (value: string | null) => value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"

export function EmailImportsPage({ imports, customers, onRefresh, onOpenCustomer }: {
  imports: EmailImportRow[]
  customers: Customer[]
  onRefresh: () => Promise<void>
  /** Jumps to that customer's Open Invoices page (same destination as
      CustomersPage's own "Open Invoices" button) - covers both "Link to
      customer" and "Link to invoice" (the invoice is right there in that
      customer's Open/Paid list). */
  onOpenCustomer?: (customerId: string) => void
}) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"All" | EmailImportStatus>("All")
  const [preview, setPreview] = useState<{ name: string; dataUri: string } | 'loading' | 'missing' | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [pickerFor, setPickerFor] = useState<EmailImportRow | null>(null)
  const [pickedCustomerId, setPickedCustomerId] = useState("")

  // Review Invoice workflow state - the row being reviewed, the freshly
  // re-parsed reference document (never mutated - shown as "Parsed"), the
  // editable working copy the admin corrects, and the original source PDF
  // to show side-by-side.
  const [reviewFor, setReviewFor] = useState<EmailImportRow | null>(null)
  const [reviewParsed, setReviewParsed] = useState<ImportedFinancialDocument | null>(null)
  const [reviewDoc, setReviewDoc] = useState<ImportedFinancialDocument | null>(null)
  const [reviewPdf, setReviewPdf] = useState<string | null>(null)
  const [reviewCustomerId, setReviewCustomerId] = useState("")
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewSaving, setReviewSaving] = useState(false)
  const [reviewError, setReviewError] = useState("")
  const [rejectReason, setRejectReason] = useState("")
  const [showRejectBox, setShowRejectBox] = useState(false)

  const customerById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers])

  const openReview = async (row: EmailImportRow) => {
    setReviewFor(row); setReviewLoading(true); setReviewError(""); setShowRejectBox(false); setRejectReason("")
    try {
      const res = await getReviewDocument(row.id)
      setReviewParsed(res.document)
      setReviewDoc(structuredClone(res.document))
      setReviewPdf(res.sourcePdfDataUri)
      setReviewCustomerId(row.detected_customer_id ?? "")
    } catch (error) {
      showAppError(error, { feature: "Review Invoice", context: { attachment: row.attachment_filename } })
      setReviewFor(null)
    } finally {
      setReviewLoading(false)
    }
  }
  const closeReview = () => { setReviewFor(null); setReviewDoc(null); setReviewParsed(null); setReviewPdf(null) }

  const updateCustomerField = (field: keyof ImportedFinancialDocument["customer"], value: string) => {
    setReviewDoc(doc => doc && { ...doc, customer: { ...doc.customer, [field]: value } })
  }
  const updateDocField = (field: string, value: string | number) => {
    setReviewDoc(doc => {
      if (!doc) return doc
      if (doc.documentType === "credit_note") return { ...doc, creditNote: { ...doc.creditNote, [field]: value } }
      return { ...doc, invoice: { ...doc.invoice, [field]: value } }
    })
  }
  const updateItem = (index: number, field: keyof ImportedInvoiceItem, value: string | number) => {
    setReviewDoc(doc => {
      if (!doc) return doc
      const items = doc.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
      return { ...doc, items }
    })
  }
  const correctNegative = (index: number) => {
    setReviewDoc(doc => {
      if (!doc) return doc
      const items = doc.items.map((item, i) => i === index
        ? { ...item, quantity: Math.abs(item.quantity), price: Math.abs(item.price), goodsValue: Math.abs(item.goodsValue), suspiciousNegative: false }
        : item)
      return { ...doc, items }
    })
  }
  const addItem = () => setReviewDoc(doc => doc && { ...doc, items: [...doc.items, emptyItem()] })
  const removeItem = (index: number) => setReviewDoc(doc => doc && { ...doc, items: doc.items.filter((_, i) => i !== index) })

  const approve = async () => {
    if (!reviewFor || !reviewDoc) return
    setReviewSaving(true); setReviewError("")
    try {
      const result = await approveReviewedDocument(reviewFor.id, reviewDoc, reviewCustomerId || undefined)
      showSuccess(`${reviewFor.attachment_filename} approved and imported${result.changes.length ? ` with ${result.changes.length} correction(s) recorded` : ""}.`)
      closeReview()
      await onRefresh()
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Could not approve this document.")
    } finally {
      setReviewSaving(false)
    }
  }
  const reject = async () => {
    if (!reviewFor) return
    setReviewSaving(true); setReviewError("")
    try {
      await rejectReviewedDocument(reviewFor.id, rejectReason)
      showSuccess(`${reviewFor.attachment_filename} was rejected and kept for audit.`)
      closeReview()
      await onRefresh()
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Could not reject this document.")
    } finally {
      setReviewSaving(false)
    }
  }

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
            {(["All", "imported", "needs_review", "failed", "duplicate", "rejected", "processing"] as const).map(s => (
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
            <thead><tr><th>Received</th><th>Sender</th><th>Subject</th><th>Attachment</th><th>Customer</th><th>Account No.</th><th>Invoice No.</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map(row => {
                const customer = row.detected_customer_id ? customerById.get(row.detected_customer_id) : undefined
                return (
                <tr key={row.id} className="ps-row">
                  <td style={{ color: "#6b7280", whiteSpace: "nowrap" }}>{fmt(row.received_at)}</td>
                  <td>{row.sender || "—"}</td>
                  <td style={{ maxWidth: 220, color: "#6b7280" }}>{row.subject || "—"}</td>
                  <td>{row.attachment_filename}</td>
                  <td>
                    {customer && onOpenCustomer ? (
                      <button type="button" onClick={() => onOpenCustomer(customer.id)} style={{ background: "none", border: "none", padding: 0, color: "#1d4ed8", textDecoration: "underline", cursor: "pointer", font: "inherit" }}>
                        {row.detected_customer_name}
                      </button>
                    ) : (row.detected_customer_name || "—")}
                  </td>
                  <td>{customer?.customerNumber || "—"}</td>
                  <td>{row.detected_invoice_number || "—"}</td>
                  <td>
                    <span className="ps-badge" style={STATUS_COLORS[row.status]}>{STATUS_LABELS[row.status]}</span>
                    {row.status === 'imported' && (
                      <div style={{ marginTop: 4, fontSize: 11.5, color: "#6b7280" }}>{row.customer_created ? "New Customer Created" : "Added to Existing Customer"}</div>
                    )}
                    {row.error_message && row.status !== 'imported' && (
                      <div style={{ marginTop: 4, fontSize: 11.5, color: "#9ca3af", maxWidth: 220 }}>{row.error_message}</div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {row.file_id && <Button className="btn-sm" variant="secondary" onClick={() => viewFile(row.file_id)}>View PDF</Button>}
                      {customer && onOpenCustomer && <Button className="btn-sm" variant="secondary" onClick={() => onOpenCustomer(customer.id)}>Open Invoice</Button>}
                      {(row.status === "needs_review" || row.status === "failed") && (
                        <>
                          <Button className="btn-sm" onClick={() => openReview(row)}>Review</Button>
                          <Button className="btn-sm" variant="secondary" disabled={retryingId === row.id} onClick={() => row.detected_customer_id ? retry(row) : (setPickerFor(row), setPickedCustomerId(row.detected_customer_id ?? ''))}>
                            {retryingId === row.id ? "Retrying…" : "Retry"}
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                )
              })}
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

      <Modal open={Boolean(reviewFor)} title={reviewFor ? `Review Invoice — ${reviewFor.attachment_filename}` : "Review Invoice"} onClose={closeReview} wide>
        {reviewLoading && <div className="invoice-pdf-loading"><Spinner size={20} /> <span>Loading document…</span></div>}
        {!reviewLoading && reviewDoc && reviewParsed && (
          <div className="review-invoice-layout">
            <div className="review-invoice-pdf">
              {reviewPdf ? <embed src={reviewPdf} type="application/pdf" className="invoice-pdf-embed" /> : <p className="error-message">Original PDF not available.</p>}
            </div>
            <div className="review-invoice-form">
              {reviewParsed.warnings.length > 0 && (
                <div className="review-warnings">
                  <strong>Flagged during parsing:</strong>
                  <ul>{reviewParsed.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </div>
              )}

              <h4>Customer</h4>
              <div className="review-grid">
                <label className="form-control"><span>Company / Trading Name — Parsed: {reviewParsed.customer.companyName || "—"}</span>
                  <input value={reviewDoc.customer.companyName} onChange={e => updateCustomerField("companyName", e.target.value)} /></label>
                <label className="form-control"><span>Account Number — Parsed: {reviewParsed.customer.accountNumber || "—"}</span>
                  <input value={reviewDoc.customer.accountNumber} onChange={e => updateCustomerField("accountNumber", e.target.value)} /></label>
                <label className="form-control" style={{ gridColumn: "span 2" }}><span>Address — Parsed: {reviewParsed.customer.address || "—"}</span>
                  <input value={reviewDoc.customer.address} onChange={e => updateCustomerField("address", e.target.value)} /></label>
                <label className="form-control"><span>Postcode — Parsed: {reviewParsed.customer.postcode || "—"}</span>
                  <input value={reviewDoc.customer.postcode} onChange={e => updateCustomerField("postcode", e.target.value)} /></label>
                <label className="form-control"><span>Phone — Parsed: {reviewParsed.customer.phone || "—"}</span>
                  <input value={reviewDoc.customer.phone} onChange={e => updateCustomerField("phone", e.target.value)} /></label>
              </div>

              <label className="form-control" style={{ marginTop: 10 }}>
                <span>Or select an existing customer instead (skips matching/creation above)</span>
                <select value={reviewCustomerId} onChange={e => setReviewCustomerId(e.target.value)}>
                  <option value="">Match or create automatically from the fields above</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.companyName} ({c.customerNumber})</option>)}
                </select>
              </label>

              <h4>{reviewDoc.documentType === "credit_note" ? "Credit Note" : "Invoice"}</h4>
              <div className="review-grid">
                <label className="form-control"><span>{reviewDoc.documentType === "credit_note" ? "Credit Note No." : "Invoice No."} — Parsed: {(reviewParsed.documentType === "credit_note" ? reviewParsed.creditNote.creditNumber : reviewParsed.invoice.invoiceNumber) || "—"}</span>
                  <input value={reviewDoc.documentType === "credit_note" ? reviewDoc.creditNote.creditNumber : reviewDoc.invoice.invoiceNumber} onChange={e => updateDocField(reviewDoc.documentType === "credit_note" ? "creditNumber" : "invoiceNumber", e.target.value)} /></label>
                <label className="form-control"><span>Date — Parsed: {(reviewParsed.documentType === "credit_note" ? reviewParsed.creditNote.date : reviewParsed.invoice.date) || "—"}</span>
                  <input type="date" value={reviewDoc.documentType === "credit_note" ? reviewDoc.creditNote.date : reviewDoc.invoice.date} onChange={e => updateDocField("date", e.target.value)} /></label>
                <label className="form-control"><span>Total Goods — Parsed: £{(reviewParsed.documentType === "credit_note" ? reviewParsed.creditNote.totalGoods : reviewParsed.invoice.totalGoods).toFixed(2)}</span>
                  <input type="number" step="0.01" value={reviewDoc.documentType === "credit_note" ? reviewDoc.creditNote.totalGoods : reviewDoc.invoice.totalGoods} onChange={e => updateDocField("totalGoods", Number(e.target.value))} /></label>
                <label className="form-control"><span>VAT — Parsed: £{(reviewParsed.documentType === "credit_note" ? reviewParsed.creditNote.vat : reviewParsed.invoice.vat).toFixed(2)}</span>
                  <input type="number" step="0.01" value={reviewDoc.documentType === "credit_note" ? reviewDoc.creditNote.vat : reviewDoc.invoice.vat} onChange={e => updateDocField("vat", Number(e.target.value))} /></label>
                <label className="form-control"><span>Grand Total — Parsed: £{(reviewParsed.documentType === "credit_note" ? reviewParsed.creditNote.grandTotal : reviewParsed.invoice.grandTotal).toFixed(2)}</span>
                  <input type="number" step="0.01" value={reviewDoc.documentType === "credit_note" ? reviewDoc.creditNote.grandTotal : reviewDoc.invoice.grandTotal} onChange={e => updateDocField("grandTotal", Number(e.target.value))} /></label>
              </div>
              <p style={{ fontSize: 12, color: "#6b7a70", marginTop: 4 }}>
                Recalculated on save: Total Goods + VAT = £{((reviewDoc.documentType === "credit_note" ? reviewDoc.creditNote.totalGoods : reviewDoc.invoice.totalGoods) + (reviewDoc.documentType === "credit_note" ? reviewDoc.creditNote.vat : reviewDoc.invoice.vat)).toFixed(2)}
                {" vs Grand Total £"}{(reviewDoc.documentType === "credit_note" ? reviewDoc.creditNote.grandTotal : reviewDoc.invoice.grandTotal).toFixed(2)}
              </p>

              <h4>Product Lines</h4>
              <div className="review-items">
                {reviewDoc.items.map((item, index) => (
                  <div key={index} className={"review-item-row" + (item.suspiciousNegative ? " review-item-negative" : "")}>
                    <input placeholder="Line" value={item.line} onChange={e => updateItem(index, "line", e.target.value)} style={{ width: 44 }} />
                    <input placeholder="Qty" type="number" value={item.quantity} onChange={e => updateItem(index, "quantity", Number(e.target.value))} style={{ width: 56 }} />
                    <input placeholder="Product" value={item.product} onChange={e => updateItem(index, "product", e.target.value)} style={{ flex: 2 }} />
                    <input placeholder="Variety" value={item.variety} onChange={e => updateItem(index, "variety", e.target.value)} style={{ flex: 1 }} />
                    <input placeholder="Size" value={item.size} onChange={e => updateItem(index, "size", e.target.value)} style={{ width: 64 }} />
                    <input placeholder="Price" type="number" step="0.01" value={item.price} onChange={e => updateItem(index, "price", Number(e.target.value))} style={{ width: 72 }} />
                    <input placeholder="Goods" type="number" step="0.01" value={item.goodsValue} onChange={e => updateItem(index, "goodsValue", Number(e.target.value))} style={{ width: 72 }} />
                    <input placeholder="VAT" type="number" step="0.01" value={item.vatRate} onChange={e => updateItem(index, "vatRate", Number(e.target.value))} style={{ width: 52 }} />
                    <Button className="btn-sm" variant="secondary" onClick={() => removeItem(index)}>Remove</Button>
                    {item.suspiciousNegative && (
                      <span className="review-negative-warning">
                        Warning: negative value detected.
                        <button type="button" onClick={() => correctNegative(index)}>Suggested: use positive equivalent</button>
                      </span>
                    )}
                  </div>
                ))}
                <Button className="btn-sm" variant="secondary" onClick={addItem}>Add Product Line</Button>
              </div>

              {reviewError && <p className="error-message" style={{ marginTop: 10 }}>{reviewError}</p>}

              {!showRejectBox ? (
                <div className="actions-row" style={{ marginTop: 16 }}>
                  <Button disabled={reviewSaving} onClick={approve}>{reviewSaving ? "Saving…" : "Approve & Import"}</Button>
                  <Button variant="secondary" disabled={reviewSaving} onClick={() => setShowRejectBox(true)}>Reject Document</Button>
                  <Button variant="secondary" onClick={closeReview}>Keep for Review</Button>
                </div>
              ) : (
                <div style={{ marginTop: 16 }}>
                  <label className="form-control"><span>Reason for rejecting (optional)</span>
                    <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. not a Punjab Exotic Foods document" /></label>
                  <div className="actions-row" style={{ marginTop: 10 }}>
                    <Button disabled={reviewSaving} onClick={reject}>{reviewSaving ? "Rejecting…" : "Confirm Reject"}</Button>
                    <Button variant="secondary" onClick={() => setShowRejectBox(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
