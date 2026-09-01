import { useEffect, useState } from "react"
import type { Customer, Invoice } from "../types"
import { Modal } from "./ui/Modal"
import { Button } from "./ui/Button"
import { Input, TextArea } from "./ui/Input"
import { formatUkPhoneForDisplay, isValidPhone } from "../lib/whatsapp"
import { reminderStageLabel, reminderTemplateFor, type ReminderStage } from "../lib/reminderTemplates"

/** Manual reminder composer (items 17/20) - a professional, editable email
    composer reusing the existing send pipeline. It never sends anything
    itself: onSend does the actual work (email via the existing Resend
    pipeline, best-effort WhatsApp, and the notification/communication log
    writes), so this component stays a pure "compose and review" UI. */
export function SendReminderModal({
  open, onClose, invoice, customer, stage, attachmentName, busy, onSend,
}: {
  open: boolean
  onClose: () => void
  invoice: Invoice | null
  customer: Customer | null
  stage: ReminderStage
  /** Name of the system-generated invoice PDF that will be attached, for display only. */
  attachmentName?: string
  busy?: boolean
  onSend: (input: { subject: string; message: string; alsoWhatsApp: boolean }) => Promise<void>
}) {
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [alsoWhatsApp, setAlsoWhatsApp] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open && invoice && customer) {
      const template = reminderTemplateFor(stage, invoice, customer)
      setSubject(template.subject)
      setMessage(template.message)
      setAlsoWhatsApp(isValidPhone(customer.phone || ""))
      setError("")
    }
  }, [open, invoice, customer, stage])

  if (!invoice || !customer) return null

  const displayPhone = formatUkPhoneForDisplay(customer.phone || "")
  const hasPhone = isValidPhone(customer.phone || "")

  const submit = async () => {
    setError("")
    if (!customer.email) { setError("This customer has no email address on file."); return }
    if (!subject.trim()) { setError("Enter a subject."); return }
    if (!message.trim()) { setError("Write a message."); return }
    try {
      await onSend({ subject: subject.trim(), message: message.trim(), alsoWhatsApp: alsoWhatsApp && hasPhone })
      onClose()
    } catch { setError("Couldn't send this reminder — please try again.") }
  }

  return (
    <Modal open={open} title={`Send Reminder — ${reminderStageLabel(stage)}`} onClose={onClose}>
      <div className="form-grid">
        {stage === '21-plus' && (
          <div className="wide" style={{ background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px" }}>
            <p style={{ fontSize: 12.5, color: "#92400e", margin: 0 }}>
              No approved 21+ days overdue wording has been supplied yet — the message below is a placeholder.
              Please write or paste the correct letter wording before sending.
            </p>
          </div>
        )}
        <Input label="To (customer email)" value={customer.email || "No email on file"} disabled />
        <Input label="Phone" value={displayPhone || "No phone on file"} disabled />
        <div className="wide" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" id="alsoWhatsApp" checked={alsoWhatsApp} disabled={!hasPhone} onChange={e => setAlsoWhatsApp(e.target.checked)} />
          <label htmlFor="alsoWhatsApp" style={{ fontSize: 13, color: "#374151" }}>
            Also try WhatsApp{!hasPhone ? " (no valid phone number on file)" : ""}
          </label>
        </div>
        <div className="wide"><Input label="Subject" value={subject} onChange={e => setSubject(e.target.value)} /></div>
        <div className="wide"><TextArea label="Message" rows={9} value={message} onChange={e => setMessage(e.target.value)} /></div>
        <div className="wide" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 4px" }}>Attachment</p>
          <p style={{ fontSize: 13.5, color: "#14532d", margin: 0 }}>{attachmentName || `Punjab Exotic Foods invoice ${invoice.invoiceNumber} (system-generated PDF)`}</p>
        </div>
        {error && <p className="wide" style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{error}</p>}
        <div className="wide actions-row">
          <Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send Reminder"}</Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        </div>
      </div>
    </Modal>
  )
}
