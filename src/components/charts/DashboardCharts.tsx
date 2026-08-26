import { useState } from "react"

/** Dependency-free SVG charts styled to the Finpay dashboard reference -
    matches the rest of the app's convention (AdminLine/TrendChart) of
    hand-rolled SVG rather than pulling in a charting library. */

export const FP_BLUE = "#2563EB"
export const FP_BLUE_LIGHT = "#A9C4FB"

const money = (n: number) => `£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const axisLabel = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1000) return `${n < 0 ? "-" : ""}${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}K`
  return String(Math.round(n))
}

/** The reference's "Money Statistics" chart: one bar per period, split
    across a zero line - invoiced above (dark), payments received below
    (light) - with a floating tooltip on hover. */
export function DivergingBarChart({ data, height = 230 }: {
  data: Array<{ period: string; up: number; down: number }>
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  if (!data.length) return <EmptyChart height={height} />

  const maxUp = Math.max(...data.map(d => d.up), 1)
  const maxDown = Math.max(...data.map(d => d.down), 1)
  const scaleMax = Math.max(maxUp, maxDown)
  const plotH = height - 34
  const zeroY = plotH * (maxUp / (maxUp + maxDown) || 0.5)
  const upH = zeroY, downH = plotH - zeroY
  const colW = 100 / data.length
  const barW = Math.min(60, colW * 0.42)

  const ticks = [scaleMax, scaleMax / 2, 0, -scaleMax / 2, -scaleMax]

  return (
    <div className="fp-chart-outer">
      <div className="fp-chart-axis">
        {ticks.map(t => <span key={t}>{axisLabel(t)}</span>)}
      </div>
      <div className="fp-chart-plot" style={{ height }} onMouseLeave={() => setHover(null)}>
        {ticks.map((t, i) => (
          <div key={t} className="fp-chart-gridline" style={{ top: `${(i / (ticks.length - 1)) * plotH}px` }} />
        ))}
        {data.map((d, i) => {
          const up = (d.up / scaleMax) * upH
          const down = (d.down / scaleMax) * downH
          return (
            <div
              key={d.period} className="fp-chart-col"
              style={{ left: `${i * colW}%`, width: `${colW}%` }}
              onMouseEnter={() => setHover(i)}
            >
              <div className="fp-chart-bar-up" style={{ height: Math.max(d.up > 0 ? 3 : 0, up), bottom: `${plotH - zeroY}px`, width: `${barW}%` }} />
              <div className="fp-chart-bar-down" style={{ height: Math.max(d.down > 0 ? 3 : 0, down), top: `${zeroY}px`, width: `${barW}%` }} />
              <span className="fp-chart-xlabel" style={{ top: `${plotH + 10}px` }}>{d.period}</span>
            </div>
          )
        })}
        {hover !== null && (
          <div className="fp-tooltip" style={{ left: `${(hover + 0.5) * colW}%` }}>
            <div className="fp-tooltip-title">{data[hover].period}</div>
            <div className="fp-tooltip-row"><span>Invoiced</span><strong>{money(data[hover].up)}</strong></div>
            <div className="fp-tooltip-row"><span>Received</span><strong>{money(data[hover].down)}</strong></div>
          </div>
        )}
      </div>
    </div>
  )
}

/** The reference's "Statistics" donut: thick ring with a small gap between
    segments, total in the middle, legend rendered separately below. */
export function DonutChart({ segments, size = 168, centreLabel = "Total" }: {
  segments: Array<{ label: string; value: number; color: string }>
  size?: number
  centreLabel?: string
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  if (total <= 0) return <EmptyChart height={size} label="No figures for this period" />
  const stroke = 22
  const radius = size / 2 - stroke / 2 - 2
  const cx = size / 2, cy = size / 2
  const circumference = 2 * Math.PI * radius
  const gap = 2.5
  let offset = 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="fp-donut">
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#EDF1F7" strokeWidth={stroke} />
      {segments.filter(s => s.value > 0).map(s => {
        const dash = (s.value / total) * circumference
        const el = (
          <circle
            key={s.label} cx={cx} cy={cy} r={radius} fill="none" stroke={s.color} strokeWidth={stroke}
            strokeDasharray={`${Math.max(0, dash - gap)} ${circumference - Math.max(0, dash - gap)}`}
            strokeDashoffset={-offset} transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="round"
          >
            <title>{`${s.label}: ${money(s.value)} (${((s.value / total) * 100).toFixed(0)}%)`}</title>
          </circle>
        )
        offset += dash
        return el
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" className="fp-donut-sub">{centreLabel}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" className="fp-donut-total">{money(total)}</text>
    </svg>
  )
}

/** Legend rows beneath the donut - colour chip, label + share, value on
    the right, exactly as the reference lays them out. */
export function DonutLegend({ segments }: { segments: Array<{ label: string; value: number; color: string }> }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1
  return (
    <div className="fp-legend">
      {segments.map(s => (
        <div key={s.label} className="fp-legend-row">
          <span className="fp-legend-chip" style={{ background: s.color }} />
          <span className="fp-legend-label">{s.label} <em>{((s.value / total) * 100).toFixed(0)}%</em></span>
          <span className="fp-legend-value">{money(s.value)}</span>
        </div>
      ))}
    </div>
  )
}

/** Track + fill + dot handle, matching the reference's "Daily Limit" and
    "Saving Plans" progress bars. */
export function ProgressBar({ pct, color = FP_BLUE }: { pct: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className="fp-progress">
      <div className="fp-progress-fill" style={{ width: `${clamped}%`, background: color }} />
      <span className="fp-progress-dot" style={{ left: `calc(${clamped}% - 5px)`, borderColor: color }} />
    </div>
  )
}

export function EmptyChart({ height = 120, label = "No data for this period" }: { height?: number; label?: string }) {
  return <div className="fp-empty" style={{ height }}>{label}</div>
}

export function ChartSkeleton({ height = 120 }: { height?: number }) {
  return <div className="fp-skeleton" style={{ height }} />
}
