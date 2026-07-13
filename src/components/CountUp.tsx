import { useEffect, useRef, useState } from "react"

/** Animated number that eases up to `value` — makes stats feel premium. */
export function CountUp({ value, prefix = "", suffix = "", decimals = 0, duration = 800 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number; duration?: number
}) {
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    const start = performance.now()
    let raf: number
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const current = from + (value - from) * eased
      setDisplay(current)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return (
    <>
      {prefix}
      {display.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </>
  )
}
