import { useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import type { UserRole } from "../types"

function getSecsTo5AM() {
  const now = new Date(); const t = new Date(now)
  t.setHours(5,0,0,0); if (now >= t) t.setDate(t.getDate()+1)
  return Math.floor((t.getTime()-now.getTime())/1000)
}
function fmt(s: number) {
  return [Math.floor(s/3600),Math.floor((s%3600)/60),s%60].map(v=>String(v).padStart(2,"0")).join(":")
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  )
}

export function LoginPage({ onLogin, error }: {
  onLogin: (role: UserRole, username: string, password: string) => Promise<void>
  error: string
}) {
  const [role, setRole]         = useState<UserRole>("customer")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw]     = useState(false)
  const [agreed, setAgreed]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [countdown, setCd]      = useState(getSecsTo5AM())
  const timer = useRef<ReturnType<typeof setInterval>|null>(null)

  useEffect(() => {
    timer.current = setInterval(() => setCd(p => p<=1 ? getSecsTo5AM() : p-1), 1000)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true)
    await onLogin(role, username.trim(), password)
    setLoading(false)
  }

  return (
    <div className="lp-page">
      <div className="lp-card">

        {/* LEFT — gradient hero */}
        <div className="lp-hero">
          <div className="lp-hero-inner">
            <p className="lp-eyebrow">You can easily</p>
            <h2 className="lp-hero-h">
              Speed up your work<br />with Punjab Foods
            </h2>
          </div>
          {/* bottom — countdown + partner-style logos */}
          <div className="lp-hero-bottom">
            <p className="lp-partners-label">Next Price Release</p>
            <div className="lp-countdown">{fmt(countdown)}</div>
            <p className="lp-partners-label" style={{ marginBottom: 10 }}>Our partners</p>
            <div className="lp-partner-logos">
              <span>🌿 Fresh Daily</span>
              <span>📦 Wholesale</span>
              <span>🚚 UK Delivery</span>
              <span>⭐ Quality</span>
            </div>
          </div>
        </div>

        {/* RIGHT — form */}
        <div className="lp-form-side">
          <h1 className="lp-heading">Get Started Now</h1>
          <p className="lp-subheading">Please log in to your account to continue.</p>

          <form onSubmit={submit} className="lp-form">
            {/* Username / Customer Number */}
            <div className="lp-field">
              <label className="lp-label">{role === "admin" ? "Username" : "Customer Number"}</label>
              <input
                className="lp-input"
                placeholder={role === "admin" ? "Enter your username…" : "Enter your customer number…"}
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div className="lp-field">
              <div className="lp-label-row">
                <label className="lp-label">Password</label>
                <button type="button" className="lp-forgot">Forgot Password?</button>
              </div>
              <div className="lp-pw-wrap">
                <input
                  className="lp-input"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button type="button" className="lp-pw-toggle" onClick={() => setShowPw(v=>!v)}>
                  <EyeIcon open={showPw} />
                </button>
              </div>
            </div>

            {/* Checkbox */}
            <label className="lp-check-row">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="lp-checkbox" />
              <span>I agree to the <a href="#" className="lp-link">Terms &amp; Privacy</a></span>
            </label>

            {error && <p className="lp-error">{error}</p>}

            {/* Submit */}
            <button type="submit" className="lp-btn" disabled={loading}>
              {loading ? "Signing in…" : "Log in"}
            </button>
          </form>

          {/* "Have an account" row */}
          <p className="lp-switch-text">
            {role === "admin" ? "Not admin?" : "Are you admin?"}&nbsp;
            <button type="button" className="lp-link-btn" onClick={() => setRole(r => r === "admin" ? "customer" : "admin")}>
              Switch here
            </button>
          </p>

          {/* Divider */}
          <div className="lp-divider"><span>Or</span></div>

          {/* Role buttons */}
          <div className="lp-social-row">
            <button
              type="button"
              className={"lp-social-btn" + (role === "customer" ? " lp-social-active" : "")}
              onClick={() => setRole("customer")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Customer Login
            </button>
            <button
              type="button"
              className={"lp-social-btn" + (role === "admin" ? " lp-social-active" : "")}
              onClick={() => setRole("admin")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Admin Login
            </button>
          </div>

          <p className="lp-demo">Demo — Admin: <strong>admin / admin123</strong> &nbsp;|&nbsp; Customer: <strong>CUST-001 / customer123</strong></p>
        </div>

      </div>
    </div>
  )
}