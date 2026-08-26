import { useEffect, useState } from "react"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { SensitiveActionDialog } from "../../components/SensitiveActionDialog"
import { showAppError } from "../../lib/appDialogs"
import {
  getDatabaseResetStatus, setDatabaseResetPin, requestDatabaseResetCode, executeDatabaseReset,
  type DatabaseResetStatus,
} from "../../lib/secureAdminApi"

const TABLE_LABELS: Record<string, string> = {
  credit_note_allocations: "Credit Note Allocations", payments: "Payments", invoice_items: "Invoice Line Items",
  invoices: "Invoices", credit_notes: "Credit Notes", activity_log: "Documents & Stored PDFs",
  email_imports: "Email Import Logs", customers: "Customer Accounts",
}

/** System-Developer-only "reset business data" module. Two factors are
    required before the delete runs: a 6-digit code emailed to the System
    Developer's own address, plus a 4-digit PIN they set up here (never the
    same as their login password) - neither alone is enough. Never touches
    admin_staff, auth.users or any login/config data - see
    server/admin-actions/database-reset.js for the exact scope. */
export function DatabaseResetPage() {
  const [status, setStatus] = useState<DatabaseResetStatus | null>(null)
  const [loadError, setLoadError] = useState("")
  const [pinInput, setPinInput] = useState("")
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [savingPin, setSavingPin] = useState(false)

  const [requestingCode, setRequestingCode] = useState(false)
  const [sentTo, setSentTo] = useState("")
  const [emailCode, setEmailCode] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [confirmText, setConfirmText] = useState("")
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<{ testMode: boolean; counts: Record<string, number> } | null>(null)

  const load = () => { getDatabaseResetStatus().then(setStatus).catch(reason => setLoadError(reason instanceof Error ? reason.message : "Status could not be loaded.")) }
  useEffect(load, [])

  const savePin = async (token: string) => {
    setSavingPin(true)
    try {
      await setDatabaseResetPin(pinInput, token)
      setPinDialogOpen(false); setPinInput("")
      load()
    } catch (error) {
      showAppError(error, { feature: "Set Reset PIN" })
    } finally {
      setSavingPin(false)
    }
  }

  const requestCode = async () => {
    setRequestingCode(true); setResult(null)
    try {
      const response = await requestDatabaseResetCode()
      setSentTo(response.sentTo)
    } catch (error) {
      showAppError(error, { feature: "Request Reset Code" })
    } finally {
      setRequestingCode(false)
    }
  }

  const execute = async () => {
    setExecuting(true)
    try {
      const response = await executeDatabaseReset(emailCode, confirmPin)
      setResult(response)
      setSentTo(""); setEmailCode(""); setConfirmPin(""); setConfirmText("")
    } catch (error) {
      showAppError(error, { feature: "Execute Database Reset" })
    } finally {
      setExecuting(false)
    }
  }

  if (loadError) return <div className="stack"><p className="error-message">{loadError}</p></div>
  if (!status) return <div className="stack"><p>Loading…</p></div>

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Database Reset</h2>
        <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
          System Developer only. Permanently clears business/transactional data — customers, invoices and their documents — to start clean. Never touches admin accounts, logins, or system settings.
        </p>
      </div>

      <div className="ps-table-card" style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Step 1 — Reset PIN</h3>
        {status.pinConfigured ? (
          <p style={{ fontSize: 13.5, color: "#15803d", marginBottom: 12 }}>Your reset PIN is configured{status.pinSetAt ? ` (set ${new Date(status.pinSetAt).toLocaleDateString("en-GB")})` : ""}.</p>
        ) : (
          <p style={{ fontSize: 13.5, color: "#a16207", marginBottom: 12 }}>You haven't set up a reset PIN yet — this is required before a reset can be run.</p>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Input label={status.pinConfigured ? "New 4-digit PIN" : "Choose a 4-digit PIN"} value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" style={{ maxWidth: 140 }} />
          <Button disabled={pinInput.length !== 4} onClick={() => setPinDialogOpen(true)}>{status.pinConfigured ? "Change PIN" : "Set Up PIN"}</Button>
        </div>
      </div>

      <div className="ps-table-card" style={{ padding: 20, opacity: status.pinConfigured ? 1 : 0.5, pointerEvents: status.pinConfigured ? "auto" : "none" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Step 2 — Verify & Reset</h3>
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 14px", marginBottom: 14, fontSize: 13 }}>
          <strong style={{ color: "#b91c1c" }}>This permanently deletes:</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#7f1d1d" }}>
            {status.tables.map(t => <li key={t}>{TABLE_LABELS[t] ?? t}</li>)}
          </ul>
          <strong style={{ display: "block", marginTop: 8, color: "#15803d" }}>Admin accounts, logins and system settings are never touched.</strong>
        </div>

        {!sentTo ? (
          <Button disabled={requestingCode} onClick={requestCode}>{requestingCode ? "Sending…" : "Send Verification Code"}</Button>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            <p style={{ fontSize: 13, color: "#6b7a70" }}>Code sent to {sentTo}. It expires in 10 minutes.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Input label="6-digit email code" value={emailCode} onChange={e => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))} style={{ maxWidth: 160 }} />
              <Input label="4-digit PIN" type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))} style={{ maxWidth: 140 }} />
            </div>
            <Input label='Type "RESET" to confirm' value={confirmText} onChange={e => setConfirmText(e.target.value)} style={{ maxWidth: 200 }} />
            <div>
              <Button
                variant="danger"
                disabled={executing || emailCode.length !== 6 || confirmPin.length !== 4 || confirmText !== "RESET"}
                onClick={execute}
              >
                {executing ? "Resetting…" : "Permanently Reset Database"}
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div style={{ marginTop: 16, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px 14px" }}>
            <strong style={{ color: "#15803d" }}>Reset complete{result.testMode ? " (Test Mode sandbox)" : ""}.</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>
              {Object.entries(result.counts).map(([table, count]) => <li key={table}>{TABLE_LABELS[table] ?? table}: {count} removed</li>)}
            </ul>
          </div>
        )}
      </div>

      <SensitiveActionDialog
        open={pinDialogOpen}
        title={status.pinConfigured ? "Change Reset PIN" : "Set Up Reset PIN"}
        warning="Your login password verifies it's really you before the PIN can be changed. Keep the PIN itself different from your password — it's the second factor for permanently deleting business data."
        actionLabel={savingPin ? "Saving…" : "Verify & Save PIN"}
        onClose={() => setPinDialogOpen(false)}
        onVerified={savePin}
      />
    </div>
  )
}
