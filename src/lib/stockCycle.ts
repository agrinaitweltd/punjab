import type { StockItem } from "../types"

export const LONDON_TZ = "Europe/London"

/** Renders a real instant as its London wall-clock fields, packed into a
 *  UTC-based Date so wall-clock instants can be compared with `<`/`>=`
 *  regardless of GMT/BST. Never treat the result as a real instant. */
export function toLondonWallClock(date: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? "0")
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second")))
}

/** Stock refreshes daily at 10:00 UK local time (GMT in winter, BST in summer).
 *  A cycle runs 10:00 → 09:59:59 the next day. Returned value is a wall-clock
 *  marker for comparisons only — see toLondonWallClock. */
export function currentCycleStart(now: Date = new Date()): Date {
  const wall = toLondonWallClock(now)
  const start = new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate(), 10, 0, 0))
  if (wall < start) start.setUTCDate(start.getUTCDate() - 1)
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

/** True when stock has been updated within the current 06:00 UK-time cycle. */
export function isStockFresh(stock: StockItem[], now: Date = new Date()): boolean {
  const latest = latestStockUpdate(stock)
  return !!latest && toLondonWallClock(latest) >= currentCycleStart(now)
}

/** Formats a real instant as UK local time, e.g. "14:32". */
export function formatLondonTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", { timeZone: LONDON_TZ, hour: "2-digit", minute: "2-digit" }) + " UK time"
}

/** Formats a wall-clock marker's weekday (from currentCycleStart/nextCycleStart). */
export function formatWallWeekday(wall: Date): string {
  return wall.toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short" })
}

/** Customers can't place orders 05:00–08:00 UK time (stock is being counted
 *  and re-priced for the day) — everything else (browsing, viewing past
 *  orders, etc.) stays available. */
export function isOrderingClosed(now: Date = new Date()): boolean {
  const hour = toLondonWallClock(now).getUTCHours()
  return hour >= 5 && hour < 8
}
