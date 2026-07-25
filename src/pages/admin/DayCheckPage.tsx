import { useMemo, useState } from "react"
import type { BuyingPrice, Order, Product } from "../../types"
import { toProductsById, orderProfit, completedSales } from "../../lib/analytics"

function lastNDays(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() - 1)
  }
  return out
}

function formatDay(iso: string) {
  const d = new Date(iso + "T00:00:00")
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
}

export function DayCheckPage({ orders, products, buyingPrices }: {
  orders: Order[]
  products: Product[]
  buyingPrices: BuyingPrice[]
}) {
  const days = useMemo(() => lastNDays(7), [])
  const [date, setDate] = useState(days[0])
  const [search, setSearch] = useState("")
  const productsById = useMemo(() => toProductsById(products), [products])

  const daySales = useMemo(() => completedSales(orders).filter(o => o.date === date), [orders, date])
  const dayBuying = useMemo(() => buyingPrices.filter(p => p.date === date), [buyingPrices, date])

  const totalSales = daySales.reduce((s, o) => s + o.amount, 0)
  const totalProfit = daySales.reduce((s, o) => s + orderProfit(o, productsById), 0)
  const totalBought = dayBuying.reduce((s, p) => s + p.price, 0)

  const productName = (id: string) => productsById.get(id)?.productName ?? "Unknown product"

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return orders.filter(o => `${o.orderNumber} ${o.customerName}`.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30)
  }, [orders, search])

  return (
    <div className="stack">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Day Check</h2>
          <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
            End-of-day reconciliation — what was bought, what was sold, and to whom.
          </p>
        </div>
      </div>

      <div className="ps-table-card" style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {days.map(d => (
            <button key={d} type="button" onClick={() => setDate(d)}
              style={{ padding: "8px 14px", borderRadius: 10, cursor: "pointer", border: date === d ? "2px solid #1f7a3a" : "1.5px solid #e5e7eb", background: date === d ? "#f0fdf4" : "#fff", fontWeight: 700, fontSize: 13, color: date === d ? "#14532d" : "#374151" }}>
              {formatDay(d)}
            </button>
          ))}
          <label className="form-control" style={{ marginBottom: 0 }}>
            <span>Or pick a date</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </label>
        </div>
        <div className="ps-search-wrap" style={{ maxWidth: 340 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="ps-search" placeholder="Search any order by number or customer…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {search.trim() ? (
        <div className="ps-table-card">
          <div className="ps-table-wrap">
            <table className="ps-table">
              <thead><tr><th>Date</th><th>Sale Number</th><th>Customer</th><th>Status</th><th>Value</th></tr></thead>
              <tbody>
                {searchResults.map(o => (
                  <tr key={o.id} className="ps-row">
                    <td>{o.date}</td>
                    <td><code className="ps-code">{o.orderNumber}</code></td>
                    <td>{o.customerName}</td>
                    <td>{o.status}</td>
                    <td><strong>£{o.amount.toFixed(2)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {searchResults.length === 0 && <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>No orders match "{search}".</div>}
          </div>
        </div>
      ) : (
        <>
          <div className="ps-stats-row">
            <div className="ps-stat"><p className="ps-stat-label">Total Bought</p><p className="ps-stat-value">£{totalBought.toFixed(2)}</p></div>
            <div className="ps-stat"><p className="ps-stat-label">Total Sold</p><p className="ps-stat-value">£{totalSales.toFixed(2)}</p></div>
            <div className="ps-stat"><p className="ps-stat-label">Profit</p><p className="ps-stat-value">£{totalProfit.toFixed(2)}</p></div>
          </div>

          <div className="ps-table-card">
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #eaecf0", fontWeight: 700 }}>What was bought — {date}</div>
            <div className="ps-table-wrap">
              <table className="ps-table">
                <thead><tr><th>Product</th><th>Supplier</th><th>Price</th><th>Status</th></tr></thead>
                <tbody>
                  {[...dayBuying].sort((a, b) => a.product.localeCompare(b.product)).map(p => (
                    <tr key={p.id} className="ps-row">
                      <td><strong>{p.product}</strong></td>
                      <td>{p.supplier}</td>
                      <td>£{p.price.toFixed(2)}</td>
                      <td>{p.confirmed ? "Confirmed" : "Quoted"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dayBuying.length === 0 && <div style={{ padding: "32px 24px", textAlign: "center", color: "#9ca3af" }}>Nothing bought on this date.</div>}
            </div>
          </div>

          <div className="ps-table-card">
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #eaecf0", fontWeight: 700 }}>What was sold, and to whom — {date}</div>
            <div className="ps-table-wrap">
              <table className="ps-table">
                <thead><tr><th>Customer</th><th>Sale Number</th><th>Product</th><th>Qty</th><th>Price Each</th><th>Line Total</th><th>Profit</th></tr></thead>
                <tbody>
                  {daySales.flatMap(o => o.items.map((it, i) => {
                    const cost = productsById.get(it.productId)?.costPrice ?? 0
                    const lineProfit = (it.unitPrice - cost) * it.quantity
                    return (
                      <tr key={o.id + "-" + i} className="ps-row">
                        <td>{o.customerName}</td>
                        <td><code className="ps-code">{o.orderNumber}</code></td>
                        <td>{productName(it.productId)}</td>
                        <td>{it.quantity}</td>
                        <td>£{it.unitPrice.toFixed(2)}</td>
                        <td><strong>£{(it.unitPrice * it.quantity).toFixed(2)}</strong></td>
                        <td style={{ color: lineProfit >= 0 ? "#15803d" : "#b91c1c" }}>£{lineProfit.toFixed(2)}</td>
                      </tr>
                    )
                  }))}
                </tbody>
              </table>
              {daySales.length === 0 && <div style={{ padding: "32px 24px", textAlign: "center", color: "#9ca3af" }}>Nothing sold on this date.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
