import { useCallback, useEffect, useState } from "react"
import { Button } from "../../components/ui/Button"
import { getLoginActivity, type LoginActivityEvent } from "../../lib/secureAdminApi"
import { showAppError } from "../../lib/appDialogs"

const EVENT_LABELS: Record<string, string> = {
  login: "Login", logout: "Logout",
  password_reset_completed: "Password Reset Completed", password_changed: "Password Changed",
  admin_activated: "Admin Account Activated", admin_invited: "Admin Invited", admin_updated: "Admin Updated",
  credentials_reset: "Credentials Reset",
  identity_verified: "Identity Verified", identity_verification_failed: "Identity Verification Failed",
  session_revoked: "Session Revoked",
}

const fmt = (value: string) => new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

export function LoginActivityPage() {
  const [events, setEvents] = useState<LoginActivityEvent[]>([])
  const [suspicious, setSuspicious] = useState<Array<{ email: string; failedCount: number }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [eventType, setEventType] = useState("")
  const [email, setEmail] = useState("")
  const [success, setSuccess] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const result = await getLoginActivity({ eventType, email, success, from, to })
      setEvents(result.events)
      setSuspicious(result.suspicious)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login activity could not be loaded.")
      showAppError(err, { feature: "Login Activity" })
    } finally {
      setLoading(false)
    }
  }, [eventType, email, success, from, to])

  useEffect(() => { load() }, [load])

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Login Activity</h2>
        <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
          Authentication and security events. Entries marked <strong>Server</strong> were recorded inside an authenticated
          server flow and cannot be altered from a browser. Passwords, tokens and raw IP addresses are never stored.
        </p>
      </div>

      {suspicious.length > 0 && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 15px" }}>
          <strong style={{ color: "#991b1b", fontSize: 13.5 }}>Repeated failed attempts</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 20, color: "#991b1b", fontSize: 13 }}>
            {suspicious.map(s => <li key={s.email}>{s.email} — {s.failedCount} failures in this view</li>)}
          </ul>
        </div>
      )}

      <div className="ps-table-card">
        <div className="ps-toolbar" style={{ flexWrap: "wrap", gap: 8 }}>
          <div className="ps-toolbar-left" style={{ flexWrap: "wrap", gap: 8 }}>
            <select className="ps-tool-btn" value={eventType} onChange={e => setEventType(e.target.value)}>
              <option value="">All events</option>
              {Object.entries(EVENT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <select className="ps-tool-btn" value={success} onChange={e => setSuccess(e.target.value)}>
              <option value="">Successful &amp; failed</option>
              <option value="true">Successful only</option>
              <option value="false">Failed only</option>
            </select>
            <input className="ps-tool-btn" style={{ minWidth: 170 }} placeholder="Filter by email…" value={email} onChange={e => setEmail(e.target.value)} />
            <input className="ps-tool-btn" type="date" value={from} onChange={e => setFrom(e.target.value)} title="From date" />
            <input className="ps-tool-btn" type="date" value={to} onChange={e => setTo(e.target.value)} title="To date" />
          </div>
          <div className="ps-toolbar-right">
            <Button className="btn-sm" variant="secondary" onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</Button>
          </div>
        </div>

        {error && <p className="error-message" style={{ margin: "10px 16px" }}>{error}</p>}

        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead>
              <tr><th>When</th><th>Event</th><th>User</th><th>Role</th><th>Result</th><th>Source</th><th>Device</th></tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.id} className="ps-row">
                  <td style={{ whiteSpace: "nowrap", color: "#6b7280" }}>{fmt(ev.login_at)}</td>
                  <td>{EVENT_LABELS[ev.event_type] ?? ev.event_type}</td>
                  <td>{ev.email ?? "—"}</td>
                  <td style={{ color: "#6b7280" }}>{ev.role ?? "—"}</td>
                  <td>
                    <span className="ps-badge" style={ev.success ? { background: "#dcfce7", color: "#15803d" } : { background: "#fee2e2", color: "#b91c1c" }}>
                      {ev.success ? "Success" : "Failed"}
                    </span>
                    {!ev.success && ev.failure_code && <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 3 }}>{ev.failure_code}</div>}
                  </td>
                  <td>
                    <span className="ps-badge" style={ev.recorded_by === "server" ? { background: "#e0e7ff", color: "#4338ca" } : { background: "#f3f4f6", color: "#6b7280" }}>
                      {ev.recorded_by === "server" ? "Server" : "Client"}
                    </span>
                  </td>
                  <td style={{ color: "#9ca3af", fontSize: 11.5, maxWidth: 220 }}>{ev.user_agent_summary ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && events.length === 0 && (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>No login activity matches these filters.</div>
          )}
        </div>
      </div>
    </div>
  )
}
