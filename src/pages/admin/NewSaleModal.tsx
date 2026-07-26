import { useState } from "react"
import type { Customer, Product, StockItem } from "../../types"
import { Modal } from "../../components/ui/Modal"
import { PlaceOrderModal } from "../customer/PlaceOrderModal"

/** Lets an admin place a sale on a customer's behalf — pick the customer
    first, then reuse the exact same shop/cart/checkout flow a customer gets. */
export function NewSaleModal({
  open, onClose, customers, products, stock, tradingDate, onPlaced,
}: {
  open: boolean
  onClose: () => void
  customers: Customer[]
  products: Product[]
  stock: StockItem[]
  tradingDate?: string
  onPlaced: () => void
}) {
  const [query, setQuery] = useState("")
  const [customerId, setCustomerId] = useState<string | null>(null)

  const close = () => { setCustomerId(null); setQuery(""); onClose() }

  const filtered = customers.filter(c =>
    !query.trim() || `${c.companyName} ${c.customerNumber}`.toLowerCase().includes(query.trim().toLowerCase())
  )
  const customer = customers.find(c => c.id === customerId)

  if (customer) {
    return (
      <PlaceOrderModal
        open={open}
        onClose={close}
        products={products}
        stock={stock}
        customerId={customer.id}
        customerName={customer.companyName}
        customerEmail={customer.email}
        salesmanId={customer.salesmanId}
        salesmanName={customer.salesmanName}
        onPlaced={onPlaced}
        tradingDate={tradingDate}
      />
    )
  }

  return (
    <Modal open={open} title="New Sale — Select Customer" onClose={close}>
      <div className="ps-search-wrap" style={{ marginBottom: 12 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input className="ps-search" placeholder="Search customer…" value={query} onChange={e => setQuery(e.target.value)} autoFocus />
      </div>
      <div style={{ maxHeight: 340, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {filtered.map(c => (
          <button
            key={c.id} type="button" onClick={() => setCustomerId(c.id)}
            disabled={c.blocked}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
              padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#fff",
              cursor: c.blocked ? "not-allowed" : "pointer", opacity: c.blocked ? 0.5 : 1, textAlign: "left",
            }}
          >
            <span>
              <strong style={{ display: "block", fontSize: 13.5 }}>{c.companyName}</strong>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>{c.customerNumber}{c.deliveryArea ? ` · ${c.deliveryArea}` : ""}</span>
            </span>
            {c.blocked && <span className="ps-badge" style={{ background: "#111827", color: "#fff" }}>Blocked</span>}
          </button>
        ))}
        {filtered.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>No customers match "{query}".</div>}
      </div>
    </Modal>
  )
}
