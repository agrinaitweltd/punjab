import { useRef, useState } from "react"
import type { FormEvent } from "react"
import type { UserRole } from "../types"
import { updateCustomer } from "../api/customersApi"
import { updateAdmin, createCustomerApplication } from "../api/miscApi"
import { sendEmail, ADMIN_NOTIFY_EMAIL } from "../lib/emailService"
import { Eye, EyeOff, LockKeyhole, Mail, UsersRound } from "lucide-react"
import { showAppError, showSuccess } from "../lib/appDialogs"
import { Spinner } from "../components/ui/Spinner"
import { supabase } from "../lib/supabase"

function GoogleIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.78-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82z"/>
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.28v3.1C3.26 21.3 7.31 24 12 24z"/>
    <path fill="#FBBC05" d="M5.29 14.31A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.58.38-2.31v-3.1H1.28A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.28 5.41l4.01-3.1z"/>
    <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.28 6.59l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75z"/>
  </svg>
}
function AppleIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="#111" aria-hidden="true">
    <path d="M16.36 1.05c.1 1.02-.28 2.02-.9 2.75-.65.76-1.72 1.36-2.75 1.28-.13-1 .33-2.05.94-2.72.68-.75 1.83-1.32 2.71-1.31zM20.9 17.28c-.34.79-.75 1.51-1.24 2.19-.68.94-1.24 1.6-1.68 1.97-.68.62-1.4.94-2.18.96-.56.01-1.23-.16-2.01-.5-.79-.34-1.51-.5-2.18-.5-.7 0-1.44.16-2.24.5-.8.34-1.44.52-1.94.54-.75.03-1.49-.3-2.22-.98-.47-.4-1.06-1.1-1.77-2.09-.76-1.06-1.39-2.29-1.88-3.7-.53-1.52-.79-3-.79-4.42 0-1.63.35-3.03 1.06-4.21.55-.95 1.29-1.7 2.2-2.25.92-.55 1.9-.83 2.97-.85.6 0 1.38.19 2.36.55.98.37 1.6.55 1.87.55.2 0 .9-.21 2.08-.63 1.12-.39 2.06-.55 2.84-.49 2.1.17 3.68 1 4.72 2.5-1.88 1.14-2.81 2.73-2.79 4.77.02 1.59.6 2.91 1.72 3.96.51.49 1.09.86 1.72 1.13-.14.4-.29.79-.46 1.17z"/>
  </svg>
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? <Eye size={17} /> : <EyeOff size={17} />
}

function AuthBrand() {
  return <div className="lx-form-brand">
    <img src="/logo.png" alt="" />
    <span><strong>Punjab Exotic Foods</strong><small>Business Management Portal</small></span>
  </div>
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

/* Small ambient fruits hugging the far edges of the panel, well clear of
   the hero cluster and copy in the centre. */
const FRUITS: { kind: FruitKind; top: string; left: string; size: number; delay: string }[] = [
  { kind: "lime",   top: "6%",  left: "6%",  size: 30, delay: "0s"   },
  { kind: "kiwi",   top: "8%",  left: "88%", size: 28, delay: "1.6s" },
  { kind: "orange", top: "88%", left: "8%",  size: 32, delay: "0.8s" },
  { kind: "grapes", top: "90%", left: "90%", size: 30, delay: "0.4s" },
]

/* The main hero illustration: a loose, layered cluster of fruit (built from
   the same FruitArt art, just bigger) instead of a generic dashboard mockup
   - this is a fresh-produce wholesaler, so the produce itself is the hero. */
const HERO_FRUITS: { kind: FruitKind; top: string; left: string; size: number; z: number; delay: string }[] = [
  { kind: "watermelon", top: "8%",  left: "30%", size: 150, z: 1, delay: "0s"   },
  { kind: "mango",      top: "38%", left: "4%",  size: 108, z: 3, delay: "1.1s" },
  { kind: "orange",     top: "44%", left: "58%", size: 96,  z: 3, delay: "0.6s" },
  { kind: "grapes",     top: "2%",  left: "0%",  size: 92,  z: 2, delay: "1.8s" },
  { kind: "kiwi",       top: "58%", left: "34%", size: 74,  z: 4, delay: "0.3s" },
  { kind: "lime",       top: "4%",  left: "72%", size: 68,  z: 2, delay: "2.2s" },
]

/* ── First-time activation: email → 6-digit code → set password ── */
type Found = {
  kind: "customer" | "admin"; id: string; name: string; email: string
  pendingProfile?: boolean; companyName?: string; contactPerson?: string; phone?: string; address?: string
}
const isValidUkPhone = (phone: string) => /^\+44\d{9,10}$/.test(phone.replace(/\s+/g, ""))
const OTP_TTL_MS = 5 * 60 * 1000 // codes last 5 minutes

function ActivateFlow({ role, onBack, onDone }: { role: UserRole; onBack: () => void; onDone: (email: string, role: UserRole) => void }) {
  const [stage, setStage]     = useState<"email" | "code" | "setup" | "done">("email")
  const [email, setEmail]     = useState("")
  const [account, setAccount] = useState<Found | null>(null)
  const [code]                = useState("")
  const [digits, setDigits]   = useState<string[]>(["", "", "", "", "", ""])
  const [pw, setPw]           = useState("")
  const [pw2, setPw2]         = useState("")
  const [profile, setProfile] = useState({ companyName: "", contactPerson: "", phone: "+44 ", address: "" })
  const [err, setErr]         = useState("")
  const [busy, setBusy]       = useState(false)
  const [devCode]             = useState("")
  const [codeAt]              = useState(0)
  const boxRefs = useRef<(HTMLInputElement | null)[]>([])

  const lookupAndSend = async (e: FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true)
    try {
      const em = email.trim().toLowerCase()
      const response = await fetch('/api/request-password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, email: em }) })
      if (!response.ok) throw new Error('Password reset email could not be sent')
      setAccount({ kind: role, id: '', name: '', email: em })
      setStage("done")
      showSuccess("Setup email sent")
    } catch (error) {
      setErr("Something went wrong — please try again.")
      showAppError(error, { feature: 'Account Activation', fallbackCode: 503, retry: () => lookupAndSend(e) })
    }
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
    <div className="lx-card lx-card-signup">
      <AuthBrand />
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
          <h1 className="lx-title" style={{ marginBottom: 8 }}>Check your email</h1>
          <p className="lx-sub">If that account exists, we sent a secure one-time link to set your password.</p>
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

function ForgotPasswordFlow({ role, onBack, onDone }: { role: UserRole; onBack: () => void; onDone: (email: string, role: UserRole) => void }) {
  const [stage, setStage]     = useState<"email" | "code" | "reset" | "done">("email")
  const [email, setEmail]     = useState("")
  const [account, setAccount] = useState<ForgotAccount | null>(null)
  const [code]                = useState("")
  const [codeAt]              = useState(0)
  const [digits, setDigits]   = useState<string[]>(["", "", "", "", "", ""])
  const [pw, setPw]           = useState("")
  const [pw2, setPw2]         = useState("")
  const [err, setErr]         = useState("")
  const [busy, setBusy]       = useState(false)
  const [devCode]             = useState("")
  const boxRefs = useRef<(HTMLInputElement | null)[]>([])

  const lookupAndSend = async (e: FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true)
    try {
      const em = email.trim().toLowerCase()
      const response = await fetch('/api/request-password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, email: em }) })
      if (!response.ok) throw new Error('Password reset email could not be sent')
      setAccount({ kind: role, id: '', name: '', email: em })
      setStage("done")
      showSuccess("Password reset email sent")
    } catch (error) {
      setErr("Something went wrong — please try again.")
      showAppError(error, { feature: 'Forgot Password', fallbackCode: 503, retry: () => lookupAndSend(e) })
    }
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
      <AuthBrand />
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
          <h1 className="lx-title" style={{ marginBottom: 8 }}>Check your email</h1>
          <p className="lx-sub">If that account exists, we sent a secure one-time password link.</p>
          <button type="button" className="lx-login-btn" onClick={() => onDone(account!.email, account!.kind === "admin" ? "admin" : "customer")}>
            Go to login
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Public "Apply For An Account" — creates an application only, no login ── */
function ApplyFlow({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState({ companyName: "", contactName: "", email: "", phone: "", registeredAddress: "" })
  const [err, setErr]   = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr("")
    if (!form.companyName.trim() || !form.contactName.trim() || !form.email.trim()) {
      setErr("Please fill in Company Name, Contact Name and Email."); return
    }
    setBusy(true)
    try {
      await createCustomerApplication({
        companyName: form.companyName.trim(), contactName: form.contactName.trim(),
        email: form.email.trim(), phone: form.phone.trim(), registeredAddress: form.registeredAddress.trim(),
        date: new Date().toISOString().slice(0, 10),
      })
      void sendEmail(ADMIN_NOTIFY_EMAIL, `New customer application — ${form.companyName.trim()}`,
        `<p>New account application:</p>
         <p><strong>${form.companyName.trim()}</strong> — ${form.contactName.trim()}</p>
         <p>${form.email.trim()} ${form.phone.trim() ? `· ${form.phone.trim()}` : ""}</p>
         ${form.registeredAddress.trim() ? `<p>${form.registeredAddress.trim()}</p>` : ""}
         <p style="margin-top:16px">Review it from Customer Applications.</p>`, undefined, { category: 'system', communicationType: 'customer_application' })
      setDone(true)
    } catch { setErr("Couldn't submit your application — please try again.") }
    setBusy(false)
  }

  if (done) {
    return (
      <div className="lx-card">
        <AuthBrand />
        <div style={{ textAlign: "center" }}>
          <div className="lx-done-ico">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h1 className="lx-title" style={{ marginBottom: 8 }}>Application submitted!</h1>
          <p className="lx-sub">Thanks — we've received your application and will be in touch once it's been reviewed.</p>
          <button type="button" className="lx-login-btn" onClick={onBack}>Back to login</button>
        </div>
      </div>
    )
  }

  return (
    <div className="lx-card lx-card-signup">
      <AuthBrand />
      <button type="button" className="lx-back" onClick={onBack}>← Back to login</button>
      <form onSubmit={submit}>
        <h1 className="lx-title">Apply For An Account</h1>
        <p className="lx-sub">Tell us about your business — we'll review your application and set up your account.</p>
        <label className="lx-label">Company Name</label>
        <div className="lx-input-wrap">
          <input className="lx-input" placeholder="Fresh Market Ltd" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} required autoFocus />
        </div>
        <label className="lx-label">Contact Name</label>
        <div className="lx-input-wrap">
          <input className="lx-input" placeholder="Your full name" value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} required />
        </div>
        <label className="lx-label">Email</label>
        <div className="lx-input-wrap">
          <input className="lx-input" type="email" placeholder="you@company.co.uk" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
        </div>
        <label className="lx-label">Phone Number</label>
        <div className="lx-input-wrap">
          <input className="lx-input" placeholder="+44 7700 900123" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        </div>
        <label className="lx-label">Company Registered Address</label>
        <div className="lx-input-wrap">
          <input className="lx-input" placeholder="12 Market Street, Birmingham B1 1AA" value={form.registeredAddress} onChange={e => setForm({ ...form, registeredAddress: e.target.value })} />
        </div>
        {err && <p className="lx-error">{err}</p>}
        <button type="submit" className="lx-login-btn" disabled={busy}>{busy ? "Submitting…" : "Submit Application"}</button>
      </form>
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
  const [mode, setMode]         = useState<"login" | "activate" | "forgot" | "apply">("login")
  const [oauthBusy, setOauthBusy] = useState<"" | "google" | "apple">("")

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true)
    await onLogin(role, username.trim(), password)
    setLoading(false)
  }

  // Requires the provider to be enabled in the Supabase project's Auth
  // settings, and (once a session comes back) an existing admin_staff or
  // customers row already linked to that account's auth_user_id - there is
  // no self-service provisioning path for a brand-new OAuth sign-in yet.
  const signInWithProvider = async (provider: "google" | "apple") => {
    if (!supabase) { showAppError(new Error('Sign-in is not configured'), { feature: 'OAuth Login' }); return }
    setOauthBusy(provider)
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })
    if (error) { showAppError(error, { feature: 'OAuth Login', fallbackCode: 401 }); setOauthBusy("") }
  }

  return (
    <div className="lx-page">
      {/* ─── LEFT BRAND SIDE ─── */}
      <div className="lx-brand">
        {/* ambient floating fruits */}
        {FRUITS.map((f, i) => (
          <span key={i} className="lx-fruit" style={{ top: f.top, left: f.left, animationDelay: f.delay }}>
            <FruitArt kind={f.kind} size={f.size} uid={String(i)} />
          </span>
        ))}

        <div className="lx-brand-logo">
          <img src="/logo.png" alt="" />
          <span>Punjab Exotic Foods</span>
        </div>

        <div className="lx-hero" aria-hidden="true">
          <div className="lx-hero-glow" />
          <div className="lx-hero-fruits">
            {HERO_FRUITS.map((f, i) => (
              <span key={i} className="lx-hero-fruit" style={{ top: f.top, left: f.left, zIndex: f.z, animationDelay: f.delay }}>
                <FruitArt kind={f.kind} size={f.size} uid={`hero-${i}`} />
              </span>
            ))}
          </div>
          <div className="lx-stat-card lx-stat-card--income">
            <span>Total Invoiced</span>
            <strong>£17,500</strong>
            <small>▲ 12% this month</small>
          </div>
          <div className="lx-stat-card lx-stat-card--balance">
            <span>Outstanding</span>
            <strong>£1,200</strong>
            <small>3 invoices due</small>
          </div>
        </div>

        <div className="lx-visual-copy">
          <h2>Freshness, Delivered.</h2>
          <p>Punjab Exotic Foods keeps invoices, payments, stock and orders in one place — without the stress and extra steps.</p>
        </div>
        <div className="lx-brand-carousel" aria-hidden="true">
          <span className="on" /><span /><span />
        </div>
      </div>

      {/* ─── GLASS LOGIN CARD ─── */}
      <div className="lx-card-wrap">
        {mode === "activate" ? (
          <ActivateFlow
            role={role}
            onBack={() => setMode("login")}
            onDone={(em, r) => { setUsername(em); setRole(r); setMode("login") }}
          />
        ) : mode === "forgot" ? (
          <ForgotPasswordFlow
            role={role}
            onBack={() => setMode("login")}
            onDone={(em, r) => { setUsername(em); setRole(r); setMode("login") }}
          />
        ) : mode === "apply" ? (
          <ApplyFlow onBack={() => setMode("login")} />
        ) : (
        <form className="lx-card" onSubmit={submit}>
          <AuthBrand />
          <div className="lx-auth-heading">
            <h1 className="lx-title">Hi, Welcome 👋</h1>
            <p className="lx-login-subtitle">Select your portal and sign in to continue.</p>
          </div>

          <div className="lx-role-row">
            <button type="button" className={"lx-role" + (role === "customer" ? " on" : "")} onClick={() => setRole("customer")}>Customer</button>
            <button type="button" className={"lx-role" + (role === "admin" ? " on" : "")} onClick={() => setRole("admin")}>Admin</button>
          </div>

          <label className="lx-label">{role === "admin" ? "Your Email" : "Customer Number or Email"}</label>
          <div className="lx-input-wrap">
            <input
              className="lx-input lx-input-leading"
              placeholder={role === "admin" ? "you@punjabexoticfoods.com" : "CUST-001"}
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
            <span className="lx-input-leading-icon">{role === "admin" ? <Mail size={16} /> : <UsersRound size={16} />}</span>
          </div>

          <label className="lx-label">Your Password</label>
          <div className="lx-input-wrap">
            <input
              className="lx-input lx-input-leading"
              type={showPw ? "text" : "password"}
              placeholder="••••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <span className="lx-input-leading-icon"><LockKeyhole size={16} /></span>
            <button type="button" className="lx-input-icon lx-eye" onClick={() => setShowPw(v => !v)} aria-label={showPw ? "Hide password" : "Show password"}><EyeIcon open={showPw} /></button>
          </div>

          <div className="lx-row-between">
            <label className="lx-remember">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
              Remember
            </label>
            <button type="button" className="lx-forgot" onClick={() => setMode("forgot")}>Forgot password?</button>
          </div>

          {error && <p className="lx-error">{error}</p>}

          <button type="submit" className="lx-login-btn" disabled={loading}>
            {loading ? <><Spinner size={15} color="#3b2a00" /> Signing in…</> : "Log in"}
          </button>

          <div className="lx-oauth-divider">or continue with</div>
          <div className="lx-oauth-row">
            <button type="button" className="lx-oauth-btn" onClick={() => signInWithProvider("google")} disabled={oauthBusy !== ""}>
              {oauthBusy === "google" ? <Spinner size={15} /> : <GoogleIcon />} Continue with Google
            </button>
            <button type="button" className="lx-oauth-btn" onClick={() => signInWithProvider("apple")} disabled={oauthBusy !== ""}>
              {oauthBusy === "apple" ? <Spinner size={15} /> : <AppleIcon />} Continue with Apple
            </button>
          </div>

          <p className="lx-signup-note">First time here?</p>
          <button type="button" className="lx-signup-btn" onClick={() => setMode("activate")}>
            Activate your account with email
          </button>
          {role === "customer" && (
            <button type="button" className="lx-signup-btn" onClick={() => setMode("apply")}>
              Apply For An Account
            </button>
          )}
        </form>
        )}
        <small className="lx-auth-footer"><a href="/privacy">Privacy Policy</a><span>© Punjab Exotic Foods {new Date().getFullYear()}</span></small>
      </div>
    </div>
  )
}
