import { useMemo, useState } from "react"
import type { DayTrade, Order, Product } from "../../types"
import { Modal } from "../../components/ui/Modal"
import { orderProfit, toProductsById } from "../../lib/analytics"

export function DayTradePage({ dayTrades, orders, products }: {
  dayTrades: DayTrade[]
  orders: Order[]
  products: Product[]
}) {
  const [detail, setDetail] = useState<DayTrade | null>(null)
  const productsById = useMemo(() => toProductsById(products), [products])
  const productName = (id: string) => productsById.get(id)?.productName ?? "Unknown product"

  const detailOrders = useMemo(
    () => detail ? orders.filter(o => o.date === detail.date && o.status !== "Cancelled") : [],
    [detail, orders],
  )

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Day Trade</h2>
        <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
          A permanent archive of every trading day closed with "Day End" in the sidebar.
        </p>
      </div>

      <div className="ps-table-card">
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr><th>Date</th><th>Total Sales</th><th>Total Profit</th><th>Number of Sales</th><th>Closed By</th><th>Closed At</th></tr></thead>
            <tbody>
              {dayTrades.map(dt => (
                <tr key={dt.id} className="ps-row cd-row-clickable" onClick={() => setDetail(dt)}>
                  <td><strong>{dt.date}</strong></td>
                  <td>£{dt.totalSales.toFixed(2)}</td>
                  <td>£{dt.totalProfit.toFixed(2)}</td>
                  <td>{dt.saleCount}</td>
                  <td>{dt.closedBy || "—"}</td>
                  <td style={{ color: "#6b7280" }}>{dt.closedAt ? new Date(dt.closedAt).toLocaleString("en-GB") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {dayTrades.length === 0 && (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
              No trading days closed yet — use "Day End" at the bottom of the sidebar to archive today.
            </div>
          )}
        </div>
      </div>

      <Modal open={Boolean(detail)} title={detail ? `Day Trade — ${detail.date}` : ""} onClose={() => setDetail(null)} wide>
        {detail && (
          <div>
            <div className="ps-stats-row">
              <div className="ps-stat"><p className="ps-stat-label">Total Sales</p><p className="ps-stat-value">£{detail.totalSales.toFixed(2)}</p></div>
              <div className="ps-stat"><p className="ps-stat-label">Total Profit</p><p className="ps-stat-value">£{detail.totalProfit.toFixed(2)}</p></div>
              <div className="ps-stat"><p className="ps-stat-label">Number of Sales</p><p className="ps-stat-value">{detail.saleCount}</p></div>
            </div>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", margin: "16px 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Every Sale
            </p>
            <div className="ps-table-wrap">
              <table className="ps-table">
                <thead><tr><th>Sale</th><th>Customer</th><th>Salesman</th><th>Invoice #</th><th>Products</th><th>Profit</th><th>Total</th></tr></thead>
                <tbody>
                  {detailOrders.map(o => (
                    <tr key={o.id} className="ps-row">
                      <td><code className="ps-code">{o.orderNumber}</code></td>
                      <td>{o.customerName}</td>
                      <td>{o.salesmanName || "—"}</td>
                      <td>{o.officialInvoiceNumber || "—"}</td>
                      <td style={{ fontSize: 12.5, color: "#6b7280" }}>
                        {o.items.map(it => `${it.quantity}× ${productName(it.productId)}`).join(", ")}
                      </td>
                      <td>£{orderProfit(o, productsById).toFixed(2)}</td>
                      <td><strong>£{o.amount.toFixed(2)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {detailOrders.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>No sales recorded for this day.</div>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
