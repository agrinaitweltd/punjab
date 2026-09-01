import { useEffect, useState, type CSSProperties } from "react"

/** iOS-style passcode lock (item 9) - shown only to System Developer on a
    saved mobile device, blocking the dashboard until Face ID or the 6-digit
    device passcode verifies the already-authenticated session. Never a
    login screen - no email/password field exists here. */
export function LockScreen({
  staffName, faceIdAvailable, faceIdBusy, onFaceId, onSubmitPasscode, error, lockedUntil, attemptsRemaining,
}: {
  staffName: string
  faceIdAvailable: boolean
  faceIdBusy: boolean
  onFaceId: () => void
  onSubmitPasscode: (passcode: string) => Promise<void>
  error: string
  lockedUntil: string | null
  attemptsRemaining: number | null
}) {
  const [digits, setDigits] = useState("")
  const [mode, setMode] = useState<"faceid" | "passcode">(faceIdAvailable ? "faceid" : "passcode")
  const [countdown, setCountdown] = useState("")

  useEffect(() => {
    if (!lockedUntil) { setCountdown(""); return }
    const tick = () => {
      const ms = new Date(lockedUntil).getTime() - Date.now()
      if (ms <= 0) { setCountdown(""); return }
      const totalSec = Math.ceil(ms / 1000)
      const m = Math.floor(totalSec / 60), s = totalSec % 60
      setCountdown(m > 0 ? `${m}m ${s}s` : `${s}s`)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [lockedUntil])

  const press = (d: string) => {
    if (lockedUntil) return
    const next = (digits + d).slice(0, 6)
    setDigits(next)
    if (next.length === 6) { void onSubmitPasscode(next); setDigits("") }
  }
  const backspace = () => setDigits(d => d.slice(0, -1))

  const locked = Boolean(lockedUntil && countdown)

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999, background: "linear-gradient(160deg,#0d2b1e,#123524 60%,#0a2015)",
      color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <p style={{ fontSize: 13, opacity: 0.7, margin: "0 0 2px", letterSpacing: 0.5 }}>Punjab Exotic Foods</p>
        <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>{staffName || "System Developer"}</p>
        <p style={{ fontSize: 12.5, opacity: 0.55, margin: 0, textTransform: "uppercase", letterSpacing: 1.5 }}>Locked</p>
      </div>

      {mode === "faceid" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <button
            type="button" onClick={onFaceId} disabled={faceIdBusy}
            style={{
              width: 84, height: 84, borderRadius: 22, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: faceIdBusy ? "default" : "pointer",
            }}
            aria-label="Use Face ID"
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.4" opacity={faceIdBusy ? 0.5 : 1}>
              <path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M20 8V6a2 2 0 0 0-2-2h-2M20 16v2a2 2 0 0 1-2 2h-2" strokeLinecap="round"/>
              <circle cx="9" cy="10" r="0.9" fill="#fff" stroke="none"/>
              <circle cx="15" cy="10" r="0.9" fill="#fff" stroke="none"/>
              <path d="M9 15c1 .8 2 .8 3 .8s2 0 3-.8" strokeLinecap="round"/>
              <path d="M12 9v3.2" strokeLinecap="round"/>
            </svg>
          </button>
          <p style={{ fontSize: 13.5, opacity: 0.75 }}>{faceIdBusy ? "Verifying…" : "Tap to use Face ID"}</p>
          {error && <p style={{ fontSize: 12.5, color: "#fca5a5", maxWidth: 260, textAlign: "center" }}>{error}</p>}
          <button type="button" onClick={() => setMode("passcode")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 13.5, marginTop: 8, cursor: "pointer", textDecoration: "underline" }}>
            Use Passcode
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
          <div style={{ display: "flex", gap: 14 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} style={{
                width: 13, height: 13, borderRadius: "50%",
                background: i < digits.length ? "#fff" : "rgba(255,255,255,0.25)",
                border: "1px solid rgba(255,255,255,0.4)",
              }} />
            ))}
          </div>
          {locked ? (
            <p style={{ fontSize: 13, color: "#fca5a5", textAlign: "center" }}>Too many attempts.<br />Try again in {countdown}.</p>
          ) : (
            <>
              {error && <p style={{ fontSize: 12.5, color: "#fca5a5" }}>{error}</p>}
              {attemptsRemaining !== null && attemptsRemaining <= 2 && !error && (
                <p style={{ fontSize: 12, color: "#fbbf24" }}>{attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} remaining</p>
              )}
            </>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 64px)", gap: 14 }}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(d => (
              <button key={d} type="button" disabled={locked} onClick={() => press(d)} style={keyStyle}>{d}</button>
            ))}
            <span />
            <button type="button" disabled={locked} onClick={() => press("0")} style={keyStyle}>0</button>
            <button type="button" disabled={locked || !digits} onClick={backspace} style={{ ...keyStyle, background: "transparent", border: "none", fontSize: 15 }}>⌫</button>
          </div>
          {faceIdAvailable && (
            <button type="button" onClick={() => { setMode("faceid"); setDigits("") }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 13.5, cursor: "pointer", textDecoration: "underline" }}>
              Use Face ID
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const keyStyle: CSSProperties = {
  width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)",
  color: "#fff", fontSize: 24, fontWeight: 500, cursor: "pointer",
}
