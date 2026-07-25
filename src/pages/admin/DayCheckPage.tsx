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
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
}

type CustomerBreakdown = {
  customerId: string; customerName: string; qty: number; sales: number; profit: number
  lines: { orderNumber: string; product: string; qty: number; unitPrice: number; profit: number }[]
}

export function DayCheckPage({ orders, products, buyingPrices }: {
  orders: Order[]
  products: Product[]
  buyingPrices: BuyingPrice[]
}) {
  const days = useMemo(() => lastNDays(7), [])
  const [customDate, setCustomDate] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([days[0]]))
  const [search, setSearch] = useState("")
  const productsById = useMemo(() => toProductsById(products), [products])

  const allDates = useMemo(() => {
    const set = new Set(days)
    if (customDate) set.add(customDate)
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [days, customDate])

  const toggle = (d: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(d)) next.delete(d); else next.add(d)
    return next
  })

  const productName = (id: string) => productsById.get(id)?.productName ?? "Unknown product"

  const detailsFor = (date: string) => {
    const daySales = completedSales(orders).filter(o => o.date === date)
    const dayBuying = buyingPrices.filter(p => p.date === date)
    const totalSales = daySales.reduce((s, o) => s + o.amount, 0)
    const totalProfit = daySales.reduce((s, o) => s + orderProfit(o, productsById), 0)
    const totalBought = dayBuying.reduce((s, p) => s + p.price, 0)

    const byCustomer = new Map<string, CustomerBreakdown>()
    for (const o of daySales) {
      const existing = byCustomer.get(o.customerId) ?? { customerId: o.customerId, customerName: o.customerName, qty: 0, sales: 0, profit: 0, lines: [] }
      for (const it of o.items) {
        const cost = productsById.get(it.productId)?.costPrice ?? 0
        const lineProfit = (it.unitPrice - cost) * it.quantity
        existing.qty += it.quantity
        existing.sales += it.unitPrice * it.quantity
        existing.profit += lineProfit
        existing.lines.push({ orderNumber: o.orderNumber, product: productName(it.productId), qty: it.quantity, unitPrice: it.unitPrice, profit: lineProfit })
      }
      byCustomer.set(o.customerId, existing)
    }
    const customers = [...byCustomer.values()].sort((a, b) => b.sales - a.sales)
    return { dayBuying, totalSales, totalProfit, totalBought, customers }
  }

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
            End-of-day reconciliation — expand a date to see everything bought, what was sold, and to whom.
          </p>
        </div>
      </div>

      <div className="ps-table-card" style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="form-control" style={{ marginBottom: 0 }}>
            <span>Look further back</span>
            <input type="date" value={customDate} onChange={e => { setCustomDate(e.target.value); if (e.target.value) setExpanded(prev => new Set(prev).add(e.target.value)) }} />
          </label>
          <div className="ps-search-wrap" style={{ maxWidth: 340 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="ps-search" placeholder="Search any order by number or customer…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
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
        <div className="stack">
          {allDates.map(date => {
            const isOpen = expanded.has(date)
            const d = isOpen ? detailsFor(date) : null
            return (
              <div key={date} className="ps-table-card">
                <button type="button" onClick={() => toggle(date)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontWeight: 700, color: "#0d2b1e" }}>{formatDay(date)}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {d && (
                      <span style={{ fontSize: 12.5, color: "#6b7a70" }}>
                        Bought £{d.totalBought.toFixed(2)} · Sold £{d.totalSales.toFixed(2)} · Profit £{d.totalProfit.toFixed(2)}
                      </span>
                    )}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7a70" strokeWidth="2"
                      style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </span>
                </button>

                {isOpen && d && (
                  <div style={{ borderTop: "1px solid #eaecf0" }}>
                    <div className="ps-stats-row" style={{ padding: 16, margin: 0 }}>
                      <div className="ps-stat"><p className="ps-stat-label">Total Bought</p><p className="ps-stat-value">£{d.totalBought.toFixed(2)}</p></div>
                      <div className="ps-stat"><p className="ps-stat-label">Total Sold</p><p className="ps-stat-value">£{d.totalSales.toFixed(2)}</p></div>
                      <div className="ps-stat"><p className="ps-stat-label">Profit</p><p className="ps-stat-value">£{d.totalProfit.toFixed(2)}</p></div>
                    </div>

                    <div style={{ padding: "0 16px 16px" }}>
                      <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>What was bought</p>
                      <div className="ps-table-wrap">
                        <table className="ps-table">
                          <thead><tr><th>Product</th><th>Supplier</th><th>Price</th><th>Status</th></tr></thead>
                          <tbody>
                            {[...d.dayBuying].sort((a, b) => a.product.localeCompare(b.product)).map(p => (
                              <tr key={p.id} className="ps-row">
                                <td><strong>{p.product}</strong></td>
                                <td>{p.supplier}</td>
                                <td>£{p.price.toFixed(2)}</td>
                                <td>{p.confirmed ? "Confirmed" : "Quoted"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {d.dayBuying.length === 0 && <div style={{ padding: "24px", textAlign: "center", color: "#9ca3af" }}>Nothing bought on this date.</div>}
                      </div>
                    </div>

                    <div style={{ padding: "0 16px 16px" }}>
                      <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>What was sold, and to whom</p>
                      {d.customers.length === 0 ? (
                        <div className="ps-table-wrap"><div style={{ padding: "24px", textAlign: "center", color: "#9ca3af" }}>Nothing sold on this date.</div></div>
                      ) : (
                        <div className="stack" style={{ gap: 10 }}>
                          {d.customers.map(c => (
                            <div key={c.customerId} className="ps-table-wrap" style={{ border: "1px solid #eaecf0", borderRadius: 10 }}>
                              <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f9fafb", fontWeight: 700 }}>
                                <span>{c.customerName}</span>
                                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#6b7280" }}>
                                  Qty {c.qty} · Sold £{c.sales.toFixed(2)} · Profit £{c.profit.toFixed(2)}
                                </span>
                              </div>
                              <table className="ps-table">
                                <thead><tr><th>Sale Number</th><th>Product</th><th>Qty</th><th>Price Each</th><th>Profit</th></tr></thead>
                                <tbody>
                                  {c.lines.map((l, i) => (
                                    <tr key={i} className="ps-row">
                                      <td><code className="ps-code">{l.orderNumber}</code></td>
                                      <td>{l.product}</td>
                                      <td>{l.qty}</td>
                                      <td>£{l.unitPrice.toFixed(2)}</td>
                                      <td style={{ color: l.profit >= 0 ? "#15803d" : "#b91c1c" }}>£{l.profit.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
