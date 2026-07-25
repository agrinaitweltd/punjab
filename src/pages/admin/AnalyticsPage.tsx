import { useMemo, useState } from "react"
import type { Order, Product } from "../../types"
import {
  completedSales, filterByRange, rangePreset, totalSales, totalProfit, profitMarginPct,
  productStats, customerStats, salesmanStats, seriesByPeriod, toProductsById,
} from "../../lib/analytics"

type Tab = "sales" | "profit" | "products" | "customers" | "salesmen" | "general"

function todayIso() { return new Date().toISOString().slice(0, 10) }

function TrendChart({ points, color = "#1f7a3a", empty }: { points: number[]; color?: string; empty: string }) {
  if (points.length < 2) return <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>{empty}</div>
  const W = 600, H = 160, pad = 10
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const range = max - min || 1
  const step = (W - pad * 2) / (points.length - 1)
  const xy = points.map((v, i) => [pad + i * step, H - pad - ((v - min) / range) * (H - pad * 2)])
  const line = xy.map(p => p.join(",")).join(" ")
  const area = `${pad},${H - pad} ${line} ${pad + (points.length - 1) * step},${H - pad}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="160" preserveAspectRatio="none" role="img">
      <defs>
        <linearGradient id="anArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#anArea)" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {xy.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#fff" stroke={color} strokeWidth="2" />)}
    </svg>
  )
}

export function AnalyticsPage({ orders, products }: { orders: Order[]; products: Product[] }) {
  const [tab, setTab] = useState<Tab>("sales")
  const [preset, setPreset] = useState<"today" | "week" | "month" | "year" | "all" | "custom">("month")
  const [customFrom, setCustomFrom] = useState(() => rangePreset("month", orders)[0])
  const [customTo, setCustomTo] = useState(todayIso())
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year">("day")

  const [from, to] = preset === "custom" ? [customFrom, customTo] : rangePreset(preset, orders)
  const rangeOrders = useMemo(() => filterByRange(orders, from, to), [orders, from, to])
  const allOrders = useMemo(() => completedSales(orders), [orders])
  const productsById = useMemo(() => toProductsById(products), [products])

  const salesTotal = totalSales(rangeOrders)
  const profitTotal = totalProfit(rangeOrders, productsById)
  const margin = profitMarginPct(salesTotal, profitTotal)

  const todayTotal = totalSales(filterByRange(orders, todayIso(), todayIso()))
  const weekTotal = totalSales(filterByRange(orders, rangePreset("week", orders)[0], todayIso()))
  const monthTotal = totalSales(filterByRange(orders, rangePreset("month", orders)[0], todayIso()))
  const allTimeTotal = totalSales(allOrders)

  const todayProfit = totalProfit(filterByRange(orders, todayIso(), todayIso()), productsById)
  const allTimeProfit = totalProfit(allOrders, productsById)

  const products_ = useMemo(() => productStats(rangeOrders, products).sort((a, b) => b.revenue - a.revenue), [rangeOrders, products])
  const bestSelling = products_.slice(0, 10)
  const slowMoving = [...products_].sort((a, b) => a.qtySold - b.qtySold).slice(0, 10)

  const customers_ = useMemo(() => customerStats(rangeOrders, products).sort((a, b) => b.sales - a.sales), [rangeOrders, products])
  const lifetimeCustomers = useMemo(() => customerStats(allOrders, products), [allOrders, products])
  const lifetimeFor = (id: string) => lifetimeCustomers.find(c => c.customerId === id)

  const salesmen_ = useMemo(() => salesmanStats(rangeOrders, products).sort((a, b) => b.sales - a.sales), [rangeOrders, products])

  const series = useMemo(() => seriesByPeriod(rangeOrders, products, period), [rangeOrders, products, period])

  const PRESETS: { key: typeof preset; label: string }[] = [
    { key: "today", label: "Today" }, { key: "week", label: "This Week" }, { key: "month", label: "This Month" },
    { key: "year", label: "This Year" }, { key: "all", label: "All Time" }, { key: "custom", label: "Custom" },
  ]

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Analytics</h2>
        <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
          Sales, profit, products, customers and salesman performance — filterable by any date range.
        </p>
      </div>

      <div className="ps-table-card" style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {PRESETS.map(p => (
            <button key={p.key} type="button" onClick={() => setPreset(p.key)}
              style={{ padding: "7px 12px", borderRadius: 8, cursor: "pointer", border: preset === p.key ? "2px solid #1f7a3a" : "1.5px solid #e5e7eb", background: preset === p.key ? "#f0fdf4" : "#fff", fontWeight: 700, fontSize: 12.5, color: preset === p.key ? "#14532d" : "#374151" }}>
              {p.label}
            </button>
          ))}
          {preset === "custom" && (
            <>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <span style={{ color: "#9ca3af" }}>→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {([
          ["sales", "Sales"], ["profit", "Profit"], ["products", "Products"],
          ["customers", "Customers"], ["salesmen", "Salesmen"], ["general", "General"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            style={{ padding: "8px 14px", borderRadius: 10, cursor: "pointer", border: tab === key ? "2px solid #1f7a3a" : "1.5px solid #e5e7eb", background: tab === key ? "#f0fdf4" : "#fff", fontWeight: 700, fontSize: 13, color: tab === key ? "#14532d" : "#374151" }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── SALES ── */}
      {tab === "sales" && (
        <div className="stack">
          <div className="ps-stats-row">
            <div className="ps-stat"><p className="ps-stat-label">Total Sales (all time)</p><p className="ps-stat-value">£{allTimeTotal.toFixed(2)}</p></div>
            <div className="ps-stat"><p className="ps-stat-label">Sales Today</p><p className="ps-stat-value">£{todayTotal.toFixed(2)}</p></div>
            <div className="ps-stat"><p className="ps-stat-label">Sales This Week</p><p className="ps-stat-value">£{weekTotal.toFixed(2)}</p></div>
            <div className="ps-stat"><p className="ps-stat-label">Sales This Month</p><p className="ps-stat-value">£{monthTotal.toFixed(2)}</p></div>
          </div>
          <div className="ps-table-card" style={{ padding: 16 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Sales in selected range ({from} → {to}): £{salesTotal.toFixed(2)} across {rangeOrders.length} sale{rangeOrders.length !== 1 ? "s" : ""}
            </p>
            <TrendChart points={series.map(s => s.sales)} empty="Not enough data in this range to chart a trend." />
          </div>
        </div>
      )}

      {/* ── PROFIT ── */}
      {tab === "profit" && (
        <div className="stack">
          <div className="ps-stats-row">
            <div className="ps-stat"><p className="ps-stat-label">Total Profit (all time)</p><p className="ps-stat-value">£{allTimeProfit.toFixed(2)}</p></div>
            <div className="ps-stat"><p className="ps-stat-label">Profit Today</p><p className="ps-stat-value">£{todayProfit.toFixed(2)}</p></div>
            <div className="ps-stat"><p className="ps-stat-label">Profit In Range</p><p className="ps-stat-value">£{profitTotal.toFixed(2)}</p></div>
            <div className="ps-stat"><p className="ps-stat-label">Profit Margin %</p><p className="ps-stat-value">{margin.toFixed(1)}%</p></div>
          </div>
          <p style={{ fontSize: 12, color: "#9ca3af" }}>
            Profit uses each product's cost price (set in Products) — items without a cost price set are treated as £0 cost until an admin fills it in.
          </p>
          <div className="ps-table-card" style={{ padding: 16 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Profit Trend</p>
            <TrendChart points={series.map(s => s.profit)} color="#f2790f" empty="Not enough data in this range to chart a trend." />
          </div>
        </div>
      )}

      {/* ── PRODUCTS ── */}
      {tab === "products" && (
        <div className="stack">
          <div className="ps-table-card">
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #eaecf0", fontWeight: 700 }}>Best Selling Products</div>
            <div className="ps-table-wrap">
              <table className="ps-table">
                <thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th><th>Profit</th></tr></thead>
                <tbody>
                  {bestSelling.map(p => (
                    <tr key={p.productId} className="ps-row">
                      <td><strong>{p.name}</strong></td><td>{p.qtySold}</td>
                      <td>£{p.revenue.toFixed(2)}</td><td>£{p.profit.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bestSelling.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No sales in this range.</div>}
            </div>
          </div>
          <div className="ps-table-card">
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #eaecf0", fontWeight: 700 }}>Slow Moving Products</div>
            <div className="ps-table-wrap">
              <table className="ps-table">
                <thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th><th>Profit</th></tr></thead>
                <tbody>
                  {slowMoving.map(p => (
                    <tr key={p.productId} className="ps-row">
                      <td><strong>{p.name}</strong></td><td>{p.qtySold}</td>
                      <td>£{p.revenue.toFixed(2)}</td><td>£{p.profit.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {slowMoving.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No sales in this range.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOMERS ── */}
      {tab === "customers" && (
        <div className="ps-table-card">
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #eaecf0", fontWeight: 700 }}>Top Customers (selected range)</div>
          <div className="ps-table-wrap">
            <table className="ps-table">
              <thead><tr><th>Customer</th><th>Sales (range)</th><th>Profit (range)</th><th>Avg Order Value</th><th>Lifetime Sales</th><th>Lifetime Profit</th></tr></thead>
              <tbody>
                {customers_.map(c => (
                  <tr key={c.customerId} className="ps-row">
                    <td><strong>{c.name}</strong></td>
                    <td>£{c.sales.toFixed(2)}</td>
                    <td>£{c.profit.toFixed(2)}</td>
                    <td>£{c.avgOrderValue.toFixed(2)}</td>
                    <td>£{(lifetimeFor(c.customerId)?.sales ?? 0).toFixed(2)}</td>
                    <td>£{(lifetimeFor(c.customerId)?.profit ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {customers_.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No sales in this range.</div>}
          </div>
        </div>
      )}

      {/* ── SALESMEN ── */}
      {tab === "salesmen" && (
        <div className="stack">
          <div className="ps-table-card">
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #eaecf0", fontWeight: 700 }}>Salesman Leaderboard (selected range)</div>
            <div className="ps-table-wrap">
              <table className="ps-table">
                <thead><tr><th>Salesman</th><th>Revenue</th><th>Profit</th><th>Orders</th><th>Avg Order Value</th><th>Customers</th><th>Products Sold</th></tr></thead>
                <tbody>
                  {salesmen_.map(s => (
                    <tr key={s.salesmanId} className="ps-row">
                      <td><strong>{s.name}</strong></td>
                      <td>£{s.sales.toFixed(2)}</td>
                      <td>£{s.profit.toFixed(2)}</td>
                      <td>{s.orderCount}</td>
                      <td>£{s.avgOrderValue.toFixed(2)}</td>
                      <td>{s.customerCount}</td>
                      <td>{s.qtySold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {salesmen_.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No sales with an assigned salesman in this range.</div>}
            </div>
          </div>
          {salesmen_.length > 1 && (
            <div className="ps-table-card" style={{ padding: 16 }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Revenue Comparison</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {salesmen_.map(s => {
                  const max = Math.max(...salesmen_.map(x => x.sales), 1)
                  return (
                    <div key={s.salesmanId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 100, fontSize: 12.5, fontWeight: 600 }}>{s.name}</span>
                      <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 6, height: 18, overflow: "hidden" }}>
                        <div style={{ width: `${(s.sales / max) * 100}%`, background: "#1f7a3a", height: "100%" }} />
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, width: 80, textAlign: "right" }}>£{s.sales.toFixed(0)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GENERAL ── */}
      {tab === "general" && (
        <div className="stack">
          <div className="ps-table-card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>Sales &amp; Profit Trend</p>
              <div style={{ display: "flex", gap: 6 }}>
                {(["day", "week", "month", "year"] as const).map(p => (
                  <button key={p} type="button" onClick={() => setPeriod(p)}
                    style={{ padding: "5px 10px", borderRadius: 6, cursor: "pointer", border: period === p ? "2px solid #1f7a3a" : "1.5px solid #e5e7eb", background: period === p ? "#f0fdf4" : "#fff", fontWeight: 700, fontSize: 11.5, color: period === p ? "#14532d" : "#374151", textTransform: "capitalize" }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <TrendChart points={series.map(s => s.sales)} empty="Not enough data in this range to chart a trend." />
          </div>
          <div className="ps-table-card">
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #eaecf0", fontWeight: 700 }}>Period Breakdown</div>
            <div className="ps-table-wrap">
              <table className="ps-table">
                <thead><tr><th>Period</th><th>Sales</th><th>Profit</th></tr></thead>
                <tbody>
                  {[...series].reverse().map(s => (
                    <tr key={s.label} className="ps-row">
                      <td>{s.label}</td><td>£{s.sales.toFixed(2)}</td><td>£{s.profit.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {series.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No sales in this range.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

