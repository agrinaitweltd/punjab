import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ActivityLog, Customer, Invoice } from "../../types"
import { invoiceOutstanding } from "../../lib/creditNotes"
import { DivergingBarChart, DonutChart, DonutLegend, ProgressBar, ChartSkeleton, EmptyChart } from "../../components/charts/DashboardCharts"
import { getDashboardAnalytics, resolveDateRange, type DashboardAnalytics, type DateRangeKey } from "../../lib/dashboardAnalytics"
import { showAppError } from "../../lib/appDialogs"

const RANGE_OPTIONS: Array<{ key: DateRangeKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "prevMonth", label: "Previous Month" },
  { key: "thisYear", label: "This Year" },
  { key: "custom", label: "Custom" },
]

const REFRESH_MS = 5 * 60_000
const gbp = (n: number, decimals = 2) => `£${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`

const DONUT_COLOURS = ["#2563EB", "#A9C4FB", "#E3C9F3", "#BFE9F5", "#3B82F6"]

/* ── Icons (stroke-only, 18px, matching the reference's line style) ── */
const Ico = {
  invoice: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
  wallet: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4z" /></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>,
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  send: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
  card: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>,
  folder: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  dots: <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" /></svg>,
}

function StatCard({ icon, label, value, delta, deltaTone }: {
  icon: React.ReactNode; label: string; value: string; delta?: string; deltaTone?: "up" | "down"
}) {
  return (
    <div className="fp-card fp-stat">
      <div className="fp-stat-top">
        <span className="fp-stat-ico">{icon}</span>
        <button className="fp-dots" type="button" aria-label="Options">{Ico.dots}</button>
      </div>
      <p className="fp-stat-label">{label}</p>
      <p className="fp-stat-value">{value}</p>
      {delta && <p className={`fp-stat-delta ${deltaTone ?? "up"}`}>{delta}</p>}
    </div>
  )
}

export function DashboardAnalyticsTab({ customers = [], invoices = [], activity = [], userName, onNavigate }: {
  customers?: Customer[]
  invoices?: Invoice[]
  activity?: ActivityLog[]
  userName?: string
  onNavigate?: (page: string) => void
}) {
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
      setData(await getDashboardAnalytics(range))
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analytics could not be loaded.")
      showAppError(err, { feature: "Dashboard Analytics" })
    } finally {
      inFlight.current = false
      if (showSpinner) setLoading(false)
    }
  }, [rangeKey, customStart, customEnd])

  useEffect(() => { load(true) }, [load])

  // Quiet background refresh every 5 minutes - only this one analytics
  // query re-runs, no full page reload and nothing else on the dashboard
  // is disturbed.
  useEffect(() => {
    const timer = window.setInterval(() => load(false), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const s = data?.summary

  const chartData = useMemo(() => {
    if (!data) return []
    const byPeriod = new Map<string, { period: string; up: number; down: number }>()
    for (const row of data.salesOverTime) byPeriod.set(row.period, { period: row.period, up: Number(row.value) || 0, down: 0 })
    for (const row of data.paymentsOverTime) {
      const existing = byPeriod.get(row.period) ?? { period: row.period, up: 0, down: 0 }
      existing.down = Number(row.value) || 0
      byPeriod.set(row.period, existing)
    }
    return [...byPeriod.values()]
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-12)
      .map(d => ({ ...d, period: d.period.length > 7 ? d.period.slice(5) : d.period }))
  }, [data])

  const donutSegments = useMemo(() => {
    if (!s) return []
    const paid = Math.max(0, s.totalInvoiceValue - s.outstanding)
    return [
      { label: "Outstanding", value: s.outstanding, color: DONUT_COLOURS[0] },
      { label: "Paid", value: paid, color: DONUT_COLOURS[1] },
      { label: "Credit Notes", value: s.creditNotesValue, color: DONUT_COLOURS[2] },
    ].filter(seg => seg.value > 0)
  }, [s])

  const customerById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers])
  const recentInvoices = useMemo(
    () => [...invoices].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, 6),
    [invoices],
  )
  const collectedPct = s && s.totalInvoiceValue > 0
    ? Math.round(((s.totalInvoiceValue - s.outstanding) / s.totalInvoiceValue) * 100)
    : 0

  const statusOf = (invoice: Invoice): { label: string; tone: string } => {
    if (invoiceOutstanding(invoice) <= 0) return { label: "Paid", tone: "ok" }
    if (invoice.dueDate && invoice.dueDate < new Date().toISOString().slice(0, 10)) return { label: "Overdue", tone: "bad" }
    return { label: "Open", tone: "warn" }
  }

  return (
    <div className="fp">
      {/* ── Greeting + range filter ── */}
      <div className="fp-head">
        <h2 className="fp-greeting">Hey {userName?.split(" ")[0] || "there"}, welcome back! <span>👋</span></h2>
        <div className="fp-head-right">
          {rangeKey === "custom" && (
            <div className="fp-dates">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span>to</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          )}
          <select className="fp-select" value={rangeKey} onChange={e => setRangeKey(e.target.value as DateRangeKey)}>
            {RANGE_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <button className="fp-refresh" onClick={() => load(true)} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
      {lastUpdated && <p className="fp-updated">Updated {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · refreshes automatically every 5 minutes</p>}
      {error && <div className="fp-error">{error}</div>}

      <div className="fp-grid">
        {/* ══ LEFT COLUMN ══ */}
        <div className="fp-col-left">
          <div className="fp-account">
            <span className="fp-account-ring" />
            <span className="fp-account-chip">{Ico.card}</span>
            <p className="fp-account-label">Total Receivables</p>
            <p className="fp-account-number">{s ? gbp(s.outstanding) : "—"}</p>
            <div className="fp-account-foot">
              <div><span>Customers</span><strong>{s?.totalCustomers ?? "—"}</strong></div>
              <div><span>Open</span><strong>{s?.openInvoices ?? "—"}</strong></div>
              <div><span>Overdue</span><strong>{s?.overdueInvoices ?? "—"}</strong></div>
            </div>
          </div>

          <div className="fp-actions">
            {[
              { icon: Ico.plus, label: "Add Customer", page: "customers" },
              { icon: Ico.invoice, label: "Invoice", page: "create-invoice" },
              { icon: Ico.send, label: "Payments", page: "payments" },
              { icon: Ico.folder, label: "Documents", page: "files" },
            ].map(a => (
              <button key={a.label} className="fp-action" onClick={() => onNavigate?.(a.page)}>
                <span className="fp-action-ico">{a.icon}</span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>

          <div className="fp-card fp-pad">
            <div className="fp-card-head">
              <h3 className="fp-card-title">Collection Rate</h3>
              <button className="fp-dots" type="button" aria-label="Options">{Ico.dots}</button>
            </div>
            <ProgressBar pct={collectedPct} />
            <div className="fp-limit-foot">
              <span>{s ? gbp(Math.max(0, s.totalInvoiceValue - s.outstanding), 0) : "—"} · {collectedPct}%</span>
              <span>{s ? gbp(s.totalInvoiceValue, 0) : "—"}</span>
            </div>
          </div>

          <div className="fp-card fp-pad">
            <div className="fp-card-head">
              <h3 className="fp-card-title">Top Customers</h3>
              <button className="fp-link" onClick={() => onNavigate?.("customers")}>View all</button>
            </div>
            <p className="fp-sub-label">Total Invoiced</p>
            <p className="fp-sub-value">{s ? gbp(s.totalInvoiceValue) : "—"}</p>
            <div className="fp-plans">
              {loading && !data ? <ChartSkeleton height={150} /> : (data?.topCustomers ?? []).slice(0, 3).map(c => {
                const max = data?.topCustomers?.[0]?.totalInvoiced || 1
                const pct = Math.round((c.totalInvoiced / max) * 100)
                return (
                  <div key={c.customerId} className="fp-plan">
                    <div className="fp-plan-head">
                      <span className="fp-plan-ico">{Ico.user}</span>
                      <span className="fp-plan-name">{c.name}</span>
                      <button className="fp-dots" type="button" aria-label="Options">{Ico.dots}</button>
                    </div>
                    <ProgressBar pct={pct} />
                    <div className="fp-plan-foot">
                      <span>{gbp(c.totalInvoiced, 0)} · {pct}%</span>
                      <span>{c.invoiceCount} inv</span>
                    </div>
                  </div>
                )
              })}
              {!loading && !(data?.topCustomers ?? []).length && <EmptyChart height={90} label="No customer activity in this period" />}
            </div>
          </div>
        </div>

        {/* ══ CENTRE COLUMN ══ */}
        <div className="fp-col-mid">
          <div className="fp-stats">
            {loading && !data ? (
              <><ChartSkeleton height={132} /><ChartSkeleton height={132} /><ChartSkeleton height={132} /></>
            ) : (
              <>
                <StatCard icon={Ico.invoice} label="Total Invoiced" value={s ? gbp(s.totalInvoiceValue, 0) : "—"} delta={s ? `${s.openInvoices} open invoices` : "Not available"} deltaTone="up" />
                <StatCard icon={Ico.wallet} label="Payments Received" value={s ? gbp(s.paymentsReceived, 0) : "—"} delta={s ? `${s.paidInvoices} paid invoices` : "Not available"} deltaTone="up" />
                <StatCard icon={Ico.clock} label="Outstanding" value={s ? gbp(s.outstanding, 0) : "—"} delta={s ? `${s.overdueInvoices} overdue` : "Not available"} deltaTone={(s?.overdueInvoices ?? 0) > 0 ? "down" : "up"} />
              </>
            )}
          </div>

          <div className="fp-card fp-pad">
            <div className="fp-card-head">
              <h3 className="fp-card-title">Money Statistics</h3>
              <div className="fp-legend-inline">
                <span><i style={{ background: "#2563EB" }} />Invoiced</span>
                <span><i style={{ background: "#A9C4FB" }} />Received</span>
              </div>
            </div>
            <p className="fp-sub-label">Received vs Outstanding</p>
            <p className="fp-sub-value fp-big">{s ? gbp(s.paymentsReceived - s.outstanding) : "—"}</p>
            {loading && !data ? <ChartSkeleton height={230} /> : <DivergingBarChart data={chartData} />}
          </div>

          <div className="fp-card">
            <div className="fp-card-head fp-pad-x">
              <h3 className="fp-card-title">Recent Invoices</h3>
              <button className="fp-link" onClick={() => onNavigate?.("invoices")}>View all</button>
            </div>
            <div className="fp-table-wrap">
              <table className="fp-table">
                <thead>
                  <tr><th>Customer</th><th>Date</th><th>Amount</th><th>Outstanding</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {recentInvoices.map(inv => {
                    const st = statusOf(inv)
                    const customer = customerById.get(inv.customerId)
                    return (
                      <tr key={inv.id}>
                        <td>
                          <div className="fp-td-title">{customer?.companyName ?? "Unknown customer"}</div>
                          <div className="fp-td-sub">Invoice {inv.invoiceNumber}</div>
                        </td>
                        <td className="fp-td-muted">{inv.date ?? "—"}</td>
                        <td className="fp-td-strong">{gbp(inv.amount)}</td>
                        <td className="fp-td-muted">{gbp(invoiceOutstanding(inv))}</td>
                        <td><span className={`fp-pill ${st.tone}`}>{st.label}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {recentInvoices.length === 0 && <div className="fp-empty" style={{ height: 120 }}>No invoices yet.</div>}
            </div>
          </div>
        </div>

        {/* ══ RIGHT COLUMN ══ */}
        <div className="fp-col-right">
          <div className="fp-card fp-pad">
            <div className="fp-card-head">
              <h3 className="fp-card-title">Statistics</h3>
              <button className="fp-dots" type="button" aria-label="Options">{Ico.dots}</button>
            </div>
            <div className="fp-donut-wrap">
              {loading && !data ? <ChartSkeleton height={168} /> : <DonutChart segments={donutSegments} centreLabel="Total Invoiced" />}
            </div>
            <DonutLegend segments={donutSegments} />
          </div>

          <div className="fp-card fp-pad">
            <div className="fp-card-head">
              <h3 className="fp-card-title">Top Products</h3>
              <button className="fp-link" onClick={() => onNavigate?.("products")}>View all</button>
            </div>
            <div className="fp-ranked">
              {(data?.topProducts ?? []).slice(0, 5).map((p, i) => (
                <div key={p.product} className="fp-ranked-row">
                  <span className="fp-ranked-idx">{i + 1}</span>
                  <span className="fp-ranked-name">{p.product}<em>{p.qty} units</em></span>
                  <span className="fp-ranked-value">{gbp(p.value, 0)}</span>
                </div>
              ))}
              {!loading && !(data?.topProducts ?? []).length && <EmptyChart height={80} label="No products sold in this period" />}
            </div>
          </div>

          <div className="fp-card fp-pad">
            <div className="fp-card-head">
              <h3 className="fp-card-title">Recent Activity</h3>
              <button className="fp-dots" type="button" aria-label="Options">{Ico.dots}</button>
            </div>
            <div className="fp-activity">
              {activity.slice(0, 6).map(a => (
                <div key={a.id} className="fp-activity-row">
                  <span className="fp-activity-ico">{Ico.invoice}</span>
                  <div>
                    <div className="fp-activity-text"><strong>{a.customerName}</strong> {a.action}</div>
                    <div className="fp-activity-time">{a.timestamp}</div>
                  </div>
                </div>
              ))}
              {activity.length === 0 && <EmptyChart height={80} label="No recent activity" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
