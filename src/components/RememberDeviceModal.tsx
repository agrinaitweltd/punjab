import { useState } from "react"
import { Modal } from "./ui/Modal"
import { Button } from "./ui/Button"
import { saveDeviceAccount } from "../lib/deviceAuth"

export function RememberDeviceModal({ open, account, onDone }: {
  open: boolean
  account: { role: "admin" | "customer"; displayName: string; usernameOrEmail: string; password: string } | null
  onDone: () => void
}) {
  const [pin, setPin] = useState("")
  const [pin2, setPin2] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setErr("")
    if (!/^\d{6}$/.test(pin)) { setErr("PIN must be exactly 6 digits."); return }
    if (pin !== pin2) { setErr("PINs don't match."); return }
    if (!account) return
    setBusy(true)
    await saveDeviceAccount(pin, account)
    setBusy(false)
    onDone()
  }

  return (
    <Modal open={open} title="Make this your main device?" onClose={onDone}>
      <div className="inv-hero">
        <span className="inv-ico">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
        </span>
        <p>Set a 6-digit PIN so you can unlock the portal quickly next time on this device — no need to retype your password. You can switch accounts any time from the unlock screen.</p>
      </div>
      <label className="form-control">
        <span>Choose a 6-digit PIN</span>
        <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••••" autoFocus />
      </label>
      <label className="form-control" style={{ marginTop: 12 }}>
        <span>Confirm PIN</span>
        <input type="password" inputMode="numeric" maxLength={6} value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, ""))} placeholder="••••••" />
      </label>
      {err && <p style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", marginTop: 12 }}>{err}</p>}
      <div className="actions-row" style={{ marginTop: 16 }}>
        <Button onClick={confirm} disabled={busy}>{busy ? "Saving…" : "Set up quick unlock"}</Button>
        <Button variant="secondary" onClick={onDone}>Not now</Button>
      </div>
    </Modal>
  )
}
