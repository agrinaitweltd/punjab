import { useEffect, useMemo, useState } from "react"
import { AppLayout } from "../../components/layout/AppLayout"
import { getProducts } from "../../api/productsApi"
import { createOrder, getOrders } from "../../api/ordersApi"
import { createTicket, getInvoices, getPayments, getTickets } from "../../api/miscApi"
import { getStock } from "../../api/stockApi"
import type { Invoice, Order, Payment, Product, StockItem, SupportTicket, User } from "../../types"
import { Button } from "../../components/ui/Button"
import { Input, TextArea } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"

const STATUS_COLORS: Record<string, string> = {
  Pending: "#f59e0b", Confirmed: "#3b82f6", Preparing: "#8b5cf6",
  Delivered: "#22c55e", Cancelled: "#ef4444",
}
const STOCK_COLORS: Record<string, string> = {
  available: "#22c55e", low: "#f59e0b", out: "#ef4444",
}

function Avatar({ name, color }: { name: string; color?: string }) {
  const bg = color ?? "#22913f"
  return (
    <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}
function AvatarStack({ count }: { count: number }) {
  const colors = ["#22913f","#3b82f6","#8b5cf6","#f59e0b","#ef4444"]
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
        <div key={i} style={{ width: 26, height: 26, borderRadius: "50%", background: colors[i], border: "2px solid #fff", marginLeft: i ? -8 : 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 700 }}>
          {String.fromCharCode(65 + i)}
        </div>
      ))}
      {count > 3 && <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#f3f4f6", border: "2px solid #fff", marginLeft: -8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#6b7280", fontWeight: 700 }}>+{count - 3}</div>}
    </div>
  )
}
function ProgressBar({ pct, color }: { pct: number; color?: string }) {
  return (
    <div style={{ width: 80, height: 6, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: color ?? "#22913f", borderRadius: 99 }} />
    </div>
  )
}
function StatCard({ label, value, delta, positive, children }: { label: string; value: string; delta?: string; positive?: boolean; children?: React.ReactNode }) {
  return (
    <div className="cd-stat">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <p className="cd-stat-label">{label}</p>
        <button style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16 }}>⋮</button>
      </div>
      <div className="cd-stat-value">{value}</div>
      {delta && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <span className={positive ? "cd-delta-pos" : "cd-delta-neg"}>{positive ? "▲" : "▼"} {delta}</span>
          {children}
        </div>
      )}
    </div>
  )
}

const TABS = ["overview","stock","orders","tickets","balance"] as const
type Tab = typeof TABS[number]

export function CustomerPortal({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [tab, setTab]                   = useState<Tab>("overview")
  const [current, setCurrent]           = useState("dashboard")
  const [products, setProducts]         = useState<Product[]>([])
  const [stock, setStock]               = useState<StockItem[]>([])
  const [orders, setOrders]             = useState<Order[]>([])
  const [invoices, setInvoices]         = useState<Invoice[]>([])
  const [payments, setPayments]         = useState<Payment[]>([])
  const [tickets, setTickets]           = useState<SupportTicket[]>([])
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [search, setSearch]             = useState("")
  const [showOrder, setShowOrder]       = useState(false)
  const [showTicket, setShowTicket]     = useState(false)
  const [selProd, setSelProd]           = useState("")
  const [qty, setQty]                   = useState("1")
  const [ticketSubject, setTicketSubject] = useState("")
  const [ticketMsg, setTicketMsg]       = useState("")

  const load = async () => {
    const [p, s, o, inv, pay, tix] = await Promise.all([
      getProducts(), getStock(), getOrders(), getInvoices(), getPayments(), getTickets()
    ])
    setProducts(p); setStock(s); setOrders(o); setInvoices(inv); setPayments(pay); setTickets(tix)
    setSelProd(p[0]?.id ?? "")
  }
  useEffect(() => { load() }, [])

  const myOrders  = useMemo(() => orders.filter(o => o.customerId === user.id), [orders, user.id])
  const myTickets = useMemo(() => tickets.filter(t => t.customerId === user.id), [tickets, user.id])
  const myBalance = invoices.filter(i => i.status !== "Paid").reduce((s, i) => s + i.amount, 0)
  const stockMap  = useMemo(() => { const m: Record<string, StockItem> = {}; for (const s of stock) m[s.productId] = s; return m }, [stock])

  const filteredOrders = useMemo(() => {
    return myOrders.filter(o => {
      if (statusFilter && o.status !== statusFilter) return false
      if (search && !`${o.orderNumber} ${o.customerName}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [myOrders, statusFilter, search])

  const activeStock = stock.filter(s => s.status !== "out")

  const page = () => {
    switch (tab) {
      // ── OVERVIEW ──────────────────────────────────────────
      case "overview": return (
        <div className="cd-content">
          {/* stat strip */}
          <div className="cd-stats-strip">
            <StatCard label="Total Orders" value={String(myOrders.length)} delta="+20%" positive>
              <AvatarStack count={3} />
            </StatCard>
            <StatCard label="Balance Owing" value={`£${myBalance.toFixed(2)}`} delta="+15%" positive />
            <StatCard label="Open Tickets" value={String(myTickets.filter(t => t.status === "Open").length)} delta="Active" positive />
          </div>

          {/* filter row */}
          <div className="cd-filter-row">
            <div style={{ display: "flex", gap: 8 }}>
              <span className="cd-chip">All time <button className="cd-chip-x">×</button></span>
              {statusFilter && <span className="cd-chip">{statusFilter} <button className="cd-chip-x" onClick={() => setStatusFilter("")}>×</button></span>}
              <button className="cd-more-filters">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                More filters
              </button>
            </div>
            <div className="cd-search-wrap">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="cd-search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* orders table */}
          <div className="cd-table-card">
            <table className="cd-table">
              <thead><tr>
                <th style={{ width: 36 }}><input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(filteredOrders.map(o => o.id)) : new Set())} /></th>
                <th>Order</th>
                <th>Status</th>
                <th>Details</th>
                <th>Items</th>
                <th>Value</th>
                <th>Fulfilment</th>
              </tr></thead>
              <tbody>
                {filteredOrders.map(order => {
                  const isSelected = selected.has(order.id)
                  const pct = order.status === "Delivered" ? 100 : order.status === "Preparing" ? 65 : order.status === "Confirmed" ? 35 : 10
                  return (
                    <tr key={order.id} className={isSelected ? "cd-row selected" : "cd-row"}>
                      <td><input type="checkbox" checked={isSelected} onChange={() => { const s = new Set(selected); isSelected ? s.delete(order.id) : s.add(order.id); setSelected(s) }} /></td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={order.orderNumber} color="#22913f" />
                          <div>
                            <div style={{ fontWeight: 600, color: "#111827", fontSize: 13.5 }}>{order.orderNumber}</div>
                            <div style={{ fontSize: 12, color: "#9ca3af" }}>{order.date}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="cd-status-badge" style={{ background: STATUS_COLORS[order.status] + "20", color: STATUS_COLORS[order.status] }}>{order.status}</span></td>
                      <td style={{ fontSize: 13, color: "#6b7280" }}>{order.items.length} product{order.items.length > 1 ? "s" : ""}</td>
                      <td><AvatarStack count={order.items.length + 1} /></td>
                      <td><strong>£{order.amount.toFixed(2)}</strong></td>
                      <td><ProgressBar pct={pct} color={STATUS_COLORS[order.status]} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredOrders.length === 0 && <div style={{ padding: "32px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No orders found</div>}
            <div className="cd-table-footer">
              <button className="cd-prev-btn">← Previous</button>
              <span style={{ fontSize: 13, color: "#6b7280" }}>Page 1 of 1</span>
              <button className="cd-prev-btn">Next →</button>
            </div>
          </div>
        </div>
      )

      // ── DAILY STOCK ───────────────────────────────────────
      case "stock": return (
        <div className="cd-content">
          <div className="cd-stats-strip">
            <StatCard label="Available Products" value={String(activeStock.length)} delta="+7%" positive />
            <StatCard label="Low Stock Items"    value={String(stock.filter(s => s.status === "low").length)} />
            <StatCard label="Out of Stock"       value={String(stock.filter(s => s.status === "out").length)} delta="-2%" />
          </div>
          <div className="cd-table-card">
            <table className="cd-table">
              <thead><tr>
                <th>Product</th>
                <th>Variety / Size</th>
                <th>Price per Box</th>
                <th>Available</th>
                <th>Status</th>
                <th>Stock Level</th>
              </tr></thead>
              <tbody>
                {products.map(p => {
                  const s = stockMap[p.id]
                  if (!s) return null
                  const pct = Math.min(100, (s.availableQuantity / 100) * 100)
                  return (
                    <tr key={p.id} className="cd-row">
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={p.productName} color={STOCK_COLORS[s.status] + "cc"} />
                          <div>
                            <div style={{ fontWeight: 600, color: "#111827", fontSize: 13.5 }}>{p.productName}</div>
                            <div style={{ fontSize: 12, color: "#9ca3af" }}>{p.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>{p.variety}<br/><span style={{ color: "#9ca3af" }}>{p.size}</span></td>
                      <td><strong>£{s.price.toFixed(2)}</strong></td>
                      <td>{s.availableQuantity} boxes</td>
                      <td><span className="cd-status-badge" style={{ background: STOCK_COLORS[s.status] + "18", color: STOCK_COLORS[s.status] }}>{s.status === "available" ? "In Stock" : s.status === "low" ? "Low Stock" : "Out of Stock"}</span></td>
                      <td><ProgressBar pct={pct} color={STOCK_COLORS[s.status]} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )

      // ── ORDERS ─────────────────────────────────────────────
      case "orders": return (
        <div className="cd-content">
          <div className="cd-table-card">
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #eaecf0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>All Orders ({myOrders.length})</span>
              <Button onClick={() => setShowOrder(true)}>+ Place Order</Button>
            </div>
            <table className="cd-table">
              <thead><tr><th>Order #</th><th>Date</th><th>Products</th><th>Amount</th><th>Status</th><th>Progress</th></tr></thead>
              <tbody>
                {myOrders.map(o => {
                  const pct = o.status === "Delivered" ? 100 : o.status === "Preparing" ? 65 : o.status === "Confirmed" ? 35 : 10
                  return (
                    <tr key={o.id} className="cd-row">
                      <td><strong>{o.orderNumber}</strong></td>
                      <td style={{ color: "#6b7280" }}>{o.date}</td>
                      <td>{o.items.length} item{o.items.length > 1 ? "s" : ""}</td>
                      <td><strong>£{o.amount.toFixed(2)}</strong></td>
                      <td><span className="cd-status-badge" style={{ background: STATUS_COLORS[o.status] + "20", color: STATUS_COLORS[o.status] }}>{o.status}</span></td>
                      <td><ProgressBar pct={pct} color={STATUS_COLORS[o.status]} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {myOrders.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No orders yet</div>}
          </div>
        </div>
      )

      // ── TICKETS ────────────────────────────────────────────
      case "tickets": return (
        <div className="cd-content">
          <div className="cd-table-card">
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #eaecf0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>Support Tickets</span>
              <Button onClick={() => setShowTicket(true)}>+ New Ticket</Button>
            </div>
            <table className="cd-table">
              <thead><tr><th>Subject</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {myTickets.map(t => (
                  <tr key={t.id} className="cd-row">
                    <td><strong>{t.subject}</strong><br/><span style={{ fontSize: 12, color: "#9ca3af" }}>{t.message.slice(0, 60)}…</span></td>
                    <td><span className="cd-status-badge" style={{ background: t.status === "Open" ? "#fef9c3" : "#f3f4f6", color: t.status === "Open" ? "#a16207" : "#6b7280" }}>{t.status}</span></td>
                    <td style={{ color: "#6b7280", fontSize: 13 }}>{t.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )

      // ── BALANCE ────────────────────────────────────────────
      case "balance": return (
        <div className="cd-content">
          <div className="cd-stats-strip">
            <StatCard label="Outstanding Balance" value={`£${myBalance.toFixed(2)}`} delta="+15%" positive />
            <StatCard label="Invoices"            value={String(invoices.length)} />
            <StatCard label="Payments Made"       value={String(payments.length)} delta="+5%" positive />
          </div>
          <div className="cd-table-card">
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #eaecf0" }}><span style={{ fontWeight: 700, fontSize: 14 }}>Invoice History</span></div>
            <table className="cd-table">
              <thead><tr><th>Invoice #</th><th>Amount</th><th>Due Date</th><th>Status</th></tr></thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="cd-row">
                    <td><strong>{inv.invoiceNumber}</strong></td>
                    <td>£{inv.amount.toFixed(2)}</td>
                    <td style={{ color: "#6b7280" }}>{inv.dueDate}</td>
                    <td><span className="cd-status-badge" style={{ background: inv.status === "Paid" ? "#dcfce7" : "#fee2e2", color: inv.status === "Paid" ? "#15803d" : "#b91c1c" }}>{inv.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }
  }

  return (
    <AppLayout role="customer" user={user} current={current} onNavigate={setCurrent} onLogout={onLogout}>
      {/* Page header */}
      <div className="cd-header">
        <div>
          <h2 className="cd-title">My Account</h2>
          <p className="cd-subtitle">{user.displayName} — Customer Portal</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="cd-import-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Export
          </button>
          <Button onClick={() => setShowOrder(true)}>+ Place Order</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="cd-tabs">
        {(["overview","stock","orders","tickets","balance"] as Tab[]).map(t => (
          <button key={t} className={"cd-tab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {page()}

      {/* Place order modal */}
      <Modal open={showOrder} title="Place New Order" onClose={() => setShowOrder(false)}>
        <form className="form-grid" onSubmit={async e => {
          e.preventDefault()
          const p = products.find(x => x.id === selProd)
          if (!p) return
          await createOrder({ customerId: user.id, customerName: user.displayName, amount: Number(qty) * 20, items: [{ productId: selProd, quantity: Number(qty), unitPrice: 20 }] })
          setQty("1"); setShowOrder(false); load()
        }}>
          <label className="form-control wide">
            <span>Product</span>
            <select value={selProd} onChange={e => setSelProd(e.target.value)}>
              {products.map(p => <option key={p.id} value={p.id}>{p.productName} — {p.size}</option>)}
            </select>
          </label>
          <Input label="Quantity (boxes)" type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} />
          <div className="wide actions-row">
            <Button type="submit">Confirm Order</Button>
            <Button type="button" variant="secondary" onClick={() => setShowOrder(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* New ticket modal */}
      <Modal open={showTicket} title="Submit Support Ticket" onClose={() => setShowTicket(false)}>
        <form className="form-grid" onSubmit={async e => {
          e.preventDefault()
          await createTicket('customer', user.id, ticketSubject, ticketMsg)
          setTicketSubject(""); setTicketMsg(""); setShowTicket(false); load()
        }}>
          <Input label="Subject" value={ticketSubject} onChange={e => setTicketSubject(e.target.value)} className="wide" required />
          <div className="wide"><TextArea label="Message" value={ticketMsg} onChange={e => setTicketMsg(e.target.value)} rows={4} /></div>
          <div className="wide actions-row">
            <Button type="submit">Submit Ticket</Button>
            <Button type="button" variant="secondary" onClick={() => setShowTicket(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  )
}