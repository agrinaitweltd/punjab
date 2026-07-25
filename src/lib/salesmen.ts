import type { Salesman } from "../types"

/** Offline/dev fallback — a real "Sales Users" directory lives in the
    database once Supabase is connected (see api/miscApi.ts getSalesmen). */
export const SALESMEN: Salesman[] = [
  { id: "sm-1", number: "1", username: "mohsen", name: "Mohsen", code: "0908" },
]

export function verifySalesLogin(number: string, username: string, code: string, roster: Salesman[] = SALESMEN): Salesman | null {
  return roster.find(s =>
    s.number === number.trim() &&
    s.username.toLowerCase() === username.trim().toLowerCase() &&
    s.code === code.trim()
  ) ?? null
}

const SESSION_KEY = "punjab-sales-login"

export function loadSalesLogin(): Salesman | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Salesman) : null
  } catch { return null }
}

export function saveSalesLogin(salesman: Salesman) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(salesman)) } catch { /* ignore */ }
}

export function clearSalesLogin() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
}
