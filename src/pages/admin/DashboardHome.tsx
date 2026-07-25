import { useMemo, useState } from "react"
import type { Customer, Order, Product, StockItem, ActivityLog, OrderStatus, Invoice } from "../../types"
import { exportToCsv } from "../../lib/exportCsv"
import { GmtClock } from "../../components/GmtClock"
import { CountUp } from "../../components/CountUp"
import { isStockFresh, latestStockUpdate, nextCycleStart, formatLondonTime, formatWallWeekday } from "../../lib/stockCycle"

const PAGE_SIZE = 8

type SortMode = "recent" | "value-desc" | "value-asc"
const SORT_LABELS: Record<SortMode, string> = {
  "recent": "Newest first",
  "value-desc": "Value: high → low",
  "value-asc": "Value: low → high",
}
const STATUS_FILTERS: (OrderStatus | "All")[] = ["All", "Pending", "Confirmed", "Preparing", "Delivered", "Cancelled"]

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Pending:   { bg: "#fef9c3", color: "#a16207" },
  Confirmed: { bg: "#dbeafe", color: "#1d4ed8" },
  Preparing: { bg: "#ede9fe", color: "#7c3aed" },
  Delivered: { bg: "#dcfce7", color: "#15803d" },
  Cancelled: { bg: "#fee2e2", color: "#b91c1c" },
}

const AVATAR_COLORS = ["#22913f", "#3b82f6", "#8b5cf6", "#e05c2a", "#0ea5e9"]

/* Hostay-style stat card with delta chip */
function HoStat({ label, value, delta, up }: { label: string; value: React.ReactNode; delta: string; up?: boolean }) {
  return (
    <div className="ho-stat">
      <p className="ho-stat-label">{label}</p>
      <div className="ho-stat-value">{value}</div>
      <div className="ho-stat-foot">
        <span className={"ho-chip " + (up ? "up" : "down")}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">{up ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}</svg>
          {delta}
        </span>
        <span className="ho-foot-note">from last week</span>
      </div>
    </div>
  )
}

/* Lightweight SVG line/area chart */
function AdminLine({ points, color = "#1f7a3a", empty }: { points: number[]; color?: string; empty: string }) {
  if (points.length < 2) return <div className="ho-empty">{empty}</div>
  const W = 300, H = 110, pad = 6
  const max = Math.max(...points, 1)
  const step = (W - pad * 2) / (points.length - 1)
  const xy = points.map((v, i) => [pad + i * step, H - pad - (v / max) * (H - pad * 2)])
  const line = xy.map(p => p.join(",")).join(" ")
  const area = `${pad},${H - pad} ${line} ${pad + (points.length - 1) * step},${H - pad}`
  const gid = "hoArea" + color.replace("#", "")
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="120" preserveAspectRatio="none" role="img">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {xy.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#fff" stroke={color} strokeWidth="2" />)}
    </svg>
  )
}

type HomeTab = "overview" | "orders" | "customers"
type CustFilter = "all" | "active" | "inactive"

export function DashboardHome({
  customers, products, orders, stock = [], activity = [], invoices = [], onNavigate,
}: {
  customers: Customer[]; products: Product[]; orders: Order[]; stock?: StockItem[]; activity?: ActivityLog[]
  invoices?: Invoice[]
  onNavigate?: (page: string) => void
}) {
  const [tab, setTab]               = useState<HomeTab>("overview")
  const [query, setQuery]           = useState("")
  const [page, setPage]             = useState(1)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [sortMode, setSortMode]     = useState<SortMode>("recent")
  const [statusIdx, setStatusIdx]   = useState(0)
  const [dense, setDense]           = useState(false)
  const [custQuery, setCustQuery]   = useState("")
  const [custFilter, setCustFilter] = useState<CustFilter>("all")

  const statusFilter = STATUS_FILTERS[statusIdx]

  const activeOrders  = orders.filter(o => o.status !== "Delivered" && o.status !== "Cancelled").length
  const pendingOrders = orders.filter(o => o.status === "Pending").length
  const orderRevenue  = orders.reduce((s, o) => s + o.amount, 0)
  const avgOrder      = orders.length ? orderRevenue / orders.length : 0

  const totalBusiness = invoices.reduce((s, i) => s + i.amount, 0)
  const totalPaid     = invoices.reduce((s, i) => s + (i.amountPaid ?? (i.status === "Paid" ? i.amount : 0)), 0)
  const totalOutstanding = Math.max(0, totalBusiness - totalPaid)
  const paidPct = totalBusiness > 0 ? Math.round((totalPaid / totalBusiness) * 100) : 0

  /* per-day series for the overview charts */
  const byDay: Record<string, { n: number; rev: number }> = {}
  for (const o of orders) { byDay[o.date] = byDay[o.date] ?? { n: 0, rev: 0 }; byDay[o.date].n++; byDay[o.date].rev += o.amount }
  const days = Object.keys(byDay).sort().slice(-10)
  const orderSeries = days.map(d => byDay[d].n)
  const revSeries   = days.map(d => byDay[d].rev)

  const stockFresh     = isStockFresh(stock)
  const stockUpdatedAt = latestStockUpdate(stock)
  const inStock        = stock.filter(s => s.status === "available").length
  const lowStockItems  = stock.filter(s => s.status === "low")
  const outStockItems  = stock.filter(s => s.status === "out")
  const productName    = (id: string) => products.find(p => p.id === id)?.productName ?? "Unknown product"

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = orders.filter(o =>
      (statusFilter === "All" || o.status === statusFilter) &&
      (!q || `${o.customerName} ${o.orderNumber} ${o.status}`.toLowerCase().includes(q))
    )
    list = [...list].sort((a, b) => {
      if (sortMode === "value-desc") return b.amount - a.amount
      if (sortMode === "value-asc")  return a.amount - b.amount
      return b.date.localeCompare(a.date)
    })
    return list
  }, [orders, query, statusFilter, sortMode])

  const filteredCustomers = useMemo(() => {
    const q = custQuery.trim().toLowerCase()
    return customers.filter(c =>
      (custFilter === "all" || c.status === custFilter) &&
      (!q || `${c.companyName} ${c.customerNumber} ${c.deliveryArea}`.toLowerCase().includes(q))
    )
  }, [customers, custQuery, custFilter])

  const cycleSort = () => {
    const modes: SortMode[] = ["recent", "value-desc", "value-asc"]
    setSortMode(m => modes[(modes.indexOf(m) + 1) % modes.length])
    setPage(1)
  }
  const cycleStatus = () => {
    setStatusIdx(i => (i + 1) % STATUS_FILTERS.length)
    setPage(1)
  }
  const cycleCustFilter = () => {
    const modes: CustFilter[] = ["all", "active", "inactive"]
    setCustFilter(f => modes[(modes.indexOf(f) + 1) % modes.length])
  }
  const exportOrders = () => {
    exportToCsv(
      "orders",
      ["Sale Number", "Customer", "Status", "Items", "Sale Value", "Date"],
      filtered.map(o => [o.orderNumber, o.customerName, o.status, o.items.length, o.amount.toFixed(2), o.date]),
    )
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const toggleRow = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }
  const toggleAll = () => {
    if (paginated.every(o => selected.has(o.id))) {
      const next = new Set(selected)
      paginated.forEach(o => next.delete(o.id))
      setSelected(next)
    } else {
      const next = new Set(selected)
      paginated.forEach(o => next.add(o.id))
      setSelected(next)
    }
  }

  const customerCards = (list: Customer[]) => (
    <div className="hr-cards hr-cards-3">
      {list.map((customer, i) => (
        <div key={customer.id} className="hr-card">
          <div className="hr-card-top">
            <div className="hr-card-av" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
              {customer.companyName.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="hr-card-name">{customer.companyName}</div>
              <div className="hr-card-sub"><span className="star">★</span> {customer.customerNumber}</div>
            </div>
          </div>
          <div className="hr-boxes">
            <div className="hr-box">
              <div className="hr-box-val">{customer.deliveryArea || "—"}</div>
              <div className="hr-box-lab">Delivery Area</div>
            </div>
            <div className="hr-box">
              <div className="hr-box-val">£{customer.balance.toLocaleString("en-GB")}</div>
              <div className="hr-box-lab">Balance</div>
            </div>
          </div>
          <div className="hr-card-btns">
            <button className="hr-btn" onClick={() => onNavigate?.("invoices")}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Invoices
            </button>
            <button className="hr-btn" onClick={() => onNavigate?.("orders")}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Sales
            </button>
          </div>
          <div className={"hr-card-note " + (customer.status === "active" ? "ok" : "warn")}>
            {customer.status === "active" ? `Active — ${customer.paymentTerms}` : "Account inactive"}
          </div>
        </div>
      ))}
      {list.length === 0 && (
        <div className="db-empty" style={{ gridColumn: "1 / -1" }}>
          {customers.length === 0
            ? "No customers yet — add your first customer from the Customer page."
            : "No customers match your search."}
        </div>
      )}
    </div>
  )

  return (
    <div className="ps-wrap">
      {/* ── Page head (hireus style) ── */}
      <div className="hd-head">
        <p className="hd-crumb">Punjab Exotic Foods Control Centre</p>
        <div className="hd-title-row">
          <h2 className="hd-title">Wholesale Operations</h2>
          <span className="hd-tag">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>
            Food Wholesale
          </span>
          <div className="hd-right">
            <GmtClock />
            <button className="hd-badge" onClick={() => onNavigate?.("settings")} title="Portal settings">
              <span className="hd-dot ok" /> Active
            </button>
            <button className="hd-badge" onClick={() => setTab("orders")} title="View sales">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e07c24" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {activeOrders} of {orders.length || 0} Orders
            </button>
            <button className="hd-dots" title="Settings" onClick={() => onNavigate?.("settings")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
            </button>
          </div>
        </div>
        <div className="hd-tabs">
          <button className={"hd-tab" + (tab === "overview" ? " on" : "")} onClick={() => setTab("overview")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
            Overview
          </button>
          <button className={"hd-tab" + (tab === "orders" ? " on" : "")} onClick={() => setTab("orders")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
            Sales {orders.length > 0 && <span className="hd-tab-count">{orders.length}</span>}
          </button>
          <button className={"hd-tab" + (tab === "customers" ? " on" : "")} onClick={() => setTab("customers")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            Customers {customers.length > 0 && <span className="hd-tab-count">{customers.length}</span>}
          </button>
        </div>
      </div>

      {/* ── Daily stock cycle banner (refreshes 06:00 UK time) ── */}
      <div className={"stk-banner " + (stockFresh ? "ok" : "due")}>
        <span className="stk-banner-ico">
          {stockFresh
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        </span>
        <div className="stk-banner-body">
          {stockFresh ? (
            <>
              <strong>Today's stock is live.</strong> Updated {stockUpdatedAt ? `at ${formatLondonTime(stockUpdatedAt)}` : "today"} — valid until {formatWallWeekday(nextCycleStart())} 06:00 UK time.
            </>
          ) : (
            <>
              <strong>Daily stock update due.</strong> Stock refreshes every day at 06:00 UK time — please update today's quantities and prices for customers.
            </>
          )}
        </div>
        <button className="stk-banner-btn" onClick={() => onNavigate?.(stockFresh ? "stock" : "session")}>
          {stockFresh ? "Review Stock" : "Go to Buying Desk"}
        </button>
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {tab === "overview" && (
        <>
          <div className="ho-stats">
            <HoStat label="Total Revenue" value={<CountUp value={orderRevenue} prefix="£" decimals={0} />} delta="+3.4%" up />
            <HoStat label="New Sales" value={<CountUp value={pendingOrders} />} delta="+2.2%" up />
            <HoStat label="Active Sales" value={<CountUp value={activeOrders} />} delta="+1.5%" up />
            <HoStat label="Avg Order" value={<CountUp value={avgOrder} prefix="£" />} delta="+0.9%" up />
          </div>

          <div className="ho-card" style={{ marginBottom: 18 }}>
            <div className="ho-card-head">
              <span className="ho-card-title">Total Business Done</span>
              <button className="db-section-btn" onClick={() => onNavigate?.("invoices")}>View Invoices →</button>
            </div>
            <div className="ho-card-big"><CountUp value={totalBusiness} prefix="£" decimals={2} /></div>
            <div className="ho-seg">
              {totalBusiness > 0 ? (<>
                <span style={{ width: `${paidPct}%`, background: "#22c55e" }} />
                <span style={{ width: `${100 - paidPct}%`, background: "#f59e0b" }} />
              </>) : <span style={{ width: "100%", background: "#e5e7eb" }} />}
            </div>
            <div className="ho-legend">
              <span><i style={{ background: "#22c55e" }} /> £{totalPaid.toFixed(2)} Paid ({paidPct}%)</span>
              <span><i style={{ background: "#f59e0b" }} /> £{totalOutstanding.toFixed(2)} Outstanding</span>
            </div>
          </div>

          <div className="ho-grid">
            <div className="ho-left">
              <div className="ho-charts">
                <div className="ho-card">
                  <div className="ho-card-head">
                    <span className="ho-card-title">Sales</span>
                    <span className="ho-card-sub">Last {days.length || 0} days</span>
                  </div>
                  <div className="ho-card-big"><CountUp value={orders.length} /></div>
                  <AdminLine points={orderSeries} color="#1f7a3a" empty="Orders will chart here once customers start ordering" />
                </div>
                <div className="ho-card">
                  <div className="ho-card-head">
                    <span className="ho-card-title">Revenue</span>
                    <span className="ho-card-sub">Last {days.length || 0} days</span>
                  </div>
                  <div className="ho-card-big"><CountUp value={orderRevenue} prefix="£" decimals={2} /></div>
                  <AdminLine points={revSeries} color="#f2790f" empty="Revenue will chart here once orders come in" />
                </div>
              </div>

          {/* quick actions */}
          <div className="qa-row">
            <button className="qa-btn" onClick={() => onNavigate?.("customers")}>
              <span className="qa-ico" style={{ background: "#e8f8ec", color: "#1f7a3a" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              </span>
              <span><strong>Add Customer</strong><small>Create a trade login</small></span>
            </button>
            <button className="qa-btn" onClick={() => onNavigate?.("products")}>
              <span className="qa-ico" style={{ background: "#dbeafe", color: "#1d4ed8" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              </span>
              <span><strong>Add Product</strong><small>New produce line</small></span>
            </button>
            <button className="qa-btn" onClick={() => onNavigate?.("stock")}>
              <span className="qa-ico" style={{ background: "#fef3c7", color: "#b45309" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              </span>
              <span><strong>Update Stock</strong><small>Daily 06:00 UK time refresh</small></span>
            </button>
            <button className="qa-btn" onClick={() => onNavigate?.("invoices")}>
              <span className="qa-ico" style={{ background: "#ede9fe", color: "#7c3aed" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </span>
              <span><strong>Invoices</strong><small>Billing &amp; payments</small></span>
            </button>
          </div>

            </div>

            <div className="ho-side">
              <div className="ho-card">
                <div className="ho-card-head">
                  <span className="ho-card-title">Stock Occupancy</span>
                  <button className="db-section-btn" onClick={() => onNavigate?.("stock")}>Manage →</button>
                </div>
                <div className="ho-card-big"><CountUp value={stock.length} /> <span className="ho-card-unit">stock lines</span></div>
                <div className="ho-seg">
                  {stock.length > 0 ? (<>
                    <span style={{ width: `${(inStock / stock.length) * 100}%`, background: "#22c55e" }} />
                    <span style={{ width: `${(lowStockItems.length / stock.length) * 100}%`, background: "#f5c518" }} />
                    <span style={{ width: `${(outStockItems.length / stock.length) * 100}%`, background: "#d93025" }} />
                  </>) : <span style={{ width: "100%", background: "#e5e7eb" }} />}
                </div>
                <div className="ho-legend">
                  <span><i style={{ background: "#22c55e" }} /> {inStock} In stock</span>
                  <span><i style={{ background: "#f5c518" }} /> {lowStockItems.length} Low</span>
                  <span><i style={{ background: "#d93025" }} /> {outStockItems.length} Out</span>
                </div>
                {(outStockItems.length > 0 || lowStockItems.length > 0) && (
                  <div className="stk-alerts" style={{ marginTop: 12 }}>
                    {[...outStockItems, ...lowStockItems].slice(0, 3).map(s => (
                      <div key={s.id} className="stk-alert">
                        <span className="stk-alert-dot" style={{ background: s.status === "out" ? "#b91c1c" : "#b45309" }} />
                        <span className="stk-alert-name">{productName(s.productId)}</span>
                        <span className="stk-alert-meta">{s.status === "out" ? "Out" : `${s.availableQuantity} left`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

          {/* recent activity */}
          <div className="db-quick-section">
            <div className="db-section-head">
              <h3 className="db-section-title">Recent Activity</h3>
              <button className="db-section-btn" onClick={() => onNavigate?.("stats")}>View All →</button>
            </div>
            <div className="db-activity-list">
              {activity.slice(0, 5).map((a, i) => (
                <div key={a.id} className="db-activity-item">
                  <span className="db-activity-dot" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }} />
                  <div className="db-activity-body">
                    <div className="db-activity-action"><strong>{a.customerName}</strong> — {a.action}</div>
                    <div className="db-activity-time">{a.timestamp}</div>
                  </div>
                </div>
              ))}
              {activity.length === 0 && <div className="db-empty">No recent activity yet.</div>}
            </div>
          </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ CUSTOMERS TAB ═══ */}
      {tab === "customers" && (
        <>
          <div className="hr-found-row">
            <span className="hr-found">{filteredCustomers.length} customer{filteredCustomers.length !== 1 ? "s" : ""} found</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div className="ps-search-wrap" style={{ padding: "7px 12px" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input className="ps-search" placeholder="Search customers…" value={custQuery} onChange={e => setCustQuery(e.target.value)} />
              </div>
              <button className={"ps-tool-btn" + (custFilter !== "all" ? " ps-tool-active" : "")} onClick={cycleCustFilter} title="Filter by account status">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                {custFilter === "all" ? "Filters" : custFilter === "active" ? "Active" : "Inactive"}
              </button>
              <button className="ps-tool-btn" onClick={() => onNavigate?.("customers")}>Manage Customers</button>
            </div>
          </div>
          {customerCards(filteredCustomers)}
        </>
      )}

      {/* ═══ ORDERS TAB ═══ */}
      {tab === "orders" && (
        <>
          <div className="hr-found-row">
            <span className="hr-found">{filtered.length} order{filtered.length !== 1 ? "s" : ""} found</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div className="ps-search-wrap" style={{ padding: "7px 12px" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input className="ps-search" placeholder="Search sales…" value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} />
              </div>
              <button className={"ps-tool-btn" + (statusFilter !== "All" ? " ps-tool-active" : "")} onClick={cycleStatus} title="Cycle status filter">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                {statusFilter === "All" ? "Filter" : statusFilter}
              </button>
              <button className={"ps-tool-btn" + (sortMode !== "recent" ? " ps-tool-active" : "")} onClick={cycleSort} title={SORT_LABELS[sortMode]}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                Sort
              </button>
              <button className={"ps-tool-btn ps-hide-mobile" + (dense ? " ps-tool-active" : "")} onClick={() => setDense(d => !d)} title="Toggle row density">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                {dense ? "Compact" : "Comfortable"}
              </button>
              <button className="ps-tool-btn" onClick={exportOrders} title="Download sales as CSV">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export
              </button>
            </div>
          </div>

          <div className={"ps-table-card" + (dense ? " ps-table-dense" : "")}>
            <div className="ps-table-wrap">
              <table className="ps-table">
                <thead>
                  <tr>
                    <th className="ps-th-check">
                      <input type="checkbox" checked={paginated.length > 0 && paginated.every(o => selected.has(o.id))} onChange={toggleAll} />
                    </th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>About</th>
                    <th>Team</th>
                    <th>Sale Value</th>
                    <th>Fulfilment</th>
                    <th className="ps-th-plus">+</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(order => {
                    const sc = STATUS_COLORS[order.status] ?? { bg: "#f3f4f6", color: "#6b7280" }
                    const pct = order.status === "Delivered" ? 100 : order.status === "Preparing" ? 65 : order.status === "Confirmed" ? 35 : 10
                    const isSelected = selected.has(order.id)
                    return (
                      <tr key={order.id} className={isSelected ? "ps-row ps-row-selected" : "ps-row"}>
                        <td className="ps-td-check">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleRow(order.id)} />
                        </td>
                        <td>
                          <div className="ps-product-cell">
                            <div className="ps-product-avatar" style={{ background: "#e8f8ec", color: "#1a5c2d" }}>
                              {order.customerName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="ps-product-name">{order.customerName}</div>
                              <div className="ps-product-variety">{order.orderNumber}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="ps-badge" style={{ background: sc.bg, color: sc.color }}>{order.status}</span>
                        </td>
                        <td style={{ color: "#6b7280", fontSize: 13 }}>
                          {order.items.length} product{order.items.length !== 1 ? "s" : ""} ordered
                          <div style={{ fontSize: 12, color: "#9ca3af" }}>Placed {order.date}</div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center" }}>
                            {[0, 1, 2].map(i => (
                              <div key={i} style={{ width: 26, height: 26, borderRadius: "50%", background: AVATAR_COLORS[i], border: "2px solid #fff", marginLeft: i ? -8 : 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 700 }}>
                                {String.fromCharCode(65 + i)}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td><strong>£{order.amount.toFixed(2)}</strong></td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 70, height: 6, background: "#eef0f3", borderRadius: 99, overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: sc.color, borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>{pct}%</span>
                          </div>
                        </td>
                        <td />
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {paginated.length === 0 && (
                <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#c3c9d2" strokeWidth="1.6" style={{ marginBottom: 8 }}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>
                  <div style={{ fontWeight: 600, marginBottom: 4, color: "#374151" }}>No orders found</div>
                  <div style={{ fontSize: 13 }}>Orders will appear here once customers start placing them.</div>
                </div>
              )}
            </div>

            {selected.size > 0 && (
              <div className="ps-selection-bar">
                <span className="ps-sel-count">{selected.size} Selected</span>
                <div className="ps-sel-divider" />
                <button className="ps-sel-btn" onClick={() => onNavigate?.("orders")}>Update Status</button>
                <div className="ps-sel-divider" />
                <button className="ps-sel-btn" onClick={() => onNavigate?.("invoices")}>Create Invoice</button>
                <div className="ps-sel-divider" />
                <button className="ps-sel-btn ps-sel-danger" onClick={() => setSelected(new Set())}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  Clear
                </button>
                <button className="ps-sel-close" onClick={() => setSelected(new Set())}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            )}

            <div className="ps-pagination">
              <div className="ps-page-size">Showing {paginated.length} of {filtered.length}</div>
              <div className="ps-page-nav">
                <button className="ps-pager" onClick={() => setPage(1)} disabled={safePage === 1}>&laquo;</button>
                <button className="ps-pager" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>&lsaquo;</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(n => (
                  <button key={n} className={"ps-pager" + (n === safePage ? " ps-pager-active" : "")} onClick={() => setPage(n)}>{n}</button>
                ))}
                {totalPages > 5 && <span className="ps-pager-ellipsis">…</span>}
                {totalPages > 5 && (
                  <button className={"ps-pager" + (safePage === totalPages ? " ps-pager-active" : "")} onClick={() => setPage(totalPages)}>{totalPages}</button>
                )}
                <button className="ps-pager" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>&rsaquo;</button>
                <button className="ps-pager" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>&raquo;</button>
              </div>
              <div className="ps-go-page">Page {safePage} of {totalPages}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
