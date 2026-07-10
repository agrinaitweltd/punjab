import { useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import type { UserRole } from "../types"
import { Button } from "../components/ui/Button"
import { Input } from "../components/ui/Input"

function getSecondsUntil5AM(): number {
  const now = new Date()
  const next = new Date(now)
  next.setHours(5, 0, 0, 0)
  if (now >= next) next.setDate(next.getDate() + 1)
  return Math.floor((next.getTime() - now.getTime()) / 1000)
}

function fmt(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":")
}

export function LoginPage({
  onLogin,
  error,
}: {
  onLogin: (role: UserRole, username: string, password: string) => Promise<void>
  error: string
}) {
  const [role, setRole] = useState<UserRole>("customer")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(getSecondsUntil5AM())
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timer.current = setInterval(() => setCountdown((p) => (p <= 1 ? getSecondsUntil5AM() : p - 1)), 1000)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await onLogin(role, username.trim(), password)
    setLoading(false)
  }

  return (
    <div className="login-outer">
      <div className="login-topbar">
        <div className="login-topbar-brand">
          <div className="brand-icon" style={{ width: 38, height: 38, fontSize: 11, borderRadius: 10 }}>PEF</div>
          <div>
            <strong>Punjab Exotic Foods Ltd</strong>
            <span>Wholesale stock, tickets and payments</span>
          </div>
        </div>
        <div className="role-toggle">
          <button className={role === "customer" ? "active" : ""} onClick={() => setRole("customer")} type="button">Customer</button>
          <button className={role === "admin" ? "active" : ""} onClick={() => setRole("admin")} type="button">Admin</button>
        </div>
      </div>

      <div className="login-body">
        <div className="login-hero">
          <div className="login-hero-content">
            <p className="login-hero-eyebrow">Punjab Exotic Foods Ltd</p>
            <h2>Speed up your wholesale operations</h2>
            <p className="login-hero-subtitle">Prices Released Daily At 5:00 AM</p>
            <div className="countdown-box">
              <p className="countdown-label">Next Price Release</p>
              <div className="countdown-digits">{fmt(countdown)}</div>
              <p className="countdown-sublabel">
                Admin can keep editing prices until release.<br />
                Customers see released prices daily.
              </p>
            </div>
            <div className="partner-logos">
              <span>Fresh Daily</span>
              <span>Wholesale</span>
              <span>UK Wide Delivery</span>
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <h3>{role === "admin" ? "Admin Login" : "Customer Login"}</h3>
          <p className="subtitle">{role === "admin" ? "Sign in to the admin control centre." : "Please log in to your account to continue."}</p>
          <form onSubmit={submit} className="login-form">
            <Input label={role === "admin" ? "Username" : "Customer Number / Username"} value={username} onChange={(e) => setUsername(e.target.value)} placeholder={role === "admin" ? "admin" : "CUST-001"} required />
            <Input type="password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            {error && <p className="error-text">{error}</p>}
            <Button type="submit" disabled={loading}>{loading ? "Signing in..." : role === "admin" ? "Open Admin Portal" : "Open Customer Portal"}</Button>
          </form>
          <div className="demo-box">
            <strong>Demo credentials</strong>
            <p>Admin: admin / admin123</p>
            <p>Customer: CUST-001 / customer123</p>
          </div>
        </div>
      </div>
    </div>
  )
}