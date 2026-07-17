import { useRef, useState } from "react"
import type { DeviceAccount } from "../lib/deviceAuth"
import { unlockDeviceAccount, forgetDeviceAccount } from "../lib/deviceAuth"

export function QuickUnlock({ account, onUnlocked, onSwitchAccount }: {
  account: DeviceAccount
  onUnlocked: (usernameOrEmail: string, password: string, role: "admin" | "customer") => Promise<void>
  onSwitchAccount: () => void
}) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""])
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const boxRefs = useRef<(HTMLInputElement | null)[]>([])

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "")
    const next = [...digits]
    if (clean.length > 1) {
      clean.slice(0, 6).split("").forEach((ch, j) => { if (i + j < 6) next[i + j] = ch })
      setDigits(next)
      boxRefs.current[Math.min(5, i + clean.length)]?.focus()
      return
    }
    next[i] = clean
    setDigits(next)
    if (clean && i < 5) boxRefs.current[i + 1]?.focus()
  }

  const submit = async () => {
    setErr(""); setBusy(true)
    const pin = digits.join("")
    const password = await unlockDeviceAccount(pin)
    if (!password) {
      setErr("Incorrect PIN — please try again.")
      setDigits(["", "", "", "", "", ""])
      boxRefs.current[0]?.focus()
      setBusy(false)
      return
    }
    await onUnlocked(account.usernameOrEmail, password, account.role)
    setBusy(false)
  }

  return (
    <div className="lx-page">
      <div className="lx-card-wrap" style={{ margin: "0 auto" }}>
        <div className="lx-card">
          <div className="lx-logo-row" style={{ justifyContent: "center", marginBottom: 10 }}>
            <div className="lx-logo-box"><img src="/logo.png" alt="Punjab Exotic Foods" /></div>
          </div>
          <div className="qu-avatar">{account.displayName.slice(0, 2).toUpperCase()}</div>
          <h1 className="lx-title" style={{ textAlign: "center" }}>Welcome back, {account.displayName}</h1>
          <p className="lx-sub" style={{ textAlign: "center" }}>Enter your 6-digit PIN to unlock this device.</p>
          <div className="lx-otp-row">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { boxRefs.current[i] = el }}
                className="lx-otp"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={d}
                autoFocus={i === 0}
                onChange={e => setDigit(i, e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Backspace" && !digits[i] && i > 0) boxRefs.current[i - 1]?.focus()
                  if (e.key === "Enter" && digits.join("").length === 6) submit()
                }}
              />
            ))}
          </div>
          {err && <p className="lx-error">{err}</p>}
          <button type="button" className="lx-login-btn" disabled={digits.join("").length !== 6 || busy} onClick={submit}>
            {busy ? "Unlocking…" : "Unlock"}
          </button>
          <button type="button" className="lx-resend" style={{ marginTop: 14 }} onClick={() => { forgetDeviceAccount(); onSwitchAccount() }}>
            Not you? Switch account
          </button>
        </div>
      </div>
    </div>
  )
}
