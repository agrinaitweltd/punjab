/* A random, non-secret per-browser identifier for the trusted-device lock
   (items 6-16). This is NOT a credential - knowing it grants nothing by
   itself; the server always requires a valid Supabase session first, then
   either WebAuthn or the bcrypt-verified passcode. Safe to keep in
   localStorage. */
const KEY = "punjab-sysdev-device-id"

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(KEY)
    if (existing) return existing
  } catch { /* fall through to a fresh, unpersisted id */ }
  const id = crypto.randomUUID()
  try { localStorage.setItem(KEY, id) } catch { /* ignore */ }
  return id
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(ua)) return true
  return typeof window !== "undefined" && window.matchMedia?.("(max-width: 820px) and (pointer: coarse)").matches
}
