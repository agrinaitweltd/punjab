import { useMemo, useState } from "react"
import type { Invoice, Order, OrderStatus, Product } from "../../types"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { COLLECTION_ADDRESS } from "../../lib/emailService"

const STATUS_COLORS: Record<OrderStatus, { bg: string; color: string }> = {
  Pending:   { bg: "#fef9c3", color: "#a16207" },
  Confirmed: { bg: "#dbeafe", color: "#1d4ed8" },
  Preparing: { bg: "#ede9fe", color: "#7c3aed" },
  Delivered: { bg: "#dcfce7", color: "#15803d" },
  Cancelled: { bg: "#fee2e2", color: "#b91c1c" },
}

/* Orders move forward through a fixed workflow — no free-form status
   editing. Delivered and Cancelled are terminal. */
const NEXT_STEP: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  Pending:   { status: "Confirmed", label: "Confirm Order" },
  Confirmed: { status: "Preparing", label: "Start Preparing" },
  Preparing: { status: "Delivered", label: "Mark as Delivered" },
}
const CAN_CANCEL: OrderStatus[] = ["Pending", "Confirmed", "Preparing"]
const STEPS: OrderStatus[] = ["Pending", "Confirmed", "Preparing", "Delivered"]

const STATUS_FILTERS: (OrderStatus | "All")[] = ["All", "Pending", "Confirmed", "Preparing", "Delivered", "Cancelled"]

export function OrdersPage({ orders, products, invoices = [], onUpdateOrder, onMarkPaid }: {
  orders: Order[]
  products?: Product[]
  invoices?: Invoice[]
  onUpdateOrder: (id: string, input: Partial<Order>) => Promise<void>
  onMarkPaid?: (order: Order) => Promise<void>
}) {
  const productName = (id: string) => products?.find(p => p.id === id)?.productName ?? id
  const isPaid = (order: Order) => invoices.some(inv => inv.invoiceNumber === `INV-${order.orderNumber}` && inv.status === "Paid")
  const [query, setQuery] = useState("")
  const [statusIdx, setStatusIdx] = useState(0)
  const [detail, setDetail] = useState<Order | null>(null)
  const [busy, setBusy] = useState(false)
  const [marking, setMarking] = useState(false)

  const statusFilter = STATUS_FILTERS[statusIdx]
  const cycleStatus = () => setStatusIdx(i => (i + 1) % STATUS_FILTERS.length)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return orders.filter(o =>
      (statusFilter === "All" || o.status === statusFilter) &&
      (!q || `${o.customerName} ${o.orderNumber}`.toLowerCase().includes(q))
    ).sort((a, b) => b.date.localeCompare(a.date))
  }, [orders, query, statusFilter])

  const advance = async (order: Order) => {
    const step = NEXT_STEP[order.status]
    if (!step) return
    setBusy(true)
    await onUpdateOrder(order.id, { status: step.status })
    setDetail(d => d && d.id === order.id ? { ...d, status: step.status } : d)
    setBusy(false)
  }

  const cancel = async (order: Order) => {
    if (!window.confirm(`Cancel order ${order.orderNumber}? This cannot be undone.`)) return
    setBusy(true)
    await onUpdateOrder(order.id, { status: "Cancelled" })
    setDetail(d => d && d.id === order.id ? { ...d, status: "Cancelled" } : d)
    setBusy(false)
  }

  const markPaid = async (order: Order) => {
    if (!onMarkPaid || isPaid(order)) return
    setMarking(true)
    await onMarkPaid(order)
    setMarking(false)
  }

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Orders</h2>
        <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
          Orders move forward through a fixed workflow — confirm, prepare, deliver, or cancel. Once delivered or cancelled, an order is final.
        </p>
      </div>

      <div className="hr-found-row">
        <span className="hr-found">{filtered.length} order{filtered.length !== 1 ? "s" : ""} found</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div className="ps-search-wrap" style={{ padding: "7px 12px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="ps-search" placeholder="Search orders or customers…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <button className={"ps-tool-btn" + (statusFilter !== "All" ? " ps-tool-active" : "")} onClick={cycleStatus} title="Cycle status filter">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            {statusFilter === "All" ? "Filter" : statusFilter}
          </button>
        </div>
      </div>

      <div className="ps-table-card">
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Items</th>
              <th>Amount</th>
              <th>Fulfilment</th>
              <th>Status</th>
              <th>Action</th>
            </tr></thead>
            <tbody>
              {filtered.map(order => {
                const sc = STATUS_COLORS[order.status]
                const step = NEXT_STEP[order.status]
                const isFinal = !step
                return (
                  <tr key={order.id} className="ps-row cd-row-clickable" onClick={() => setDetail(order)}>
                    <td><strong>{order.orderNumber}</strong></td>
                    <td>
                      <div className="ps-product-cell">
                        <div className="ps-product-avatar" style={{ background: "#e8f8ec", color: "#1a5c2d" }}>
                          {order.customerName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="ps-product-name">{order.customerName}</div>
                      </div>
                    </td>
                    <td style={{ color: "#6b7280" }}>{order.date}</td>
                    <td style={{ color: "#6b7280" }}>{order.items.length} item{order.items.length !== 1 ? "s" : ""}</td>
                    <td><strong>£{order.amount.toFixed(2)}</strong></td>
                    <td>
                      <span className="ps-badge" style={order.fulfilment === "Collection" ? { background: "#ffedd5", color: "#c2410c" } : { background: "#dbeafe", color: "#1d4ed8" }}>
                        {order.fulfilment ?? "Delivery"}
                      </span>
                    </td>
                    <td>
                      <span className="ps-badge" style={{ background: sc.bg, color: sc.color }}>{order.status}</span>
                      {isPaid(order) && <span className="ps-badge" style={{ background: "#dcfce7", color: "#15803d", marginLeft: 6 }}>Paid</span>}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      {isFinal
                        ? <span className="ord-final-tag">Final</span>
                        : <Button className="btn-sm" onClick={() => advance(order)} disabled={busy}>{step.label}</Button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#c3c9d2" strokeWidth="1.6" style={{ marginBottom: 8 }}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
              <div style={{ fontWeight: 600, marginBottom: 4, color: "#374151" }}>No orders found</div>
              <div style={{ fontSize: 13 }}>Orders placed by customers will appear here.</div>
            </div>
          )}
        </div>
      </div>

      {/* Order detail + confirmable workflow */}
      <Modal open={Boolean(detail)} title={detail ? `Order ${detail.orderNumber}` : "Order"} onClose={() => setDetail(null)}>
        {detail && (() => {
          const o = detail
          const sc = STATUS_COLORS[o.status]
          const stepIdx = o.status === "Cancelled" ? -1 : STEPS.indexOf(o.status)
          const step = NEXT_STEP[o.status]
          return (
            <div>
              <div className="ord-review">
                <div className="ord-row"><span>Customer</span><strong>{o.customerName}</strong></div>
                <div className="ord-row"><span>Date placed</span><strong>{o.date}</strong></div>
                <div className="ord-row"><span>Status</span><span className="ps-badge" style={{ background: sc.bg, color: sc.color }}>{o.status}</span></div>
                <div className="ord-row">
                  <span>Payment</span>
                  {isPaid(o)
                    ? <span className="ps-badge" style={{ background: "#dcfce7", color: "#15803d" }}>Paid</span>
                    : <span className="ps-badge" style={{ background: "#fee2e2", color: "#b91c1c" }}>Unpaid</span>}
                </div>
                <div className="ord-row">
                  <span>Fulfilment</span>
                  <span className="ps-badge" style={o.fulfilment === "Collection" ? { background: "#ffedd5", color: "#c2410c" } : { background: "#dbeafe", color: "#1d4ed8" }}>
                    {o.fulfilment ?? "Delivery"}
                  </span>
                </div>
                <div className="ord-row ord-total"><span>Total</span><strong>£{o.amount.toFixed(2)}</strong></div>
              </div>

              {o.fulfilment === "Collection" && (
                <div style={{ margin: "12px 0", border: "1.5px dashed #f2790f", borderRadius: 10, padding: "12px 16px", background: "#fff8ef", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#b25c0a", fontWeight: 700 }}>Customer is collecting from</p>
                  <strong style={{ color: "#111827" }}>{COLLECTION_ADDRESS.line1}</strong><br />
                  {COLLECTION_ADDRESS.line2}<br />
                  {COLLECTION_ADDRESS.line3}<br />
                  {COLLECTION_ADDRESS.line4}<br />
                  {COLLECTION_ADDRESS.city} {COLLECTION_ADDRESS.postcode}
                </div>
              )}

              {o.status !== "Cancelled" && (
                <div className="ord-track">
                  {STEPS.map((s, i) => (
                    <div key={s} className={"ord-track-step" + (i <= stepIdx ? " done" : "")}>
                      <span className="ord-track-dot" />
                      <span className="ord-track-label">{s}</span>
                    </div>
                  ))}
                </div>
              )}
              {o.status === "Cancelled" && (
                <div className="ord-cancelled-note">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  This order was cancelled and cannot be modified.
                </div>
              )}

              <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", margin: "18px 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Items ({o.items.length})
              </p>
              <div className="ord-items">
                {o.items.map((it, i) => (
                  <div key={i} className="ord-item-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: "#111827" }}>{productName(it.productId)}</div>
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>{it.quantity} × £{it.unitPrice.toFixed(2)}</div>
                    </div>
                    <strong>£{(it.quantity * it.unitPrice).toFixed(2)}</strong>
                  </div>
                ))}
              </div>

              <div className="actions-row" style={{ marginTop: 18 }}>
                {step && <Button onClick={() => advance(o)} disabled={busy}>{step.label}</Button>}
                {onMarkPaid && !isPaid(o) && o.status !== "Cancelled" && (
                  <Button onClick={() => markPaid(o)} disabled={marking}>{marking ? "Marking paid…" : "Mark as Paid"}</Button>
                )}
                {CAN_CANCEL.includes(o.status) && (
                  <Button variant="danger" onClick={() => cancel(o)} disabled={busy}>Cancel Order</Button>
                )}
                <Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
