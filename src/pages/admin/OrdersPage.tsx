import { useMemo, useState } from "react"
import type { Customer, Invoice, Order, OrderItem, OrderStatus, Product, StockItem } from "../../types"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { COLLECTION_ADDRESS } from "../../lib/emailService"
import { NewSaleModal } from "./NewSaleModal"
import { EditSaleModal } from "./EditSaleModal"

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
  Pending:   { status: "Confirmed", label: "Confirm Sale" },
  Confirmed: { status: "Preparing", label: "Start Preparing" },
  Preparing: { status: "Delivered", label: "Mark as Delivered" },
}
const CAN_CANCEL: OrderStatus[] = ["Pending", "Confirmed", "Preparing"]
const STEPS: OrderStatus[] = ["Pending", "Confirmed", "Preparing", "Delivered"]
/* Once a sale is Confirmed it's an invoice, not just a pending sale. */
const INVOICED_STATUSES: OrderStatus[] = ["Confirmed", "Preparing", "Delivered"]

const STATUS_FILTERS: (OrderStatus | "All")[] = ["All", "Pending", "Confirmed", "Preparing", "Delivered", "Cancelled"]

type Tab = "make-sale" | "tickets"

export function OrdersPage({ orders, products, invoices = [], customers, stock, tradingDate, onUpdateOrder, onMarkPaid, onSalePlaced }: {
  orders: Order[]
  products?: Product[]
  invoices?: Invoice[]
  /** Present when this admin can place a sale on a customer's behalf. */
  customers?: Customer[]
  stock?: StockItem[]
  tradingDate?: string
  onUpdateOrder: (id: string, input: Partial<Order>) => Promise<void>
  onMarkPaid?: (order: Order) => Promise<void>
  onSalePlaced?: () => void
}) {
  const productName = (id: string) => products?.find(p => p.id === id)?.productName ?? id
  const isPaid = (order: Order) => invoices.some(inv => inv.invoiceNumber === `INV-${order.orderNumber}` && inv.status === "Paid")
  const [tab, setTab] = useState<Tab>(customers && products && stock ? "make-sale" : "tickets")
  const [query, setQuery] = useState("")
  const [statusIdx, setStatusIdx] = useState(0)
  const [detail, setDetail] = useState<Order | null>(null)
  const [busy, setBusy] = useState(false)
  const [marking, setMarking] = useState(false)
  const [showNewSale, setShowNewSale] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const canPlaceSale = Boolean(customers && products && stock)

  const statusFilter = STATUS_FILTERS[statusIdx]
  const cycleStatus = () => setStatusIdx(i => (i + 1) % STATUS_FILTERS.length)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return orders.filter(o =>
      (statusFilter === "All" || o.status === statusFilter) &&
      (!q || `${o.customerName} ${o.orderNumber}`.toLowerCase().includes(q))
    ).sort((a, b) => b.date.localeCompare(a.date))
  }, [orders, query, statusFilter])

  /* A ticket can still be edited as long as its trading day hasn't been
     closed with Day End, and it isn't in a final state. */
  const canEditTicket = (o: Order) => o.date === tradingDate && o.status !== "Delivered" && o.status !== "Cancelled"

  const advance = async (order: Order) => {
    const step = NEXT_STEP[order.status]
    if (!step) return
    setBusy(true)
    await onUpdateOrder(order.id, { status: step.status })
    setDetail(d => d && d.id === order.id ? { ...d, status: step.status } : d)
    setBusy(false)
  }

  const cancel = async (order: Order) => {
    if (!window.confirm(`Cancel sale ${order.orderNumber}? This cannot be undone.`)) return
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

  const saveEdit = async (items: OrderItem[], amount: number) => {
    if (!detail) return
    await onUpdateOrder(detail.id, { items, amount })
    setDetail(d => d && d.id === detail.id ? { ...d, items, amount } : d)
    setShowEdit(false)
  }

  return (
    <div className="stack">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Sales</h2>
          <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
            Once confirmed, a sale is an invoice. It stays editable until Day End closes the trading day.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canPlaceSale && (
          <button type="button" onClick={() => setTab("make-sale")}
            style={{ padding: "8px 14px", borderRadius: 10, cursor: "pointer", border: tab === "make-sale" ? "2px solid #1f7a3a" : "1.5px solid #e5e7eb", background: tab === "make-sale" ? "#f0fdf4" : "#fff", fontWeight: 700, fontSize: 13, color: tab === "make-sale" ? "#14532d" : "#374151" }}>
            Make Sale
          </button>
        )}
        <button type="button" onClick={() => setTab("tickets")}
          style={{ padding: "8px 14px", borderRadius: 10, cursor: "pointer", border: tab === "tickets" ? "2px solid #1f7a3a" : "1.5px solid #e5e7eb", background: tab === "tickets" ? "#f0fdf4" : "#fff", fontWeight: 700, fontSize: 13, color: tab === "tickets" ? "#14532d" : "#374151" }}>
          Tickets {orders.length > 0 && <span style={{ marginLeft: 4, color: "#9ca3af" }}>({orders.length})</span>}
        </button>
      </div>

      {tab === "make-sale" && canPlaceSale && (
        <div className="ps-table-card" style={{ padding: 40, textAlign: "center" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1f7a3a" strokeWidth="1.6" style={{ marginBottom: 12 }}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>
          <p style={{ fontWeight: 700, fontSize: 16, color: "#0d2b1e", marginBottom: 6 }}>Start a new sale</p>
          <p style={{ color: "#6b7a70", fontSize: 13.5, marginBottom: 18 }}>Pick a customer, then add products just like they would themselves.</p>
          <Button onClick={() => setShowNewSale(true)}>+ New Sale</Button>
        </div>
      )}

      {tab === "tickets" && (
        <>
          <div className="hr-found-row">
            <span className="hr-found">{filtered.length} ticket{filtered.length !== 1 ? "s" : ""} found</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div className="ps-search-wrap" style={{ padding: "7px 12px" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input className="ps-search" placeholder="Search sales or customers…" value={query} onChange={e => setQuery(e.target.value)} />
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
                  <th>Ticket</th>
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
                    const isInvoice = INVOICED_STATUSES.includes(order.status)
                    return (
                      <tr key={order.id} className="ps-row cd-row-clickable" onDoubleClick={() => setDetail(order)} title="Double-click to view">
                        <td>
                          <strong>{order.orderNumber}</strong>
                          {isInvoice && <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>INV-{order.orderNumber}</div>}
                          {order.officialInvoiceNumber && <div style={{ fontSize: 11, color: "#6b7280" }}>{order.officialInvoiceNumber}</div>}
                        </td>
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
                  <div style={{ fontWeight: 600, marginBottom: 4, color: "#374151" }}>No tickets found</div>
                  <div style={{ fontSize: 13 }}>Sales placed by customers, or made here, will appear here.</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Ticket detail — an invoice once confirmed, editable until Day End */}
      <Modal open={Boolean(detail)} title={detail ? `${INVOICED_STATUSES.includes(detail.status) ? "Invoice" : "Sale"} ${detail.orderNumber}` : "Sale"} onClose={() => setDetail(null)}>
        {detail && (() => {
          const o = detail
          const sc = STATUS_COLORS[o.status]
          const stepIdx = o.status === "Cancelled" ? -1 : STEPS.indexOf(o.status)
          const step = NEXT_STEP[o.status]
          const editable = canEditTicket(o)
          return (
            <div>
              <div className="ord-review">
                <div className="ord-row"><span>Customer</span><strong>{o.customerName}</strong></div>
                <div className="ord-row"><span>Date placed</span><strong>{o.date}</strong></div>
                <div className="ord-row"><span>Status</span><span className="ps-badge" style={{ background: sc.bg, color: sc.color }}>{o.status}</span></div>
                {INVOICED_STATUSES.includes(o.status) && (
                  <div className="ord-row"><span>Invoice Number</span><strong>INV-{o.orderNumber}</strong></div>
                )}
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

              {o.fulfilment !== "Collection" && o.deliveryAddress && (
                <div style={{ margin: "12px 0", border: "1.5px dashed #1d4ed8", borderRadius: 10, padding: "12px 16px", background: "#eff6ff", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#1d4ed8", fontWeight: 700 }}>Deliver to</p>
                  {o.deliveryAddress}
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
                  This sale was cancelled and cannot be modified.
                </div>
              )}
              {!editable && o.status !== "Cancelled" && o.date !== tradingDate && (
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 10 }}>This ticket's trading day has closed (Day End), so it's locked and can't be edited.</p>
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

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #eef1ee", display: "flex", flexDirection: "column", gap: 10 }}>
                {(step || (editable && products && stock) || (onMarkPaid && !isPaid(o) && o.status !== "Cancelled")) && (
                  <div className="actions-row" style={{ flexWrap: "wrap" }}>
                    {step && <Button onClick={() => advance(o)} disabled={busy}>{step.label}</Button>}
                    {onMarkPaid && !isPaid(o) && o.status !== "Cancelled" && (
                      <Button onClick={() => markPaid(o)} disabled={marking}>{marking ? "Marking paid…" : "Mark as Paid"}</Button>
                    )}
                    {editable && products && stock && (
                      <Button variant="secondary" onClick={() => setShowEdit(true)}>Edit Sale</Button>
                    )}
                  </div>
                )}
                <div className="actions-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                  {CAN_CANCEL.includes(o.status)
                    ? <Button variant="danger" onClick={() => cancel(o)} disabled={busy}>Cancel Sale</Button>
                    : <span />}
                  <Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>
                </div>
              </div>
            </div>
          )
        })()}
      </Modal>

      {canPlaceSale && (
        <NewSaleModal
          open={showNewSale}
          onClose={() => setShowNewSale(false)}
          customers={customers!}
          products={products!}
          stock={stock!}
          tradingDate={tradingDate}
          onPlaced={() => { setShowNewSale(false); onSalePlaced?.() }}
        />
      )}

      {products && stock && (
        <EditSaleModal
          open={showEdit}
          onClose={() => setShowEdit(false)}
          order={detail}
          products={products}
          stock={stock}
          onSave={saveEdit}
        />
      )}
    </div>
  )
}
