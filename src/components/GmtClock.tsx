import { useEffect, useState } from "react"
import { LONDON_TZ } from "../lib/stockCycle"

/** Live current date & time in UK local time (GMT/BST), updates every second. */
export function GmtClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const date = now.toLocaleDateString("en-GB", { timeZone: LONDON_TZ, weekday: "short", day: "2-digit", month: "short", year: "numeric" })
  const time = now.toLocaleTimeString("en-GB", { timeZone: LONDON_TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" })
  return (
    <span className="gmt-clock" title="Current date & time — UK local time">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      {date} · <strong>{time}</strong> UK
    </span>
  )
}
