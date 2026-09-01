import { useEffect, useRef, useState, type ReactNode } from "react"
import { startRegistration, startAuthentication, platformAuthenticatorIsAvailable } from "@simplewebauthn/browser"
import {
  listTrustedDevices, saveTrustedDevice, webauthnRegisterOptions, webauthnRegisterVerify,
  webauthnAuthOptions, webauthnAuthVerify, setDevicePasscode, verifyDevicePasscode,
} from "../lib/secureAdminApi"
import { getOrCreateDeviceId, isMobileDevice } from "../lib/deviceId"
import { LockScreen } from "./LockScreen"
import { Button } from "./ui/Button"
import { Modal } from "./ui/Modal"

const JUST_LOGGED_IN_KEY = "punjab-sysdev-just-logged-in"
export function markSystemDeveloperJustLoggedIn() {
  try { sessionStorage.setItem(JUST_LOGGED_IN_KEY, "1") } catch { /* ignore */ }
}

// How long the tab can be hidden before returning requires re-verification
// (item 14) - short app-switches (checking a notification) shouldn't
// interrupt ordinary active use, but leaving for a while should.
const REAUTH_AFTER_HIDDEN_MS = 15_000

type Stage = "checking" | "unlocked" | "prompt-save" | "setup-passcode" | "setup-faceid" | "locked"

/** System-Developer-only trusted-device re-verification (items 6-16).
    Renders children untouched for every other role/device - normal
    admins and team members, and System Developer on desktop, see nothing
    from this component at all (item 15/17). */
export function TrustedDeviceGate({ isSystemDeveloper, staffName, children }: { isSystemDeveloper: boolean; staffName: string; children: ReactNode }) {
  const deviceId = useRef(getOrCreateDeviceId())
  const mobile = useRef(isMobileDevice())
  const [stage, setStage] = useState<Stage>("checking")
  const [faceIdAvailable, setFaceIdAvailable] = useState(false)
  const [error, setError] = useState("")
  const [faceIdBusy, setFaceIdBusy] = useState(false)
  const [lockedUntil, setLockedUntil] = useState<string | null>(null)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
  const [passcodeSetupValue, setPasscodeSetupValue] = useState("")
  const [passcodeSetupError, setPasscodeSetupError] = useState("")
  const hiddenAt = useRef<number | null>(null)

  useEffect(() => {
    if (!isSystemDeveloper || !mobile.current) { setStage("unlocked"); return }
    let active = true
    ;(async () => {
      const hasPlatformAuth = await platformAuthenticatorIsAvailable().catch(() => false)
      if (!active) return
      setFaceIdAvailable(hasPlatformAuth)
      const { devices } = await listTrustedDevices().catch(() => ({ devices: [] }))
      if (!active) return
      const mine = devices.find(d => d.id === deviceId.current)
      if (mine && (mine.hasWebAuthn || mine.hasPasscode)) { setStage("locked"); return }
      let justLoggedIn = false
      try { justLoggedIn = sessionStorage.getItem(JUST_LOGGED_IN_KEY) === "1"; sessionStorage.removeItem(JUST_LOGGED_IN_KEY) } catch { /* ignore */ }
      setStage(justLoggedIn ? "prompt-save" : "unlocked")
    })()
    return () => { active = false }
  }, [isSystemDeveloper])

  // Re-lock after a real away-period, not a quick app-switch (item 14).
  useEffect(() => {
    if (stage !== "unlocked" && stage !== "locked") return
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { hiddenAt.current = Date.now(); return }
      if (hiddenAt.current && Date.now() - hiddenAt.current > REAUTH_AFTER_HIDDEN_MS) setStage("locked")
      hiddenAt.current = null
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [stage])

  const tryFaceId = async () => {
    setFaceIdBusy(true); setError("")
    try {
      const { options } = await webauthnAuthOptions(deviceId.current)
      const response = await startAuthentication({ optionsJSON: options })
      await webauthnAuthVerify(deviceId.current, response)
      setStage("unlocked")
    } catch {
      setError("Face ID could not verify. Try again or use your passcode.")
    } finally {
      setFaceIdBusy(false)
    }
  }

  const submitPasscode = async (passcode: string) => {
    setError("")
    const result = await verifyDevicePasscode(deviceId.current, passcode).catch(() => ({ ok: false, error: "Could not verify — check your connection.", locked: false, lockedUntil: undefined, attemptsRemaining: undefined }))
    if (result.ok) { setStage("unlocked"); setLockedUntil(null); setAttemptsRemaining(null); return }
    setError(result.error || "Incorrect passcode.")
    setLockedUntil(result.locked ? result.lockedUntil || null : null)
    setAttemptsRemaining(result.attemptsRemaining ?? null)
  }

  const declineSave = () => setStage("unlocked")
  const acceptSave = async () => {
    await saveTrustedDevice(deviceId.current, mobile.current ? navigator.userAgent.slice(0, 60) : "Device")
    setStage("setup-passcode")
  }

  const submitPasscodeSetup = async () => {
    setPasscodeSetupError("")
    if (!/^\d{6}$/.test(passcodeSetupValue)) { setPasscodeSetupError("Enter exactly 6 digits."); return }
    try {
      await setDevicePasscode(deviceId.current, passcodeSetupValue)
      setPasscodeSetupValue("")
      setStage(faceIdAvailable ? "setup-faceid" : "unlocked")
    } catch {
      setPasscodeSetupError("Could not save the passcode — please try again.")
    }
  }

  const setupFaceId = async () => {
    try {
      const { options } = await webauthnRegisterOptions(deviceId.current)
      const response = await startRegistration({ optionsJSON: options })
      await webauthnRegisterVerify(deviceId.current, response)
    } catch { /* Face ID setup is optional - the passcode already works either way */ }
    setStage("unlocked")
  }

  if (stage === "checking") return null
  if (stage === "locked") {
    return <LockScreen staffName={staffName} faceIdAvailable={faceIdAvailable} faceIdBusy={faceIdBusy} onFaceId={tryFaceId} onSubmitPasscode={submitPasscode} error={error} lockedUntil={lockedUntil} attemptsRemaining={attemptsRemaining} />
  }

  return (
    <>
      {children}
      <Modal open={stage === "prompt-save"} title="Save this device?" onClose={declineSave}>
        <p style={{ fontSize: 13.5, color: "#374151" }}>
          Save this device to unlock the dashboard next time with Face ID or a 6-digit passcode instead of your full password. Your password is never stored on this device.
        </p>
        <div className="actions-row" style={{ marginTop: 14 }}>
          <Button onClick={acceptSave}>Yes, Save This Device</Button>
          <Button variant="secondary" onClick={declineSave}>Not Now</Button>
        </div>
      </Modal>

      <Modal open={stage === "setup-passcode"} title="Create a Device Passcode" onClose={() => setStage("unlocked")}>
        <p style={{ fontSize: 13.5, color: "#374151", marginBottom: 10 }}>Choose a 6-digit passcode for unlocking this device. This is separate from your account password.</p>
        <input
          type="password" inputMode="numeric" maxLength={6} value={passcodeSetupValue}
          onChange={e => setPasscodeSetupValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="6-digit passcode" className="search-input" style={{ fontSize: 20, letterSpacing: 6, textAlign: "center" }}
        />
        {passcodeSetupError && <p className="error-message" style={{ marginTop: 8 }}>{passcodeSetupError}</p>}
        <div className="actions-row" style={{ marginTop: 14 }}>
          <Button onClick={submitPasscodeSetup} disabled={passcodeSetupValue.length !== 6}>Save Passcode</Button>
        </div>
      </Modal>

      <Modal open={stage === "setup-faceid"} title="Set Up Face ID?" onClose={() => setStage("unlocked")}>
        <p style={{ fontSize: 13.5, color: "#374151" }}>Face ID is handled entirely by your device — Punjab Exotic Foods never receives your biometric data, only a success or failure result.</p>
        <div className="actions-row" style={{ marginTop: 14 }}>
          <Button onClick={setupFaceId}>Set Up Face ID</Button>
          <Button variant="secondary" onClick={() => setStage("unlocked")}>Skip</Button>
        </div>
      </Modal>
    </>
  )
}
