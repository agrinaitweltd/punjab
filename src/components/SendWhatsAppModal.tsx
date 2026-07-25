import { useEffect, useState } from "react"
import type { Customer, WhatsAppTemplate } from "../types"
import { Modal } from "./ui/Modal"
import { Button } from "./ui/Button"
import { Input, Select, TextArea } from "./ui/Input"
import { fillTemplate, isValidPhone } from "../lib/whatsapp"

export function SendWhatsAppModal({
  open, onClose, customer, defaultPhone, templates, busy, onSend, onSaveTemplate,
}: {
  open: boolean
  onClose: () => void
  /** Pre-fills phone + name placeholder when sending from a customer's page. */
  customer?: Customer | null
  /** Used instead of a customer when sending to an arbitrary number. */
  defaultPhone?: string
  templates: WhatsAppTemplate[]
  busy?: boolean
  onSend: (phone: string, message: string) => Promise<void>
  onSaveTemplate?: (name: string, message: string) => Promise<void>
}) {
  const [phone, setPhone] = useState("")
  const [message, setMessage] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [error, setError] = useState("")
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [templateName, setTemplateName] = useState("")

  useEffect(() => {
    if (open) {
      setPhone(customer?.phone || defaultPhone || "")
      setMessage("")
      setTemplateId("")
      setError("")
      setSaveAsTemplate(false)
      setTemplateName("")
    }
  }, [open, customer, defaultPhone])

  const applyTemplate = (id: string) => {
    setTemplateId(id)
    const tpl = templates.find(t => t.id === id)
    if (!tpl) return
    setMessage(fillTemplate(tpl.message, { name: customer?.contactPerson || customer?.companyName || "there" }))
  }

  const submit = async () => {
    setError("")
    if (!phone.trim()) { setError("Enter a phone number."); return }
    if (!isValidPhone(phone)) { setError("That doesn't look like a valid phone number."); return }
    if (!message.trim()) { setError("Write a message."); return }
    if (saveAsTemplate && !templateName.trim()) { setError("Name the template you'd like to save."); return }
    try {
      await onSend(phone.trim(), message.trim())
      if (saveAsTemplate && onSaveTemplate) await onSaveTemplate(templateName.trim(), message.trim())
      onClose()
    } catch { setError("Couldn't send that message — please try again.") }
  }

  return (
    <Modal open={open} title={customer ? `Send WhatsApp — ${customer.companyName}` : "Send WhatsApp"} onClose={onClose}>
      <div className="form-grid">
        <Input label="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 07123 456789" required disabled={Boolean(customer?.phone)} />
        {templates.length > 0 && (
          <Select label="Start from a template (optional)" options={["None", ...templates.map(t => t.name)]}
            value={templateId ? templates.find(t => t.id === templateId)?.name ?? "None" : "None"}
            onChange={v => { const t = templates.find(x => x.name === v); if (t) applyTemplate(t.id); else { setTemplateId(""); setMessage("") } }} />
        )}
        <div className="wide"><TextArea label="Message" rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your message…" /></div>
        {message.trim() && (
          <div className="wide" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 4px" }}>Preview</p>
            <p style={{ fontSize: 13.5, color: "#14532d", whiteSpace: "pre-wrap", margin: 0 }}>{message}</p>
          </div>
        )}
        {onSaveTemplate && (
          <div className="wide" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="saveAsTemplate" checked={saveAsTemplate} onChange={e => setSaveAsTemplate(e.target.checked)} />
            <label htmlFor="saveAsTemplate" style={{ fontSize: 13, color: "#374151" }}>Save this message as a reusable template</label>
          </div>
        )}
        {saveAsTemplate && (
          <div className="wide"><Input label="Template Name" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Christmas Closure Notice" /></div>
        )}
        {error && <p className="wide" style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{error}</p>}
        <div className="wide actions-row">
          <Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send WhatsApp"}</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  )
}
