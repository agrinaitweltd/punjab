import { useMemo, useState } from "react"
import type { Customer, Order, Product, ActivityLog, OrderStatus } from "../../types"
import { exportToCsv } from "../../lib/exportCsv"

const PAGE_SIZE = 8

type SortMode = "recent" | "value-desc" | "value-asc"
const SORT_LABELS: Record<SortMode, string> = {
  "recent": "Newest first",
  "value-desc": "Value: high → low",
  "value-asc": "Value: low → high",
}
const STATUS_FILTERS: (OrderStatus | "All")[] = ["All", "Pending", "Confirmed", "Preparing", "Delivered", "Cancelled"]

function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "#c3c9d2" }}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

function StatCard({ label, value, delta, deltaColor, sub, onClick }: {
  label: string; value: string; delta?: string; deltaColor?: string; sub?: string; onClick?: () => void
}) {
  return (
    <div className="db-stat" onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      <div className="db-stat-head">
        <span className="db-stat-label">{label}</span>
        <InfoIcon />
      </div>
      <div className="db-stat-value">{value}</div>
      <div className="db-stat-sub">
        {sub ?? "vs last month"}
        {delta && <span className="db-stat-delta" style={{ color: deltaColor ?? "#16a34a" }}>{delta}</span>}
      </div>
    </div>
  )
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Pending:   { bg: "#fef9c3", color: "#a16207" },
  Confirmed: { bg: "#dbeafe", color: "#1d4ed8" },
  Preparing: { bg: "#ede9fe", color: "#7c3aed" },
  Delivered: { bg: "#dcfce7", color: "#15803d" },
  Cancelled: { bg: "#fee2e2", color: "#b91c1c" },
}

const AVATAR_COLORS = ["#22913f", "#3b82f6", "#8b5cf6", "#e05c2a", "#0ea5e9"]

export function DashboardHome({
  customers, products, orders, onNavigate,
}: {
  customers: Customer[]; products: Product[]; orders: Order[]; activity?: ActivityLog[]
  onNavigate?: (page: string) => void
}) {
  const [showStats, setShowStats]   = useState(true)
  const [query, setQuery]           = useState("")
  const [page, setPage]             = useState(1)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [sortMode, setSortMode]     = useState<SortMode>("recent")
  const [statusIdx, setStatusIdx]   = useState(0)

  const statusFilter = STATUS_FILTERS[statusIdx]

  const activeOrders  = orders.filter(o => o.status !== "Delivered" && o.status !== "Cancelled").length
  const pendingOrders = orders.filter(o => o.status === "Pending").length
  const orderRevenue  = orders.reduce((s, o) => s + o.amount, 0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = orders.filter(o =>
      (statusFilter === "All" || o.status === statusFilter) &&
      (!q || `${o.customerName} ${o.orderNumber} ${o.status}`.toLowerCase().includes(q))
    )
    list = [...list].sort((a, b) => {
      if (sortMode === "value-desc") return b.amount - a.amount
      if (sortMode === "value-asc")  return a.amount - b.amount
      return b.date.localeCompare(a.date) // recent
    })
    return list
  }, [orders, query, statusFilter, sortMode])

  const cycleSort = () => {
    const modes: SortMode[] = ["recent", "value-desc", "value-asc"]
    setSortMode(m => modes[(modes.indexOf(m) + 1) % modes.length])
    setPage(1)
  }
  const cycleStatus = () => {
    setStatusIdx(i => (i + 1) % STATUS_FILTERS.length)
    setPage(1)
  }
  const exportOrders = () => {
    exportToCsv(
      "orders",
      ["Order Number", "Customer", "Status", "Items", "Order Value", "Date"],
      filtered.map(o => [o.orderNumber, o.customerName, o.status, o.items.length, o.amount.toFixed(2), o.date]),
    )
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paginated   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

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

  return (
    <div className="ps-wrap">
      {/* ── Page Header ── */}
      <div className="ps-header">
        <div>
          <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
          <h2 className="ps-title">Dashboard</h2>
        </div>
        <div className="ps-header-actions">
          <button className="ps-icon-btn" title="Customise" onClick={() => onNavigate?.("settings")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 0 4.93 19.07M4.93 4.93a10 10 0 0 0 14.14 14.14"/></svg>
          </button>
          <button className="ps-icon-btn" title="Notifications" onClick={() => onNavigate?.("tickets")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </button>
          <button className="db-primary-btn" onClick={() => onNavigate?.("orders")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Order
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="ps-toolbar">
        <div className="ps-toolbar-left">
          <button className="ps-tool-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Table View
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div className="ps-toolbar-divider" />
          <button className={"ps-tool-btn" + (statusFilter !== "All" ? " ps-tool-active" : "")} onClick={cycleStatus} title="Cycle status filter">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            {statusFilter === "All" ? "Filter" : statusFilter}
          </button>
          <button className={"ps-tool-btn" + (sortMode !== "recent" ? " ps-tool-active" : "")} onClick={cycleSort} title={SORT_LABELS[sortMode]}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            Sort
          </button>
          <label className="ps-toggle-row">
            Show Statistics
            <button
              className={"ps-toggle" + (showStats ? " on" : "")}
              onClick={() => setShowStats(v => !v)}
              type="button"
              aria-label="Toggle statistics"
            >
              <span className="ps-toggle-knob" />
            </button>
          </label>
        </div>
        <div className="ps-toolbar-right">
          <div className="ps-search-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="ps-search" placeholder="Search orders, customers…" value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} />
          </div>
          <button className="ps-tool-btn" onClick={() => onNavigate?.("stats")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
            Customise
          </button>
          <button className="ps-tool-btn" onClick={exportOrders} title="Download orders as CSV">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      {showStats && (
        <div className="ps-stats-row">
          <StatCard label="Total Customers" value={String(customers.length)} delta={`+${Math.max(1, Math.ceil(customers.length * 0.08))} new`} onClick={() => onNavigate?.("customers")} />
          <StatCard label="Products" value={String(products.length)} delta="↑ 3%" onClick={() => onNavigate?.("products")} />
          <StatCard label="Order Revenue" value={`£${orderRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`} delta="↑ 9%" onClick={() => onNavigate?.("orders")} />
          <StatCard label="Active Orders" value={String(activeOrders)} delta={`${pendingOrders} pending`} deltaColor="#f59e0b" onClick={() => onNavigate?.("orders")} />
        </div>
      )}

      {/* ── Table ── */}
      <div className="ps-table-card">
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
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <div style={{ fontWeight: 600, marginBottom: 4, color: "#374151" }}>No orders found</div>
              <div style={{ fontSize: 13 }}>Orders will appear here once customers start placing them.</div>
            </div>
          )}
        </div>

        {/* ── Selection bar ── */}
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

        {/* ── Pagination ── */}
        <div className="ps-pagination">
          <div className="ps-page-size">
            Showing {paginated.length} of {filtered.length}
          </div>
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
          <div className="ps-go-page">
            Page {safePage} of {totalPages}
          </div>
        </div>
      </div>
    </div>
  )
}
