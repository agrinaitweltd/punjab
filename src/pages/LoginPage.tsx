import { useState } from "react"
import type { FormEvent } from "react"
import type { UserRole } from "../types"

/* ── tiny SVG icons for partner strip ── */
function DiscordIcon() {
  return <svg width="18" height="14" viewBox="0 0 71 55" fill="rgba(255,255,255,0.6)"><path d="M60.1 4.9A58.5 58.5 0 0 0 45.5.9a.2.2 0 0 0-.2.1 40.8 40.8 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0 37.3 37.3 0 0 0-1.8-3.7.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.9 4.9a.2.2 0 0 0-.1.1C1.6 18.4-.9 31.5.3 44.4a.2.2 0 0 0 .1.2 58.8 58.8 0 0 0 17.7 8.9.2.2 0 0 0 .3-.1 42 42 0 0 0 3.6-5.9.2.2 0 0 0-.1-.3 38.7 38.7 0 0 1-5.5-2.6.2.2 0 0 1 0-.4c.4-.3.7-.6 1.1-.9a.2.2 0 0 1 .2 0c11.5 5.3 24 5.3 35.4 0a.2.2 0 0 1 .2 0c.4.3.7.6 1.1.9a.2.2 0 0 1 0 .4 36 36 0 0 1-5.5 2.6.2.2 0 0 0-.1.3 47.1 47.1 0 0 0 3.6 5.9.2.2 0 0 0 .3.1 58.6 58.6 0 0 0 17.8-8.9.2.2 0 0 0 .1-.2c1.5-15-2.5-28-10.6-39.5a.2.2 0 0 0-.1-.1zM23.7 36.8c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.5 3.3 6.4 7.2 0 4-2.8 7.2-6.4 7.2zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.5 3.3 6.4 7.2 0 4-2.8 7.2-6.4 7.2z"/></svg>
}
function InstaIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
}
function SpotifyIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
}
function YoutubeIcon() {
  return <svg width="18" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.96-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#0d2b1e"/></svg>
}
function TikTokIcon() {
  return <svg width="14" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>
}

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
            <p className="lp-partners-label">Our partners</p>
            <div className="lp-partner-strip">
              <span className="lp-partner-item"><DiscordIcon /><span>Discord</span></span>
              <span className="lp-partner-item"><InstaIcon /><span>Instagram</span></span>
              <span className="lp-partner-item"><SpotifyIcon /><span>Spotify</span></span>
              <span className="lp-partner-item"><YoutubeIcon /><span>YouTube</span></span>
              <span className="lp-partner-item"><TikTokIcon /><span>TikTo...</span></span>
            </div>
          </div>
        </div>

        {/* ─── RIGHT FORM PANEL ─── */}
        <div className="lp-form-side">
          <h1 className="lp-heading">Get Started Now</h1>
          <p className="lp-subheading">Please log in to your account to continue.</p>

          <form onSubmit={submit} className="lp-form">

            <div className="lp-field">
              <label className="lp-label">{role === "admin" ? "Username" : "Customer Number"}</label>
              <input
                className="lp-input"
                placeholder={role === "admin" ? "Enter your username…" : "Enter your customer number…"}
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