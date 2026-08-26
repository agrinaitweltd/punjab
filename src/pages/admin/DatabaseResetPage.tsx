import { useEffect, useState } from "react"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { Spinner } from "../../components/ui/Spinner"
import { SensitiveActionDialog } from "../../components/SensitiveActionDialog"
import { showAppError } from "../../lib/appDialogs"
import {
  getDatabaseResetStatus, setDatabaseResetPin, verifyDatabaseResetPin, requestDatabaseResetCode, executeDatabaseReset,
  type DatabaseResetStatus,
} from "../../lib/secureAdminApi"

const TABLE_LABELS: Record<string, string> = {
  credit_note_allocations: "Credit Note Allocations", payments: "Payments", invoice_items: "Invoice Line Items",
  invoices: "Invoices", credit_notes: "Credit Notes", activity_log: "Documents & Stored PDFs",
  email_imports: "Email Import Logs", customers: "Customer Accounts",
}

type WizardStep = "pin" | "code" | "confirm"
const WIZARD_STEPS: WizardStep[] = ["pin", "code", "confirm"]

/** System-Developer-only "reset business data" module. Two factors are
    required before the delete runs: a 6-digit code emailed to the System
    Developer's own address, plus a 4-digit PIN they set up here (never the
    same as their login password) - neither alone is enough. Never touches
    admin_staff, auth.users or any login/config data - see
    server/admin-actions/database-reset.js for the exact scope.

    The reset itself runs as a guided step-by-step dialog (PIN -> checked
    immediately -> email code -> type-to-confirm) rather than one long form,
    so a System Developer can't accidentally skip ahead or submit a step
    that's already wrong. */
export function DatabaseResetPage() {
  const [status, setStatus] = useState<DatabaseResetStatus | null>(null)
  const [loadError, setLoadError] = useState("")
  const [pinInput, setPinInput] = useState("")
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [savingPin, setSavingPin] = useState(false)
  const [result, setResult] = useState<{ testMode: boolean; counts: Record<string, number> } | null>(null)

  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<WizardStep>("pin")
  const [wizardBusy, setWizardBusy] = useState(false)
  const [wizardBusyLabel, setWizardBusyLabel] = useState("")
  const [wizardError, setWizardError] = useState("")
  const [wizardPin, setWizardPin] = useState("")
  const [wizardCode, setWizardCode] = useState("")
  const [wizardSentTo, setWizardSentTo] = useState("")
  const [wizardConfirmText, setWizardConfirmText] = useState("")

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

  const openWizard = () => {
    setWizardOpen(true); setWizardStep("pin"); setWizardError(""); setWizardBusy(false)
    setWizardPin(""); setWizardCode(""); setWizardSentTo(""); setWizardConfirmText("")
    setResult(null)
  }
  const closeWizard = () => { if (!wizardBusy) setWizardOpen(false) }

  // Step 1 -> 2: check the PIN by itself first (no side effects), and only
  // once that's confirmed correct, request + send the email code - so a
  // wrong PIN never even triggers an email.
  const submitPinStep = async () => {
    setWizardBusy(true); setWizardError(""); setWizardBusyLabel("Checking PIN…")
    try {
      await verifyDatabaseResetPin(wizardPin)
      setWizardStep("code")
      setWizardBusyLabel("Sending verification code…")
      const response = await requestDatabaseResetCode()
      setWizardSentTo(response.sentTo)
    } catch (error) {
      setWizardError(error instanceof Error ? error.message : "That PIN is incorrect.")
      setWizardStep("pin")
    } finally {
      setWizardBusy(false); setWizardBusyLabel("")
    }
  }

  const resendCode = async () => {
    setWizardBusy(true); setWizardError(""); setWizardBusyLabel("Resending code…")
    try {
      const response = await requestDatabaseResetCode()
      setWizardSentTo(response.sentTo)
    } catch (error) {
      setWizardError(error instanceof Error ? error.message : "The code could not be resent.")
    } finally {
      setWizardBusy(false); setWizardBusyLabel("")
    }
  }

  const submitCodeStep = () => {
    if (wizardCode.length !== 6) return
    setWizardError(""); setWizardStep("confirm")
  }

  const submitReset = async () => {
    setWizardBusy(true); setWizardError(""); setWizardBusyLabel("Resetting…")
    try {
      const response = await executeDatabaseReset(wizardCode, wizardPin)
      setResult(response)
      setWizardOpen(false)
    } catch (error) {
      setWizardError(error instanceof Error ? error.message : "The reset could not be completed.")
    } finally {
      setWizardBusy(false); setWizardBusyLabel("")
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
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Reset PIN</h3>
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
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Reset Business Data</h3>
        <p style={{ fontSize: 13, color: "#6b7a70", marginBottom: 14 }}>
          Clears customers, invoices and their documents through a guided, three-step verification. Admin accounts, logins and system settings are never touched.
        </p>
        <Button variant="danger" onClick={openWizard}>Start Database Reset</Button>

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

      <Modal
        open={wizardOpen}
        title={wizardStep === "pin" ? "Step 1 of 3 — Enter Your PIN" : wizardStep === "code" ? "Step 2 of 3 — Verification Code" : "Step 3 of 3 — Confirm"}
        onClose={closeWizard}
      >
        <div className="stack" style={{ gap: 14 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {WIZARD_STEPS.map((step, index) => (
              <div key={step} style={{ flex: 1, height: 4, borderRadius: 2, background: index <= WIZARD_STEPS.indexOf(wizardStep) ? "#1f7a3a" : "#e5e7eb" }} />
            ))}
          </div>

          {wizardBusy && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
              <Spinner size={18} /><span style={{ fontSize: 13.5, color: "#6b7a70" }}>{wizardBusyLabel}</span>
            </div>
          )}

          {!wizardBusy && wizardStep === "pin" && (
            <>
              <p style={{ fontSize: 13.5, color: "#6b7a70" }}>Enter your 4-digit reset PIN to begin.</p>
              <Input label="4-digit PIN" type="password" value={wizardPin} onChange={e => setWizardPin(e.target.value.replace(/\D/g, "").slice(0, 4))} autoFocus />
              {wizardError && <p className="error-message">{wizardError}</p>}
              <div className="actions-row">
                <Button disabled={wizardPin.length !== 4} onClick={submitPinStep}>Next</Button>
                <Button variant="secondary" onClick={closeWizard}>Cancel</Button>
              </div>
            </>
          )}

          {!wizardBusy && wizardStep === "code" && (
            <>
              <p style={{ fontSize: 13.5, color: "#6b7a70" }}>PIN correct. A 6-digit code was sent to {wizardSentTo || "your account email"} — it expires in 10 minutes.</p>
              <Input label="6-digit email code" value={wizardCode} onChange={e => setWizardCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus />
              {wizardError && <p className="error-message">{wizardError}</p>}
              <div className="actions-row">
                <Button disabled={wizardCode.length !== 6} onClick={submitCodeStep}>Next</Button>
                <Button variant="secondary" onClick={resendCode}>Resend Code</Button>
                <Button variant="secondary" onClick={closeWizard}>Cancel</Button>
              </div>
            </>
          )}

          {!wizardBusy && wizardStep === "confirm" && (
            <>
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 14px", fontSize: 13 }}>
                <strong style={{ color: "#b91c1c" }}>This permanently deletes:</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#7f1d1d" }}>
                  {status.tables.map(t => <li key={t}>{TABLE_LABELS[t] ?? t}</li>)}
                </ul>
                <strong style={{ display: "block", marginTop: 8, color: "#15803d" }}>Admin accounts, logins and system settings are never touched.</strong>
              </div>
              <Input label='Type "RESET" to confirm' value={wizardConfirmText} onChange={e => setWizardConfirmText(e.target.value)} autoFocus />
              {wizardError && <p className="error-message">{wizardError}</p>}
              <div className="actions-row">
                <Button variant="danger" disabled={wizardConfirmText !== "RESET"} onClick={submitReset}>Permanently Reset Database</Button>
                <Button variant="secondary" onClick={() => setWizardStep("code")}>Back</Button>
                <Button variant="secondary" onClick={closeWizard}>Cancel</Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
