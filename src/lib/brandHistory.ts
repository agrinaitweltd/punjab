/* Remembers which brand names have been entered for each product, so the
   Buying Desk's brand field can suggest them next time (e.g. typing
   "Primetom" for Tomatoes once means it's offered again for Tomatoes only —
   not for every other product). Stored locally per browser/device. */
const KEY = "punjab-brand-history"

function readAll(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") } catch { return {} }
}

export function brandsFor(productName: string): string[] {
  return readAll()[productName.toLowerCase()] ?? []
}

export function rememberBrand(productName: string, brand: string) {
  const clean = brand.trim()
  if (!clean) return
  const all = readAll()
  const key = productName.toLowerCase()
  const existing = all[key] ?? []
  if (existing.some(b => b.toLowerCase() === clean.toLowerCase())) return
  all[key] = [...existing, clean]
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* ignore */ }
}
