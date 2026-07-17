import { useRef, useState } from "react"
import type { FormEvent } from "react"
import type { UserRole } from "../types"
import { getCustomers, updateCustomer } from "../api/customersApi"
import { getAdmins, updateAdmin } from "../api/miscApi"
import { sendEmail, otpEmailHtml } from "../lib/emailService"

function EyeIcon({ open }: { open: boolean }) {
  return open
    ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a18 18 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
}

type FruitKind = "orange" | "mango" | "watermelon" | "grapes" | "kiwi" | "lime"

/* Realistic gradient-shaded SVG fruits (no emojis, no external assets) */
function FruitArt({ kind, size, uid }: { kind: FruitKind; size: number; uid: string }) {
  const g = (n: string) => `${kind}-${n}-${uid}`
  switch (kind) {
    case "orange": return (
      <svg width={size} height={size} viewBox="0 0 64 64">
        <defs>
          <radialGradient id={g("b")} cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#ffc966"/><stop offset="55%" stopColor="#ff9420"/><stop offset="100%" stopColor="#d96a06"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="35" r="26" fill={`url(#${g("b")})`} />
        <ellipse cx="23" cy="25" rx="8" ry="5" fill="rgba(255,255,255,0.35)" transform="rotate(-25 23 25)" />
        <ellipse cx="32" cy="11" rx="3" ry="1.6" fill="#b3540a" />
        <path d="M33 10 C38 4, 46 5, 48 9 C42 12, 36 12, 33 10 Z" fill="#3e9142" />
        <path d="M34 10 C38 7, 44 7, 47 9" stroke="#2c6b30" strokeWidth="1" fill="none" />
      </svg>
    )
    case "mango": return (
      <svg width={size} height={size} viewBox="0 0 64 64">
        <defs>
          <linearGradient id={g("b")} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffe066"/><stop offset="45%" stopColor="#ffb020"/><stop offset="100%" stopColor="#e5541b"/>
          </linearGradient>
        </defs>
        <path d="M18 14 C34 4, 56 18, 54 36 C52 52, 36 60, 24 56 C10 51, 6 34, 12 24 C14 20, 15 16, 18 14 Z" fill={`url(#${g("b")})`} />
        <ellipse cx="24" cy="22" rx="9" ry="5" fill="rgba(255,255,255,0.3)" transform="rotate(-30 24 22)" />
        <path d="M19 13 C21 9, 24 8, 26 9" stroke="#5d8f3d" strokeWidth="3" strokeLinecap="round" fill="none" />
      </svg>
    )
    case "watermelon": return (
      <svg width={size} height={size} viewBox="0 0 64 64">
        <defs>
          <linearGradient id={g("f")} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff6b6b"/><stop offset="100%" stopColor="#e02f2f"/>
          </linearGradient>
        </defs>
        <path d="M6 24 A 30 30 0 0 0 58 24 L 32 58 Z" fill="#2e7d32" transform="rotate(0 32 32)" />
        <path d="M6 24 A 30 30 0 0 0 58 24 L 32 58 Z" fill="none" />
        <path d="M9 26 A 27 27 0 0 0 55 26 L 32 55 Z" fill="#c8e6c9" />
        <path d="M12 28 A 24 24 0 0 0 52 28 L 32 52 Z" fill={`url(#${g("f")})`} />
        <ellipse cx="26" cy="33" rx="1.7" ry="2.6" fill="#1d1d1d" transform="rotate(15 26 33)" />
        <ellipse cx="37" cy="34" rx="1.7" ry="2.6" fill="#1d1d1d" transform="rotate(-12 37 34)" />
        <ellipse cx="31" cy="42" rx="1.6" ry="2.4" fill="#1d1d1d" />
      </svg>
    )
    case "grapes": return (
      <svg width={size} height={size} viewBox="0 0 64 64">
        <defs>
          <radialGradient id={g("b")} cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#9b59d0"/><stop offset="60%" stopColor="#6a2fa0"/><stop offset="100%" stopColor="#471d75"/>
          </radialGradient>
        </defs>
        <path d="M32 12 C33 7, 36 4, 40 3" stroke="#6d4c2f" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M32 12 C36 8, 43 8, 46 12 C41 15, 35 15, 32 12 Z" fill="#4d9e50" />
        {[[22,22],[32,20],[42,22],[17,32],[27,31],[37,31],[47,32],[22,41],[32,41],[42,41],[27,50],[37,50],[32,58]].map(([cx, cy], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="6.4" fill={`url(#${g("b")})`} />
            <ellipse cx={cx - 2} cy={cy - 2.4} rx="2" ry="1.3" fill="rgba(255,255,255,0.35)" transform={`rotate(-25 ${cx - 2} ${cy - 2.4})`} />
          </g>
        ))}
      </svg>
    )
    case "kiwi": return (
      <svg width={size} height={size} viewBox="0 0 64 64">
        <defs>
          <radialGradient id={g("b")} cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#e8f5c8"/><stop offset="28%" stopColor="#c5e86c"/><stop offset="100%" stopColor="#7cb342"/>
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="27" fill="#8d6e4d" />
        <circle cx="32" cy="32" r="24.5" fill={`url(#${g("b")})`} />
        <circle cx="32" cy="32" r="7" fill="#f3f8dd" />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2
          return <ellipse key={i} cx={32 + Math.cos(a) * 12.5} cy={32 + Math.sin(a) * 12.5} rx="1.3" ry="2.2" fill="#2c2c17" transform={`rotate(${(a * 180) / Math.PI + 90} ${32 + Math.cos(a) * 12.5} ${32 + Math.sin(a) * 12.5})`} />
        })}
      </svg>
    )
    case "lime": return (
      <svg width={size} height={size} viewBox="0 0 64 64">
        <defs>
          <radialGradient id={g("b")} cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#f9f770"/><stop offset="55%" stopColor="#f2d51e"/><stop offset="100%" stopColor="#c9a708"/>
          </radialGradient>
        </defs>
        <ellipse cx="32" cy="34" rx="28" ry="21" fill={`url(#${g("b")})`} />
        <ellipse cx="59" cy="34" rx="3" ry="4" fill="#c9a708" />
        <ellipse cx="22" cy="26" rx="9" ry="4.5" fill="rgba(255,255,255,0.4)" transform="rotate(-18 22 26)" />
        <ellipse cx="5" cy="34" rx="2.5" ry="3.4" fill="#a98c06" />
      </svg>
    )
  }
}

const FRUITS: { kind: FruitKind; top: string; left: string; size: number; delay: string }[] = [
  { kind: "mango",      top: "8%",  left: "6%",  size: 62, delay: "0s"   },
  { kind: "watermelon", top: "22%", left: "26%", size: 50, delay: "0.8s" },
  { kind: "orange",     top: "12%", left: "40%", size: 42, delay: "1.6s" },
  { kind: "grapes",     top: "58%", left: "8%",  size: 56, delay: "0.4s" },
  { kind: "kiwi",       top: "70%", left: "30%", size: 46, delay: "1.2s" },
  { kind: "lime",       top: "40%", left: "15%", size: 40, delay: "2s"   },
  { kind: "watermelon", top: "84%", left: "16%", size: 44, delay: "0.6s" },
]

/* ── First-time activation: email → 6-digit code → set password ── */
type Found = {
  kind: "customer" | "admin"; id: string; name: string; email: string
  pendingProfile?: boolean; companyName?: string; contactPerson?: string; phone?: string; address?: string
}
const isValidUkPhone = (phone: string) => /^\+44\d{9,10}$/.test(phone.replace(/\s+/g, ""))
const OTP_TTL_MS = 5 * 60 * 1000 // codes last 5 minutes

function ActivateFlow({ onBack, onDone }: { onBack: () => void; onDone: (email: string, role: UserRole) => void }) {
  const [stage, setStage]     = useState<"email" | "code" | "setup" | "done">("email")
  const [email, setEmail]     = useState("")
  const [account, setAccount] = useState<Found | null>(null)
  const [code, setCode]       = useState("")
  const [digits, setDigits]   = useState<string[]>(["", "", "", "", "", ""])
  const [pw, setPw]           = useState("")
  const [pw2, setPw2]         = useState("")
  const [profile, setProfile] = useState({ companyName: "", contactPerson: "", phone: "+44 ", address: "" })
  const [err, setErr]         = useState("")
  const [busy, setBusy]       = useState(false)
  const [devCode, setDevCode] = useState("")
  const [codeAt, setCodeAt]   = useState(0)
  const boxRefs = useRef<(HTMLInputElement | null)[]>([])

  const lookupAndSend = async (e: FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true)
    try {
      const em = email.trim().toLowerCase()
      const [customers, admins] = await Promise.all([getCustomers(), getAdmins()])
      const c = customers.find(x => x.email?.toLowerCase() === em)
      const a = admins.find(x => x.email?.toLowerCase() === em)
      const found: Found | null = c
        ? {
            kind: "customer", id: c.id, name: c.contactPerson || c.companyName, email: c.email,
            pendingProfile: true, companyName: c.companyName === c.email.split("@")[0] ? "" : c.companyName,
            contactPerson: c.contactPerson ?? "", phone: c.phone ?? "", address: c.address ?? "",
          }
        : a ? { kind: "admin", id: a.id, name: a.name, email: a.email } : null
      if (!found) { setErr("We couldn't find an account with that email. Ask your admin to add you first."); setBusy(false); return }
      const otp = String(Math.floor(100000 + Math.random() * 900000))
      setCode(otp); setAccount(found); setDevCode(""); setCodeAt(Date.now())
      const sent = await sendEmail(found.email, "Your Punjab Exotic Foods verification code", otpEmailHtml(otp))
      if (!sent.ok && import.meta.env.DEV) setDevCode(otp) // local dev has no email server
      setDigits(["", "", "", "", "", ""])
      setStage("code")
    } catch { setErr("Something went wrong — please try again.") }
    setBusy(false)
  }

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "")
    const next = [...digits]
    if (clean.length > 1) { // paste
      clean.slice(0, 6).split("").forEach((ch, j) => { if (i + j < 6) next[i + j] = ch })
      setDigits(next)
      boxRefs.current[Math.min(5, i + clean.length)]?.focus()
      return
    }
    next[i] = clean
    setDigits(next)
    if (clean && i < 5) boxRefs.current[i + 1]?.focus()
  }

  const verifyCode = (e: FormEvent) => {
    e.preventDefault(); setErr("")
    if (Date.now() - codeAt > OTP_TTL_MS) { setErr("This code has expired — tap Resend code for a new one."); return }
    if (digits.join("") === code) {
      if (account?.kind === "customer") {
        setProfile({
          companyName: account.companyName || "",
          contactPerson: account.contactPerson || "",
          phone: account.phone || "+44 ",
          address: account.address || "",
        })
      }
      setStage("setup")
    } else setErr("That code doesn't match — check your email and try again.")
  }

  const finishSetup = async (e: FormEvent) => {
    e.preventDefault(); setErr("")
    if (account!.kind === "customer") {
      if (!profile.companyName.trim() || !profile.contactPerson.trim()) { setErr("Please fill in your company and contact name."); return }
      if (!isValidUkPhone(profile.phone)) { setErr("Phone must be in +44 format, e.g. +44 7700 900123"); return }
    }
    if (pw.length < 6) { setErr("Password must be at least 6 characters."); return }
    if (pw !== pw2) { setErr("Passwords don't match."); return }
    setBusy(true)
    try {
      if (account!.kind === "customer") {
        await updateCustomer(account!.id, {
          companyName: profile.companyName.trim(),
          contactPerson: profile.contactPerson.trim(),
          phone: profile.phone.trim(),
          address: profile.address.trim(),
          email: account!.email,
          password: pw,
        })
      } else await updateAdmin(account!.id, { password: pw })
      setStage("done")
    } catch { setErr("Couldn't save your details — please try again.") }
    setBusy(false)
  }

  return (
    <div className="lx-card">
      <button type="button" className="lx-back" onClick={onBack}>← Back to login</button>

      {stage === "email" && (
        <form onSubmit={lookupAndSend}>
          <h1 className="lx-title">First time here?</h1>
          <p className="lx-sub">Enter the email your admin registered for you and we'll send a 6-digit code to verify it's you.</p>
          <label className="lx-label">Your Email</label>
          <div className="lx-input-wrap">
            <input className="lx-input" type="email" placeholder="you@company.co.uk" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            <span className="lx-input-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </span>
          </div>
          {err && <p className="lx-error">{err}</p>}
          <button type="submit" className="lx-login-btn" disabled={busy}>{busy ? "Checking…" : "Send my code"}</button>
        </form>
      )}

      {stage === "code" && (
        <form onSubmit={verifyCode}>
          <h1 className="lx-title">Check your inbox</h1>
          <p className="lx-sub">We sent a 6-digit code to <strong>{account?.email}</strong>. It expires in 5 minutes.</p>
          {devCode && <p className="lx-devhint">Local preview (no email server): your code is <strong>{devCode}</strong></p>}
          <div className="lx-otp-row">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { boxRefs.current[i] = el }}
                className="lx-otp"
                inputMode="numeric"
                maxLength={6}
                value={d}
                autoFocus={i === 0}
                onChange={e => setDigit(i, e.target.value)}
                onKeyDown={e => { if (e.key === "Backspace" && !digits[i] && i > 0) boxRefs.current[i - 1]?.focus() }}
              />
            ))}
          </div>
          {err && <p className="lx-error">{err}</p>}
          <button type="submit" className="lx-login-btn" disabled={digits.join("").length !== 6}>Verify code</button>
          <button type="button" className="lx-resend" onClick={e => lookupAndSend(e as unknown as FormEvent)} disabled={busy}>
            {busy ? "Sending…" : "Resend code"}
          </button>
        </form>
      )}

      {stage === "setup" && (
        <form onSubmit={finishSetup}>
          <h1 className="lx-title">{account?.kind === "customer" ? "Set up your account" : `Welcome, ${account?.name}!`}</h1>
          <p className="lx-sub">
            {account?.kind === "customer"
              ? "You're verified — tell us about your business and choose a password."
              : "You're verified. Set a password to finish activating your admin account."}
          </p>
          {account?.kind === "customer" && (
            <>
              <label className="lx-label">Company Name</label>
              <div className="lx-input-wrap">
                <input className="lx-input" placeholder="Fresh Market Ltd" value={profile.companyName} onChange={e => setProfile({ ...profile, companyName: e.target.value })} required autoFocus />
              </div>
              <label className="lx-label">Contact Person</label>
              <div className="lx-input-wrap">
                <input className="lx-input" placeholder="Your full name" value={profile.contactPerson} onChange={e => setProfile({ ...profile, contactPerson: e.target.value })} required />
              </div>
              <label className="lx-label">Phone (+44)</label>
              <div className="lx-input-wrap">
                <input className="lx-input" placeholder="+44 7700 900123" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} required />
              </div>
              <label className="lx-label">Delivery Address</label>
              <div className="lx-input-wrap">
                <input className="lx-input" placeholder="12 Market Street, Birmingham B1 1AA" value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} />
              </div>
            </>
          )}
          <label className="lx-label">New Password</label>
          <div className="lx-input-wrap">
            <input className="lx-input" type="password" placeholder="At least 6 characters" value={pw} onChange={e => setPw(e.target.value)} required autoFocus />
          </div>
          <label className="lx-label">Confirm Password</label>
          <div className="lx-input-wrap">
            <input className="lx-input" type="password" placeholder="Repeat your password" value={pw2} onChange={e => setPw2(e.target.value)} required />
          </div>
          {err && <p className="lx-error">{err}</p>}
          <button type="submit" className="lx-login-btn" disabled={busy}>{busy ? "Saving…" : "Activate my account"}</button>
        </form>
      )}

      {stage === "done" && (
        <div style={{ textAlign: "center" }}>
          <div className="lx-done-ico">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h1 className="lx-title" style={{ marginBottom: 8 }}>You're all set!</h1>
          <p className="lx-sub">Your account is active. Log in with your email and new password.</p>
          <button type="button" className="lx-login-btn" onClick={() => onDone(account!.email, account!.kind === "admin" ? "admin" : "customer")}>
            Go to login
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Forgot password: email → 5-minute code → new password ── */
type ForgotAccount = { kind: "customer" | "admin"; id: string; name: string; email: string }

function ForgotPasswordFlow({ onBack, onDone }: { onBack: () => void; onDone: (email: string, role: UserRole) => void }) {
  const [stage, setStage]     = useState<"email" | "code" | "reset" | "done">("email")
  const [email, setEmail]     = useState("")
  const [account, setAccount] = useState<ForgotAccount | null>(null)
  const [code, setCode]       = useState("")
  const [codeAt, setCodeAt]   = useState(0)
  const [digits, setDigits]   = useState<string[]>(["", "", "", "", "", ""])
  const [pw, setPw]           = useState("")
  const [pw2, setPw2]         = useState("")
  const [err, setErr]         = useState("")
  const [busy, setBusy]       = useState(false)
  const [devCode, setDevCode] = useState("")
  const boxRefs = useRef<(HTMLInputElement | null)[]>([])

  const lookupAndSend = async (e: FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true)
    try {
      const em = email.trim().toLowerCase()
      const [customers, admins] = await Promise.all([getCustomers(), getAdmins()])
      const c = customers.find(x => x.email?.toLowerCase() === em)
      const a = admins.find(x => x.email?.toLowerCase() === em)
      const found: ForgotAccount | null = c
        ? { kind: "customer", id: c.id, name: c.contactPerson || c.companyName, email: c.email }
        : a ? { kind: "admin", id: a.id, name: a.name, email: a.email } : null
      if (!found) { setErr("We couldn't find an account with that email."); setBusy(false); return }
      const otp = String(Math.floor(100000 + Math.random() * 900000))
      setCode(otp); setAccount(found); setDevCode(""); setCodeAt(Date.now())
      const sent = await sendEmail(found.email, "Reset your Punjab Exotic Foods password", otpEmailHtml(otp))
      if (!sent.ok && import.meta.env.DEV) setDevCode(otp)
      setDigits(["", "", "", "", "", ""])
      setStage("code")
    } catch { setErr("Something went wrong — please try again.") }
    setBusy(false)
  }

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

  const verifyCode = (e: FormEvent) => {
    e.preventDefault(); setErr("")
    if (Date.now() - codeAt > OTP_TTL_MS) { setErr("This code has expired — tap Resend code for a new one."); return }
    if (digits.join("") === code) setStage("reset")
    else setErr("That code doesn't match — check your email and try again.")
  }

  const finishReset = async (e: FormEvent) => {
    e.preventDefault(); setErr("")
    if (pw.length < 6) { setErr("Password must be at least 6 characters."); return }
    if (pw !== pw2) { setErr("Passwords don't match."); return }
    setBusy(true)
    try {
      if (account!.kind === "customer") await updateCustomer(account!.id, { password: pw })
      else await updateAdmin(account!.id, { password: pw })
      setStage("done")
    } catch { setErr("Couldn't save your new password — please try again.") }
    setBusy(false)
  }

  return (
    <div className="lx-card">
      <button type="button" className="lx-back" onClick={onBack}>← Back to login</button>

      {stage === "email" && (
        <form onSubmit={lookupAndSend}>
          <h1 className="lx-title">Forgotten your password?</h1>
          <p className="lx-sub">Enter your account email and we'll send a 6-digit reset code, valid for 5 minutes.</p>
          <label className="lx-label">Your Email</label>
          <div className="lx-input-wrap">
            <input className="lx-input" type="email" placeholder="you@company.co.uk" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            <span className="lx-input-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </span>
          </div>
          {err && <p className="lx-error">{err}</p>}
          <button type="submit" className="lx-login-btn" disabled={busy}>{busy ? "Checking…" : "Send reset code"}</button>
        </form>
      )}

      {stage === "code" && (
        <form onSubmit={verifyCode}>
          <h1 className="lx-title">Check your inbox</h1>
          <p className="lx-sub">We sent a 6-digit code to <strong>{account?.email}</strong>. It expires in 5 minutes.</p>
          {devCode && <p className="lx-devhint">Local preview (no email server): your code is <strong>{devCode}</strong></p>}
          <div className="lx-otp-row">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { boxRefs.current[i] = el }}
                className="lx-otp"
                inputMode="numeric"
                maxLength={6}
                value={d}
                autoFocus={i === 0}
                onChange={e => setDigit(i, e.target.value)}
                onKeyDown={e => { if (e.key === "Backspace" && !digits[i] && i > 0) boxRefs.current[i - 1]?.focus() }}
              />
            ))}
          </div>
          {err && <p className="lx-error">{err}</p>}
          <button type="submit" className="lx-login-btn" disabled={digits.join("").length !== 6}>Verify code</button>
          <button type="button" className="lx-resend" onClick={e => lookupAndSend(e as unknown as FormEvent)} disabled={busy}>
            {busy ? "Sending…" : "Resend code"}
          </button>
        </form>
      )}

      {stage === "reset" && (
        <form onSubmit={finishReset}>
          <h1 className="lx-title">Choose a new password</h1>
          <p className="lx-sub">You're verified, {account?.name}. Set a new password for your {account?.kind} account.</p>
          <label className="lx-label">New Password</label>
          <div className="lx-input-wrap">
            <input className="lx-input" type="password" placeholder="At least 6 characters" value={pw} onChange={e => setPw(e.target.value)} required autoFocus />
          </div>
          <label className="lx-label">Confirm Password</label>
          <div className="lx-input-wrap">
            <input className="lx-input" type="password" placeholder="Repeat your password" value={pw2} onChange={e => setPw2(e.target.value)} required />
          </div>
          {err && <p className="lx-error">{err}</p>}
          <button type="submit" className="lx-login-btn" disabled={busy}>{busy ? "Saving…" : "Reset password"}</button>
        </form>
      )}

      {stage === "done" && (
        <div style={{ textAlign: "center" }}>
          <div className="lx-done-ico">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h1 className="lx-title" style={{ marginBottom: 8 }}>Password reset!</h1>
          <p className="lx-sub">Log in with your email and new password.</p>
          <button type="button" className="lx-login-btn" onClick={() => onDone(account!.email, account!.kind === "admin" ? "admin" : "customer")}>
            Go to login
          </button>
        </div>
      )}
    </div>
  )
}

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
  const [mode, setMode]         = useState<"login" | "activate" | "forgot">("login")

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true)
    await onLogin(role, username.trim(), password)
    setLoading(false)
  }

  return (
    <div className="lx-page">
      {/* floating fruits */}
      {FRUITS.map((f, i) => (
        <span key={i} className="lx-fruit" style={{ top: f.top, left: f.left, animationDelay: f.delay }}>
          <FruitArt kind={f.kind} size={f.size} uid={String(i)} />
        </span>
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
        {mode === "activate" ? (
          <ActivateFlow
            onBack={() => setMode("login")}
            onDone={(em, r) => { setUsername(em); setRole(r); setMode("login") }}
          />
        ) : mode === "forgot" ? (
          <ForgotPasswordFlow
            onBack={() => setMode("login")}
            onDone={(em, r) => { setUsername(em); setRole(r); setMode("login") }}
          />
        ) : (
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
            <button type="button" className="lx-forgot" onClick={() => setMode("forgot")}>Forgotten?</button>
          </div>

          {error && <p className="lx-error">{error}</p>}

          <button type="submit" className="lx-login-btn" disabled={loading}>
            {loading ? "Signing in…" : "Log In"}
          </button>

          <p className="lx-signup-note">First time here?</p>
          <button type="button" className="lx-signup-btn" onClick={() => setMode("activate")}>
            Activate your account with email
          </button>
        </form>
        )}
      </div>
    </div>
  )
}
