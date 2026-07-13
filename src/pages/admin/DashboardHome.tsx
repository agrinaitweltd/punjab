import { useMemo, useState } from "react"
import type { Customer, Order, Product, StockItem, ActivityLog, OrderStatus } from "../../types"
import { exportToCsv } from "../../lib/exportCsv"
import { GmtClock } from "../../components/GmtClock"
import { CountUp } from "../../components/CountUp"
import { isStockFresh, latestStockUpdate, nextCycleStart, formatGmtTime } from "../../lib/stockCycle"

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

type HomeTab = "overview" | "orders" | "customers"
type CustFilter = "all" | "active" | "inactive"

export function DashboardHome({
  customers, products, orders, stock = [], activity = [], onNavigate,
}: {
  customers: Customer[]; products: Product[]; orders: Order[]; stock?: StockItem[]; activity?: ActivityLog[]
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
      ["Order Number", "Customer", "Status", "Items", "Order Value", "Date"],
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
              Orders
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
            <span className="hd-badge"><span className="hd-dot ok" /> Active</span>
            <span className="hd-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e07c24" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {activeOrders} of {orders.length || 0} Orders
            </span>
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
            Orders {orders.length > 0 && <span className="hd-tab-count">{orders.length}</span>}
          </button>
          <button className={"hd-tab" + (tab === "customers" ? " on" : "")} onClick={() => setTab("customers")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            Customers {customers.length > 0 && <span className="hd-tab-count">{customers.length}</span>}
          </button>
        </div>
      </div>

      {/* ── Daily stock cycle banner (refreshes 06:00 GMT) ── */}
      <div className={"stk-banner " + (stockFresh ? "ok" : "due")}>
        <span className="stk-banner-ico">
          {stockFresh
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        </span>
        <div className="stk-banner-body">
          {stockFresh ? (
            <>
              <strong>Today's stock is live.</strong> Updated {stockUpdatedAt ? `at ${formatGmtTime(stockUpdatedAt)}` : "today"} — valid until {nextCycleStart().toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short" })} 06:00 GMT.
            </>
          ) : (
            <>
              <strong>Daily stock update due.</strong> Stock refreshes every day at 06:00 GMT — please update today's quantities and prices for customers.
            </>
          )}
        </div>
        <button className="stk-banner-btn" onClick={() => onNavigate?.("stock")}>
          {stockFresh ? "Review Stock" : "Update Stock Now"}
        </button>
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {tab === "overview" && (
        <>
          <div className="hr-summary">
            <div className="hr-strip">
              <div className="hr-stat"><div className="hr-stat-val"><CountUp value={activeOrders} /></div><div className="hr-stat-lab">Active Orders</div></div>
              <div className="hr-stat"><div className="hr-stat-val"><CountUp value={pendingOrders} /></div><div className="hr-stat-lab">Pending</div></div>
              <div className="hr-stat"><div className="hr-stat-val"><CountUp value={avgOrder} prefix="£" /></div><div className="hr-stat-lab">Avg Order</div></div>
              <div className="hr-stat"><div className="hr-stat-val"><CountUp value={customers.length} /></div><div className="hr-stat-lab">Customers</div></div>
              <div className="hr-stat"><div className="hr-stat-val"><CountUp value={products.length} /></div><div className="hr-stat-lab">Products</div></div>
            </div>
            <div className="hr-info-row">
              <div><div className="hr-info-lab">Order Revenue</div><div className="hr-info-val hr-money"><CountUp value={orderRevenue} prefix="£" decimals={2} /></div></div>
              <div><div className="hr-info-lab">Total Orders</div><div className="hr-info-val"><CountUp value={orders.length} /></div></div>
              <div><div className="hr-info-lab">Today (GMT)</div><div className="hr-info-val">{new Date().toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })}</div></div>
              <div><div className="hr-info-lab">Stock Status</div><div className="hr-info-val" style={{ color: stockFresh ? "#15803d" : "#b45309" }}>{stockFresh ? "Updated today" : "Update due"}</div></div>
              <div><div className="hr-info-lab">Currency</div><div className="hr-info-val">GBP (£)</div></div>
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
              <span><strong>Update Stock</strong><small>Daily 06:00 GMT refresh</small></span>
            </button>
            <button className="qa-btn" onClick={() => onNavigate?.("invoices")}>
              <span className="qa-ico" style={{ background: "#ede9fe", color: "#7c3aed" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </span>
              <span><strong>Invoices</strong><small>Billing &amp; payments</small></span>
            </button>
          </div>

          {/* stock health */}
          <div className="db-quick-section" style={{ marginBottom: 16 }}>
            <div className="db-section-head">
              <h3 className="db-section-title">Stock Health</h3>
              <button className="db-section-btn" onClick={() => onNavigate?.("stock")}>Manage Stock →</button>
            </div>
            <div className="stk-health">
              <div className="stk-pill"><span className="stk-num" style={{ color: "#15803d" }}><CountUp value={inStock} /></span> In stock</div>
              <div className="stk-pill"><span className="stk-num" style={{ color: "#b45309" }}><CountUp value={lowStockItems.length} /></span> Low stock</div>
              <div className="stk-pill"><span className="stk-num" style={{ color: "#b91c1c" }}><CountUp value={outStockItems.length} /></span> Out of stock</div>
            </div>
            {(lowStockItems.length > 0 || outStockItems.length > 0) ? (
              <div className="stk-alerts">
                {[...outStockItems, ...lowStockItems].slice(0, 4).map(s => (
                  <div key={s.id} className="stk-alert">
                    <span className="stk-alert-dot" style={{ background: s.status === "out" ? "#b91c1c" : "#b45309" }} />
                    <span className="stk-alert-name">{productName(s.productId)}</span>
                    <span className="stk-alert-meta">{s.status === "out" ? "Out of stock" : `${s.availableQuantity} boxes left`}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="db-empty" style={{ padding: "12px 4px" }}>
                {stock.length === 0 ? "No stock lines yet — add products to start tracking stock." : "All products are healthy — no low or out-of-stock alerts."}
              </div>
            )}
          </div>

          {/* section strip — quick links */}
          <div className="hd-strip-tabs">
            <button className="hd-strip-tab on" onClick={() => setTab("customers")}>Customers {customers.length > 0 && <span className="hd-tab-count">{customers.length}</span>}</button>
            <button className="hd-strip-tab" onClick={() => setTab("orders")}>Orders {orders.length > 0 && <span className="hd-tab-count">{orders.length}</span>}</button>
            <button className="hd-strip-tab" onClick={() => onNavigate?.("stock")}>Stock</button>
            <button className="hd-strip-tab" onClick={() => onNavigate?.("invoices")}>Invoices</button>
            <button className="hd-strip-tab" onClick={() => onNavigate?.("payments")}>Payments</button>
            <button className="hd-strip-tab" onClick={() => onNavigate?.("tickets")}>Support</button>
          </div>

          {/* customers found + search */}
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
            </div>
          </div>
          {customerCards(filteredCustomers.slice(0, 6))}

          {/* recent activity */}
          <div className="db-quick-section" style={{ marginTop: 16 }}>
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
                <input className="ps-search" placeholder="Search orders…" value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} />
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
              <button className="ps-tool-btn" onClick={exportOrders} title="Download orders as CSV">
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
                    <th>Order Value</th>
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
