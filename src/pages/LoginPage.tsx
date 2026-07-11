import { useState } from "react"
import type { FormEvent } from "react"
import type { UserRole } from "../types"

function EyeIcon({ open }: { open: boolean }) {
  return open
    ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a18 18 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
}

export function LoginPage({ onLogin, error }: {
  onLogin: (role: UserRole, username: string, password: string) => Promise<void>
  error: string
}) {
  const [role, setRole]         = useState<UserRole>("admin")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw]     = useState(false)
  const [agreed, setAgreed]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true)
    await onLogin(role, username.trim(), password)
    setLoading(false)
  }

  return (
    <div className="lp-page">
      <div className="lp-card">

        {/* ─── LEFT GRADIENT PANEL ─── */}
        <div className="lp-hero">
          <div className="lp-hero-top">
            <p className="lp-eyebrow">You can easily</p>
            <h2 className="lp-hero-h">Speed up your work<br />with Punjab Foods</h2>
          </div>
          <div className="lp-hero-bottom">
            <p className="lp-partners-label">Punjab Foods Portal</p>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", marginTop: "8px" }}>
              Your complete business management solution
            </p>
          </div>
        </div>

        {/* ─── RIGHT FORM PANEL ─── */}
        <div className="lp-form-side">
          <h1 className="lp-heading">Get Started Now</h1>
          <p className="lp-subheading">Please log in to your account to continue.</p>

          <form onSubmit={submit} className="lp-form">

            <div className="lp-field">
              <label className="lp-label">{role === "admin" ? "Email" : "Customer Number"}</label>
              <input
                className="lp-input"
                placeholder={role === "admin" ? "Enter your email…" : "Enter your customer number…"}
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="lp-field">
              <div className="lp-label-row">
                <label className="lp-label" style={{ margin: 0 }}>Password</label>
                <button type="button" className="lp-forgot">Forgot Password?</button>
              </div>
              <div className="lp-pw-wrap" style={{ marginTop: 6 }}>
                <input
                  className="lp-input"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button type="button" className="lp-pw-toggle" onClick={() => setShowPw(v => !v)}>
                  <EyeIcon open={showPw} />
                </button>
              </div>
            </div>

            <label className="lp-check-row">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="lp-checkbox" />
              <span>I agree to the <a href="#" className="lp-link">Terms & Privacy</a></span>
            </label>

            {error && <p className="lp-error">{error}</p>}

            <button type="submit" className="lp-btn" disabled={loading}>
              {loading ? "Signing in…" : "Log in"}
            </button>
          </form>

          <p className="lp-switch-text">
            {role === "admin" ? "Customer account?" : "Have an account?"}&nbsp;
            <button type="button" className="lp-link-btn"
              onClick={() => setRole(r => r === "admin" ? "customer" : "admin")}>
              {role === "admin" ? "Customer Login" : "Admin Login"}
            </button>
          </p>

          <div className="lp-divider"><span>Or</span></div>

          <div className="lp-social-row">
            <button type="button"
              className={"lp-social-btn" + (role === "customer" ? " lp-social-active" : "")}
              onClick={() => setRole("customer")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Customer Login
            </button>
            <button type="button"
              className={"lp-social-btn" + (role === "admin" ? " lp-social-active" : "")}
              onClick={() => setRole("admin")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Admin Login
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
