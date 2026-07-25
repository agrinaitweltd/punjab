import { useState } from "react"
import type { WhatsAppLog, WhatsAppTemplate } from "../../types"
import { Button } from "../../components/ui/Button"
import { TextArea } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { SendWhatsAppModal } from "../../components/SendWhatsAppModal"

export function WhatsAppSendPage({
  logs, templates, onSend, onSaveTemplate, onUpdateTemplate,
}: {
  logs: WhatsAppLog[]
  templates: WhatsAppTemplate[]
  onSend: (phone: string, message: string) => Promise<void>
  onSaveTemplate: (name: string, message: string) => Promise<void>
  onUpdateTemplate?: (id: string, message: string) => Promise<void>
}) {
  const [showSend, setShowSend] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null)
  const [draftMessage, setDraftMessage] = useState("")
  const [savingTemplate, setSavingTemplate] = useState(false)
  const customSends = logs.filter(l => l.type === "Custom")

  const send = async (phone: string, message: string) => {
    setBusy(true)
    try { await onSend(phone, message) } finally { setBusy(false) }
  }

  const startEdit = (t: WhatsAppTemplate) => { setEditingTemplate(t); setDraftMessage(t.message) }
  const saveEdit = async () => {
    if (!editingTemplate || !onUpdateTemplate) return
    setSavingTemplate(true)
    try { await onUpdateTemplate(editingTemplate.id, draftMessage); setEditingTemplate(null) } finally { setSavingTemplate(false) }
  }

  return (
    <div className="stack">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Send WhatsApp</h2>
          <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
            Message any phone number directly from the Punjab Exotic Foods Ltd WhatsApp account.
          </p>
        </div>
        <Button onClick={() => setShowSend(true)}>+ New Message</Button>
      </div>

      <div className="ps-table-card">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #eaecf0", fontWeight: 700 }}>Message Templates</div>
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr><th>Name</th><th>Message</th><th></th></tr></thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id} className="ps-row">
                  <td><strong>{t.name}</strong></td>
                  <td style={{ maxWidth: 420, color: "#6b7280" }}>{t.message}</td>
                  <td>{onUpdateTemplate && <Button variant="secondary" className="btn-sm" onClick={() => startEdit(t)}>Edit</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {templates.length === 0 && <div style={{ padding: "24px", textAlign: "center", color: "#9ca3af" }}>No templates yet.</div>}
        </div>
      </div>

      <div className="ps-table-card">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #eaecf0", fontWeight: 700 }}>Recent Custom Messages</div>
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr><th>Phone</th><th>Message</th><th>Status</th><th>Sent By</th><th>Date</th></tr></thead>
            <tbody>
              {customSends.map(l => (
                <tr key={l.id} className="ps-row">
                  <td>{l.phone}</td>
                  <td style={{ maxWidth: 320, color: "#6b7280" }}>{l.message}</td>
                  <td>
                    <span className="ps-badge" style={l.status === "Sent" ? { background: "#dcfce7", color: "#15803d" } : { background: "#fee2e2", color: "#b91c1c" }}>{l.status}</span>
                  </td>
                  <td>{l.createdBy}</td>
                  <td style={{ color: "#6b7280" }}>{(l.sentAt ?? "").slice(0, 16).replace("T", " ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {customSends.length === 0 && <div style={{ padding: "32px 24px", textAlign: "center", color: "#9ca3af" }}>No custom messages sent yet.</div>}
        </div>
      </div>

      <SendWhatsAppModal open={showSend} onClose={() => setShowSend(false)} templates={templates} busy={busy} onSend={send} onSaveTemplate={onSaveTemplate} />

      <Modal open={Boolean(editingTemplate)} title={editingTemplate ? `Edit ${editingTemplate.name}` : "Edit Template"} onClose={() => setEditingTemplate(null)}>
        {editingTemplate && (
          <div className="form-grid">
            <div className="wide"><TextArea label="Message" rows={4} value={draftMessage} onChange={e => setDraftMessage(e.target.value)} /></div>
            <div className="wide actions-row">
              <Button onClick={saveEdit} disabled={savingTemplate}>{savingTemplate ? "Saving…" : "Save Template"}</Button>
              <Button variant="secondary" onClick={() => setEditingTemplate(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
