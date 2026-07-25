import type { DayTrade } from "../types"

/** The date new sales and buying should be recorded against. Normally just
    today — but once an admin closes trading for a date (Day End), the next
    trading date moves forward a day even if the real calendar hasn't
    reached it yet (e.g. closing early evening for the next morning's buying). */
export function currentTradingDate(dayTrades: DayTrade[]): string {
  const today = new Date().toISOString().slice(0, 10)
  if (dayTrades.length === 0) return today
  const lastClosed = [...dayTrades].map(d => d.date).sort().pop()!
  const next = new Date(lastClosed)
  next.setDate(next.getDate() + 1)
  const nextIso = next.toISOString().slice(0, 10)
  return nextIso > today ? nextIso : today
}
