/** Small, dependency-free SVG charts for the dashboard analytics redesign -
    matches the rest of the app's convention (AdminLine/TrendChart) of hand-
    rolled SVG rather than pulling in a charting library. */

export function BarSeriesChart({ data, height = 180, color = "var(--green-500)" }: { data: Array<{ period: string; value: number }>; height?: number; color?: string }) {
  if (!data.length) return <EmptyChart height={height} />
  const max = Math.max(...data.map(d => d.value), 1)
  const width = Math.max(data.length * 34, 280)
  const barWidth = Math.min(24, width / data.length - 8)
  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={width} height={height + 24} viewBox={`0 0 ${width} ${height + 24}`}>
        {data.map((d, i) => {
          const x = i * (width / data.length) + (width / data.length - barWidth) / 2
          const barHeight = Math.max(2, (d.value / max) * height)
          return (
            <g key={d.period}>
              <rect x={x} y={height - barHeight} width={barWidth} height={barHeight} rx={4} fill={color} opacity={0.9}>
                <title>{`${d.period}: £${d.value.toFixed(2)}`}</title>
              </rect>
              <text x={x + barWidth / 2} y={height + 16} textAnchor="middle" fontSize={9} fill="var(--text-muted)">
                {d.period.length > 7 ? d.period.slice(5) : d.period}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function DonutChart({ segments, size = 160 }: { segments: Array<{ label: string; value: number; color: string }>; size?: number }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const radius = size / 2 - 14
  const cx = size / 2, cy = size / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0
  if (total <= 0) return <EmptyChart height={size} />
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--border-light)" strokeWidth={16} />
        {segments.filter(s => s.value > 0).map(s => {
          const fraction = s.value / total
          const dash = fraction * circumference
          const circle = (
            <circle
              key={s.label} cx={cx} cy={cy} r={radius} fill="none" stroke={s.color} strokeWidth={16}
              strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset} transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt"
            >
              <title>{`${s.label}: £${s.value.toFixed(2)} (${(fraction * 100).toFixed(0)}%)`}</title>
            </circle>
          )
          offset += dash
          return circle
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={13} fontWeight={800} fill="var(--text-heading)">£{total.toFixed(0)}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={9} fill="var(--text-muted)">Total</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, display: "inline-block" }} />
            <span style={{ color: "var(--text-muted)" }}>{s.label}</span>
            <strong style={{ color: "var(--text-heading)" }}>£{s.value.toFixed(2)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RankedList({ rows }: { rows: Array<{ label: string; sub?: string; value: number; secondary?: string }> }) {
  if (!rows.length) return <EmptyChart height={80} />
  const max = Math.max(...rows.map(r => r.value), 1)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r, i) => (
        <div key={r.label + i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
            <span style={{ color: "var(--text-heading)", fontWeight: 700 }}>{i + 1}. {r.label}{r.sub ? <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · {r.sub}</span> : null}</span>
            <span style={{ color: "var(--text-heading)", fontWeight: 700 }}>£{r.value.toFixed(2)}{r.secondary ? <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> ({r.secondary})</span> : null}</span>
          </div>
          <div style={{ height: 6, borderRadius: 4, background: "var(--border-light)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.max(3, (r.value / max) * 100)}%`, background: "var(--brand-gradient)", borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function EmptyChart({ height = 120, label = "No data for this period" }: { height?: number; label?: string }) {
  return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12.5, border: "1px dashed var(--border)", borderRadius: 10 }}>
      {label}
    </div>
  )
}

export function ChartSkeleton({ height = 120 }: { height?: number }) {
  return <div style={{ height, borderRadius: 10, background: "linear-gradient(90deg, var(--border-light) 25%, #f1f4f2 37%, var(--border-light) 63%)", backgroundSize: "400% 100%", animation: "dash-shimmer 1.4s ease infinite" }} />
}
