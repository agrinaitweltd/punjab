import { useCallback, useEffect, useRef, useState } from "react"
import { CountUp } from "../../components/CountUp"
import { BarSeriesChart, DonutChart, RankedList, ChartSkeleton, EmptyChart } from "../../components/charts/DashboardCharts"
import { getDashboardAnalytics, resolveDateRange, type DashboardAnalytics, type DateRangeKey } from "../../lib/dashboardAnalytics"
import { showAppError } from "../../lib/appDialogs"

const RANGE_OPTIONS: Array<{ key: DateRangeKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "prevMonth", label: "Previous Month" },
  { key: "thisYear", label: "This Year" },
  { key: "custom", label: "Custom Range" },
]

const REFRESH_MS = 5 * 60_000

function StatCard({ label, value, prefix, decimals = 0, tone = "neutral" }: { label: string; value: number; prefix?: string; decimals?: number; tone?: "neutral" | "good" | "warn" | "bad" }) {
  return (
    <div className="ho-stat">
      <p className="ho-stat-label">{label}</p>
      <div className="ho-stat-value"><CountUp value={value} prefix={prefix} decimals={decimals} /></div>
      <div className="ho-stat-foot">
        <span className={`ho-chip ${tone}`}>{tone === "good" ? "Healthy" : tone === "warn" ? "Watch" : tone === "bad" ? "Attention" : "Live"}</span>
      </div>
    </div>
  )
}

export function DashboardAnalyticsTab({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("30d")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [data, setData] = useState<DashboardAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const inFlight = useRef(false)

  const load = useCallback(async (showSpinner = true) => {
    if (inFlight.current) return
    if (rangeKey === "custom" && (!customStart || !customEnd)) return
    inFlight.current = true
    if (showSpinner) setLoading(true)
    setError("")
    try {
      const range = resolveDateRange(rangeKey, rangeKey === "custom" ? { start: customStart, end: customEnd } : undefined)
      const result = await getDashboardAnalytics(range)
      setData(result)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analytics could not be loaded.")
      showAppError(err, { feature: "Dashboard Analytics" })
    } finally {
      inFlight.current = false
      if (showSpinner) setLoading(false)
    }
  }, [rangeKey, customStart, customEnd])

  // Initial load + on range change.
  useEffect(() => { load(true) }, [load])

  // Refresh automatically every 5 minutes without a full page/browser reload
  // - only this tab's analytics query re-runs, nothing else on the
  // dashboard is touched. A quiet background refresh (no spinner) so it
  // doesn't interrupt whoever's looking at the numbers.
  useEffect(() => {
    const timer = window.setInterval(() => load(false), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const s = data?.summary
  const outstandingSegments = s ? [
    { label: "Paid", value: Math.max(0, s.totalInvoiceValue - s.outstanding), color: "#22c55e" },
    { label: "Outstanding", value: Math.max(0, s.outstanding), color: "#f5c518" },
  ] : []

  return (
    <div className="da-wrap">
      <div className="da-toolbar">
        <div className="da-range-tabs">
          {RANGE_OPTIONS.map(opt => (
            <button key={opt.key} className={"da-range-btn" + (rangeKey === opt.key ? " active" : "")} onClick={() => setRangeKey(opt.key)}>
              {opt.label}
            </button>
          ))}
        </div>
        <div className="da-toolbar-right">
          {rangeKey === "custom" && (
            <div className="da-custom-dates">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span>to</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          )}
          <span className="da-updated">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
          <button className="db-section-btn" onClick={() => load(true)} disabled={loading}>{loading ? "Refreshing…" : "Refresh Now"}</button>
        </div>
      </div>

      {error && <p className="error-message" style={{ marginBottom: 12 }}>{error}</p>}

      {loading && !data ? (
        <div className="ho-stats">{Array.from({ length: 8 }).map((_, i) => <ChartSkeleton key={i} height={70} />)}</div>
      ) : !s ? (
        <EmptyChart label="No analytics data available yet." />
      ) : (
        <>
          <div className="ho-stats">
            <StatCard label="Total Customers" value={s.totalCustomers} />
            <StatCard label="Total Invoice Value" value={s.totalInvoiceValue} prefix="£" decimals={2} />
            <StatCard label="Payments Received" value={s.paymentsReceived} prefix="£" decimals={2} tone="good" />
            <StatCard label="Current Outstanding" value={s.outstanding} prefix="£" decimals={2} tone={s.outstanding > 0 ? "warn" : "good"} />
            <StatCard label="Paid Invoices" value={s.paidInvoices} tone="good" />
            <StatCard label="Open Invoices" value={s.openInvoices} />
            <StatCard label="Overdue Invoices" value={s.overdueInvoices} tone={s.overdueInvoices > 0 ? "bad" : "good"} />
            <StatCard label="Credit Notes" value={s.creditNotesValue} prefix="£" decimals={2} />
            <StatCard label="Documents Imported Today" value={s.documentsImportedToday} />
          </div>

          <div className="ho-grid">
            <div className="ho-left">
              <div className="ho-card">
                <div className="ho-card-head">
                  <span className="ho-card-title">Sales / Invoice Value Over Time</span>
                  <button className="db-section-btn" onClick={() => onNavigate?.("invoices")}>View Invoices →</button>
                </div>
                <BarSeriesChart data={data.salesOverTime} color="#1f7a3a" />
              </div>

              <div className="ho-charts">
                <div className="ho-card">
                  <div className="ho-card-head"><span className="ho-card-title">Payments Over Time</span></div>
                  <BarSeriesChart data={data.paymentsOverTime} color="#0ea5e9" height={140} />
                </div>
                <div className="ho-card">
                  <div className="ho-card-head"><span className="ho-card-title">Credit Notes Over Time</span></div>
                  <BarSeriesChart data={data.creditNotesOverTime} color="#e05c2a" height={140} />
                </div>
              </div>

              <div className="ho-card">
                <div className="ho-card-head"><span className="ho-card-title">Most Purchased Products</span><span className="ho-card-sub">By goods value in range</span></div>
                <RankedList rows={data.topProducts.map(p => ({ label: p.product, value: p.value, secondary: `${p.qty} units` }))} />
              </div>

              <div className="ho-card">
                <div className="ho-card-head"><span className="ho-card-title">Customer Growth</span><span className="ho-card-sub">New accounts created in range</span></div>
                <BarSeriesChart data={data.customerGrowth} color="#8b5cf6" height={120} />
              </div>
            </div>

            <div className="ho-side">
              <div className="ho-card">
                <div className="ho-card-head"><span className="ho-card-title">Outstanding vs Paid</span><span className="ho-card-sub">Invoices in range</span></div>
                <DonutChart segments={outstandingSegments} />
              </div>

              <div className="ho-card">
                <div className="ho-card-head"><span className="ho-card-title">Biggest Customers</span><span className="ho-card-sub">By total invoiced in range</span></div>
                <RankedList rows={data.topCustomers.map(c => ({ label: c.name, value: c.totalInvoiced, secondary: `${c.invoiceCount} invoices` }))} />
              </div>

              <div className="ho-card">
                <div className="ho-card-head"><span className="ho-card-title">Credit Notes by Customer</span></div>
                <RankedList rows={data.creditNotesByCustomer.map(c => ({ label: c.name, value: c.value }))} />
              </div>

              <div className="ho-card">
                <div className="ho-card-head"><span className="ho-card-title">Most Credited Products</span></div>
                {/* Credit-note line items preserve their true sign from the
                    source document (negative = a genuine reduction) - shown
                    here as a positive magnitude since the section heading
                    already establishes these are credits, not charges. */}
                <RankedList rows={data.creditedProducts.map(p => ({ label: p.product, value: Math.abs(p.value), secondary: `${Math.abs(p.qty)} units` }))} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
