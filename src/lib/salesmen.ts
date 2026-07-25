import type { Salesman } from "../types"

/** Hardcoded for now, per spec — a real salesperson directory can replace
    this later without changing how orders/customers reference a salesman
    (they store salesmanId/salesmanName, not this list itself). */
export const SALESMEN: Salesman[] = [
  { id: "sm-16", number: "16", name: "Mohsen", code: "0908" },
]

export function verifySalesLogin(number: string, code: string): Salesman | null {
  return SALESMEN.find(s => s.number === number.trim() && s.code === code.trim()) ?? null
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
