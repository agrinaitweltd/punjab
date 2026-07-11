import type { Customer, Order, Product, ActivityLog } from "../../types"

function StatCard({ label, value, delta, color, onClick }: { label: string; value: string; delta?: string; color?: string; onClick?: () => void }) {
  return (
    <div className="cd-stat" onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <p className="cd-stat-label">{label}</p>
        <button style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16 }}>⋮</button>
      </div>
      <div className="cd-stat-value">{value}</div>
      {delta && (
        <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 700, color: color ?? "#16a34a" }}>
          {delta}
        </div>
      )}
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

export function DashboardHome({
  customers, products, orders, onNavigate,
}: {
  customers: Customer[]; products: Product[]; orders: Order[]; activity?: ActivityLog[]
  onNavigate?: (page: string) => void
}) {
  const openBalance   = customers.reduce((s, c) => s + c.balance, 0)
  const activeOrders  = orders.filter(o => o.status !== "Delivered" && o.status !== "Cancelled").length
  const pendingOrders = orders.filter(o => o.status === "Pending").length

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Page header */}
      <div className="cd-header">
        <div>
          <h2 className="cd-title">Overview</h2>
          <p className="cd-subtitle">Punjab Exotic Foods — Admin Control Centre</p>
        </div>
        <div style={{ display: "flex", gap: 10, paddingBottom: 14 }}>
          <button className="cd-import-btn" onClick={() => onNavigate?.("export")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Export
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="cd-stats-strip" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <StatCard label="Total Customers" value={String(customers.length)} onClick={() => onNavigate?.("customers")} />
        <StatCard label="Products" value={String(products.length)} onClick={() => onNavigate?.("products")} />
        <StatCard label="Open Balance" value={`£${openBalance.toFixed(2)}`} delta="▲ +9% vs last month" />
        <StatCard label="Active Orders" value={String(activeOrders)} delta={`${pendingOrders} pending`} color="#f59e0b" onClick={() => onNavigate?.("orders")} />
      </div>

      {/* Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <button className="card" style={{ padding: "16px 18px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }} onClick={() => onNavigate?.("customers")}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", color: "#15803d" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>Add Customer</div>
            <div style={{ fontSize: 11.5, color: "#6b7280" }}>Create new account</div>
          </div>
        </button>
        <button className="card" style={{ padding: "16px 18px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }} onClick={() => onNavigate?.("products")}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d4ed8" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>Add Product</div>
            <div style={{ fontSize: 11.5, color: "#6b7280" }}>New stock item</div>
          </div>
        </button>
        <button className="card" style={{ padding: "16px 18px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }} onClick={() => onNavigate?.("orders")}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#fef9c3", display: "flex", alignItems: "center", justifyContent: "center", color: "#a16207" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>New Order</div>
            <div style={{ fontSize: 11.5, color: "#6b7280" }}>Place an order</div>
          </div>
        </button>
        <button className="card" style={{ padding: "16px 18px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }} onClick={() => onNavigate?.("admins")}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", color: "#7c3aed" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>Manage Admins</div>
            <div style={{ fontSize: 11.5, color: "#6b7280" }}>Add staff accounts</div>
          </div>
        </button>
      </div>

      {/* Tabs */}
      <div className="cd-tabs">
        {["Overview","Orders","Customers","Activity"].map((t, i) => (
          <button key={t} className={"cd-tab" + (i === 0 ? " active" : "")}>{t}</button>
        ))}
      </div>

      {/* Filter row */}
      <div className="cd-filter-row">
        <div style={{ display: "flex", gap: 8 }}>
          <span className="cd-chip">All time <button className="cd-chip-x">×</button></span>
          <span className="cd-chip">All Status <button className="cd-chip-x">×</button></span>
          <button className="cd-more-filters">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            More filters
          </button>
        </div>
        <div className="cd-search-wrap">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="cd-search" placeholder="Search orders, customers…" />
        </div>
      </div>

      {/* Orders table */}
      <div className="cd-table-card">
        <table className="cd-table">
          <thead><tr>
            <th style={{ width: 36 }}><input type="checkbox" /></th>
            <th>Customer</th>
            <th>Status</th>
            <th>About</th>
            <th>Items</th>
            <th>Order Value</th>
            <th>Fulfilment</th>
          </tr></thead>
          <tbody>
            {orders.slice(0, 8).map(order => {
              const sc = STATUS_COLORS[order.status] ?? { bg: "#f3f4f6", color: "#6b7280" }
              const pct = order.status === "Delivered" ? 100 : order.status === "Preparing" ? 65 : order.status === "Confirmed" ? 35 : 10
              return (
                <tr key={order.id} className="cd-row">
                  <td><input type="checkbox" /></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: "#22913f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                        {order.customerName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#111827", fontSize: 13.5 }}>{order.customerName}</div>
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>{order.orderNumber}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="cd-status-badge" style={{ background: sc.bg, color: sc.color }}>
                      {order.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: "#6b7280" }}>
                    {order.items.length} product{order.items.length > 1 ? "s" : ""} ordered<br />
                    <span style={{ fontSize: 12 }}>Placed {order.date}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {[0,1,2].map(i => (
                        <div key={i} style={{ width: 26, height: 26, borderRadius: "50%", background: ["#22913f","#3b82f6","#8b5cf6"][i], border: "2px solid #fff", marginLeft: i ? -8 : 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 700 }}>
                          {String.fromCharCode(65+i)}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td><strong>£{order.amount.toFixed(2)}</strong></td>
                  <td>
                    <div style={{ width: 80, height: 6, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: sc.color, borderRadius: 99 }} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {orders.length === 0 && (
          <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No orders yet</div>
            <div style={{ fontSize: 13 }}>Orders will appear here once customers start placing them.</div>
          </div>
        )}
        <div className="cd-table-footer">
          <button className="cd-prev-btn">← Previous</button>
          <span style={{ fontSize: 13, color: "#6b7280" }}>Page 1 of {Math.ceil(orders.length / 8) || 1}</span>
          <button className="cd-prev-btn">Next →</button>
        </div>
      </div>
    </div>
  )
}