import type { StockItem } from "../types"

/** Stock refreshes daily at 06:00 GMT. A cycle runs 06:00 → 05:59:59 next day. */
export function currentCycleStart(now: Date = new Date()): Date {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 6, 0, 0))
  if (now < start) start.setUTCDate(start.getUTCDate() - 1)
  return start
}

export function nextCycleStart(now: Date = new Date()): Date {
  const next = new Date(currentCycleStart(now))
  next.setUTCDate(next.getUTCDate() + 1)
  return next
}

/** Latest parseable stock update timestamp, or null. */
export function latestStockUpdate(stock: StockItem[]): Date | null {
  let latest: Date | null = null
  for (const s of stock) {
    if (!s.lastUpdated) continue
    const t = new Date(s.lastUpdated)
    if (!isNaN(t.getTime()) && (!latest || t > latest)) latest = t
  }
  return latest
}

/** True when stock has been updated within the current 06:00 GMT cycle. */
export function isStockFresh(stock: StockItem[], now: Date = new Date()): boolean {
  const latest = latestStockUpdate(stock)
  return !!latest && latest >= currentCycleStart(now)
}

export function formatGmtTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" }) + " GMT"
}
