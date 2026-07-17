/* "Remember this device" — lets a user unlock with a short PIN instead of
   retyping their full password every time, on THIS browser only.
   The real credentials are encrypted with a key derived from the PIN via
   Web Crypto (PBKDF2 + AES-GCM) before being written to localStorage, so
   the PIN itself is never stored anywhere. */

const STORAGE_KEY = "punjab-device-account"

export type DeviceAccount = {
  role: "admin" | "customer"
  displayName: string
  usernameOrEmail: string
  salt: string   // base64
  iv: string     // base64
  cipher: string // base64
}

function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0))
}

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"])
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 120_000, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  )
}

export async function saveDeviceAccount(
  pin: string,
  account: { role: "admin" | "customer"; displayName: string; usernameOrEmail: string; password: string },
): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(pin, salt)
  const enc = new TextEncoder()
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, enc.encode(account.password))
  const record: DeviceAccount = {
    role: account.role, displayName: account.displayName, usernameOrEmail: account.usernameOrEmail,
    salt: toB64(salt.buffer as ArrayBuffer), iv: toB64(iv.buffer as ArrayBuffer), cipher: toB64(cipherBuf),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
}

export function getDeviceAccount(): DeviceAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as DeviceAccount : null
  } catch { return null }
}

export function forgetDeviceAccount(): void {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

/** Attempts to recover the plaintext password using the given PIN. Returns
 *  null if the PIN is wrong (AES-GCM auth tag fails to verify). */
export async function unlockDeviceAccount(pin: string): Promise<string | null> {
  const rec = getDeviceAccount()
  if (!rec) return null
  try {
    const key = await deriveKey(pin, fromB64(rec.salt))
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(rec.iv) as BufferSource }, key, fromB64(rec.cipher) as BufferSource)
    return new TextDecoder().decode(plainBuf)
  } catch {
    return null // wrong PIN
  }
}

export function hasBeenPromptedToRemember(): boolean {
  try { return localStorage.getItem("punjab-device-remember-prompted") === "1" } catch { return false }
}
export function markPromptedToRemember(): void {
  try { localStorage.setItem("punjab-device-remember-prompted", "1") } catch { /* ignore */ }
}
