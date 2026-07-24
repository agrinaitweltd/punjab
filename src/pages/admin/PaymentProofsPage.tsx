import { useMemo, useState } from "react"
import type { PaymentProof } from "../../lib/paymentProofService"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"

export function PaymentProofsPage({ proofs, onApprove, onReject, canRecord = true }: {
  proofs: PaymentProof[]
  onApprove: (proof: PaymentProof) => Promise<void>
  onReject: (proof: PaymentProof, reason: string) => Promise<void>
  /** Gates Payment Received / Reject — view-only for roles without the
      paymentsRecord permission. */
  canRecord?: boolean
}) {
  const [preview, setPreview] = useState<PaymentProof | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...proofs].sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1) || b.uploadedAt.localeCompare(a.uploadedAt)),
    [proofs],
  )
  const pendingCount = proofs.filter(p => p.status === "pending").length

  const approve = async (proof: PaymentProof) => {
    setBusyId(proof.id)
    try { await onApprove(proof) } finally { setBusyId(null) }
  }
  const reject = async (proof: PaymentProof) => {
    const reason = window.prompt("Why is this being rejected? (this is included in the email to the customer, optional)") ?? ""
    setBusyId(proof.id)
    try { await onReject(proof, reason) } finally { setBusyId(null) }
  }

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Payment Proofs</h2>
        <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
          Bank transfer screenshots uploaded by customers. Check each against your bank statement, then approve or reject.
        </p>
      </div>

      <div className="ps-stats-row">
        <div className="ps-stat">
          <p className="ps-stat-label">Awaiting Review</p>
          <p className="ps-stat-value" style={{ color: pendingCount ? "#b91c1c" : undefined }}>{pendingCount}</p>
        </div>
        <div className="ps-stat">
          <p className="ps-stat-label">Total Submitted</p>
          <p className="ps-stat-value">{proofs.length}</p>
        </div>
      </div>

      <div className="ps-table-card">
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr>
              <th>Customer</th>
              <th>Invoice(s)</th>
              <th>Amount</th>
              <th>Uploaded</th>
              <th>Status</th>
              <th>Actions</th>
            </tr></thead>
            <tbody>
              {sorted.map(p => (
                <tr key={p.id} className="ps-row cd-row-clickable" onClick={() => setPreview(p)}>
                  <td>
                    <div className="ps-product-cell">
                      <div className="ps-product-avatar" style={{ background: "#e8f8ec", color: "#1a5c2d" }}>
                        {p.customerName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="ps-product-name">{p.customerName}</div>
                    </div>
                  </td>
                  <td style={{ color: "#6b7280" }}>{p.invoiceNumbers.join(", ")}</td>
                  <td><strong>£{p.amount.toFixed(2)}</strong></td>
                  <td style={{ color: "#6b7280" }}>{new Date(p.uploadedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  <td>
                    {p.status === "pending" && <span className="ps-badge ps-badge-yellow">Awaiting Review</span>}
                    {p.status === "approved" && <span className="ps-badge ps-badge-green">Approved</span>}
                    {p.status === "rejected" && <span className="ps-badge ps-badge-red">Rejected</span>}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    {p.status === "pending" && canRecord ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <Button className="btn-sm" disabled={busyId === p.id} onClick={() => approve(p)}>
                          {busyId === p.id ? "Working…" : "Payment Received"}
                        </Button>
                        <Button variant="danger" className="btn-sm" disabled={busyId === p.id} onClick={() => reject(p)}>Reject</Button>
                      </div>
                    ) : p.status === "pending" ? (
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>Awaiting review</span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>
                        {p.reviewedAt ? new Date(p.reviewedAt).toLocaleDateString("en-GB") : ""}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {proofs.length === 0 && (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
              <div style={{ fontWeight: 600, marginBottom: 4, color: "#374151" }}>No payment proofs yet</div>
              Screenshots customers upload after a bank transfer will appear here for review.
            </div>
          )}
        </div>
      </div>

      <Modal open={Boolean(preview)} title={preview ? `Payment Proof — ${preview.customerName}` : "Payment Proof"} onClose={() => setPreview(null)}>
        {preview && (
          <div>
            <div className="ord-review">
              <div className="ord-row"><span>Invoice(s)</span><strong>{preview.invoiceNumbers.join(", ")}</strong></div>
              <div className="ord-row ord-total"><span>Amount</span><strong>£{preview.amount.toFixed(2)}</strong></div>
            </div>
            {preview.note && <p style={{ fontSize: 13, color: "#374151", margin: "10px 0" }}><em>"{preview.note}"</em></p>}
            {preview.fileType.startsWith("image/") ? (
              <img src={preview.dataUri} alt="Payment proof" style={{ width: "100%", borderRadius: 10, marginTop: 10, border: "1px solid #e5e7eb" }} />
            ) : (
              <a className="btn btn-secondary" href={preview.dataUri} download={preview.fileName} style={{ marginTop: 10, display: "inline-block" }}>Download {preview.fileName}</a>
            )}
            {preview.status === "rejected" && preview.reviewNote && (
              <p style={{ marginTop: 12, fontSize: 13, color: "#b91c1c", background: "#fef2f2", borderRadius: 8, padding: "8px 12px" }}>Rejected: {preview.reviewNote}</p>
            )}
            {preview.status === "pending" && canRecord && (
              <div className="actions-row" style={{ marginTop: 16 }}>
                <Button disabled={busyId === preview.id} onClick={() => approve(preview)}>Payment Received</Button>
                <Button variant="danger" disabled={busyId === preview.id} onClick={() => reject(preview)}>Reject</Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
