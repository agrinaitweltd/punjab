import { useState } from "react"
import type { FormEvent } from "react"
import type { UserRole } from "../types"

function EyeIcon({ open }: { open: boolean }) {
  return open
    ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a18 18 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
}

const FRUITS = [
  { emoji: "🥭", top: "8%",  left: "6%",  size: 44, delay: "0s"   },
  { emoji: "🍍", top: "22%", left: "26%", size: 34, delay: "0.8s" },
  { emoji: "🍉", top: "12%", left: "40%", size: 28, delay: "1.6s" },
  { emoji: "🍇", top: "58%", left: "8%",  size: 36, delay: "0.4s" },
  { emoji: "🥝", top: "70%", left: "30%", size: 30, delay: "1.2s" },
  { emoji: "🍊", top: "40%", left: "15%", size: 26, delay: "2s"   },
  { emoji: "🍋", top: "84%", left: "16%", size: 32, delay: "0.6s" },
]

export function LoginPage({ onLogin, error }: {
  onLogin: (role: UserRole, username: string, password: string) => Promise<void>
  error: string
}) {
  const [role, setRole]         = useState<UserRole>("admin")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw]     = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading]   = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true)
    await onLogin(role, username.trim(), password)
    setLoading(false)
  }

  return (
    <div className="lx-page">
      {/* floating fruits */}
      {FRUITS.map((f, i) => (
        <span key={i} className="lx-fruit" style={{ top: f.top, left: f.left, fontSize: f.size, animationDelay: f.delay }}>{f.emoji}</span>
      ))}

      {/* ─── LEFT BRAND SIDE ─── */}
      <div className="lx-brand">
        <div className="lx-logo-row">
          <div className="lx-logo-box">
            <img src="/logo.png" alt="Punjab Exotic Foods" onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
          </div>
          <div>
            <div className="lx-brand-name">PUNJAB <span>EXOTIC FOODS</span></div>
            <div className="lx-brand-tag">Freshness Starts Here</div>
          </div>
        </div>
        <p className="lx-brand-copy">
          Wholesale exotic fruit &amp; veg for the UK's finest grocers.<br />
          Daily stock, live ordering and account management — all in one portal.
        </p>
        <div className="lx-brand-btns">
          <button type="button" className="lx-pill" onClick={() => setRole("customer")}>Customer Portal</button>
          <button type="button" className="lx-pill lx-pill-ghost" onClick={() => setRole("admin")}>Staff &amp; Admin</button>
        </div>
      </div>

      {/* ─── GLASS LOGIN CARD ─── */}
      <div className="lx-card-wrap">
        <form className="lx-card" onSubmit={submit}>
          <h1 className="lx-title">Log In to Punjab™</h1>

          <div className="lx-role-row">
            <button type="button" className={"lx-role" + (role === "customer" ? " on" : "")} onClick={() => setRole("customer")}>Customer</button>
            <button type="button" className={"lx-role" + (role === "admin" ? " on" : "")} onClick={() => setRole("admin")}>Admin</button>
          </div>

          <label className="lx-label">{role === "admin" ? "Your Email" : "Customer Number or Email"}</label>
          <div className="lx-input-wrap">
            <input
              className="lx-input"
              placeholder={role === "admin" ? "you@punjabfoods.co.uk" : "CUST-001"}
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
            <span className="lx-input-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </span>
          </div>

          <label className="lx-label">Your Password</label>
          <div className="lx-input-wrap">
            <input
              className="lx-input"
              type={showPw ? "text" : "password"}
              placeholder="••••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button type="button" className="lx-input-icon lx-eye" onClick={() => setShowPw(v => !v)}><EyeIcon open={showPw} /></button>
          </div>

          <div className="lx-row-between">
            <label className="lx-remember">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
              Remember
            </label>
            <button type="button" className="lx-forgot">Forgotten?</button>
          </div>

          {error && <p className="lx-error">{error}</p>}

          <button type="submit" className="lx-login-btn" disabled={loading}>
            {loading ? "Signing in…" : "Log In"}
          </button>

          <p className="lx-signup-note">Don't have an account?</p>
          <button type="button" className="lx-signup-btn" onClick={() => setRole("customer")}>
            Contact us for a trade account
          </button>
        </form>
      </div>
    </div>
  )
}
