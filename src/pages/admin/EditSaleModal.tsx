import { useEffect, useState } from "react"
import type { Order, OrderItem, Product, StockItem } from "../../types"
import { Modal } from "../../components/ui/Modal"
import { Button } from "../../components/ui/Button"

export function EditSaleModal({
  open, onClose, order, products, stock, onSave,
}: {
  open: boolean
  onClose: () => void
  order: Order | null
  products: Product[]
  stock: StockItem[]
  onSave: (items: OrderItem[], amount: number) => Promise<void>
}) {
  const [items, setItems] = useState<OrderItem[]>([])
  const [addProductId, setAddProductId] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open && order) { setItems(order.items.map(i => ({ ...i }))); setAddProductId("") } }, [open, order])

  const stockMap = new Map(stock.map(s => [s.productId, s]))
  const productName = (id: string) => products.find(p => p.id === id)?.productName ?? id
  const total = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)

  const setQty = (idx: number, qty: number) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(0, qty) } : it))
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const addProduct = () => {
    if (!addProductId) return
    const s = stockMap.get(addProductId)
    if (!s) return
    if (items.some(it => it.productId === addProductId)) return
    setItems(prev => [...prev, { productId: addProductId, quantity: 1, unitPrice: s.price }])
    setAddProductId("")
  }

  const availableToAdd = products.filter(p => stockMap.has(p.id) && !items.some(it => it.productId === p.id))

  const save = async () => {
    setBusy(true)
    try { await onSave(items.filter(it => it.quantity > 0), total) } finally { setBusy(false) }
  }

  return (
    <Modal open={open} title={order ? `Edit Sale ${order.orderNumber}` : "Edit Sale"} onClose={onClose}>
      {order && (
        <div>
          <p style={{ fontSize: 12.5, color: "#6b7a70", marginBottom: 12 }}>
            Changes only apply while this sale is still today's trading day — once Day End runs, sales are locked.
          </p>
          <div className="ord-items">
            {items.map((it, i) => (
              <div key={it.productId} className="ord-item-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: "#111827" }}>{productName(it.productId)}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>£{it.unitPrice.toFixed(2)} / box</div>
                </div>
                <input type="number" min="0" step="0.1" value={it.quantity}
                  onChange={e => setQty(i, parseFloat(e.target.value) || 0)}
                  style={{ width: 64, padding: "6px 8px", borderRadius: 6, border: "1.5px solid #e5e7eb", textAlign: "center" }} />
                <strong style={{ minWidth: 70, textAlign: "right" }}>£{(it.quantity * it.unitPrice).toFixed(2)}</strong>
                <button type="button" onClick={() => removeItem(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#b91c1c" }} aria-label="Remove">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            ))}
            {items.length === 0 && <p style={{ color: "#9ca3af", fontSize: 13, padding: "12px 0" }}>No items left — add one below or cancel the sale instead.</p>}
          </div>

          {availableToAdd.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <select value={addProductId} onChange={e => setAddProductId(e.target.value)} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb" }}>
                <option value="">Add a product…</option>
                {availableToAdd.map(p => <option key={p.id} value={p.id}>{p.productName} — £{stockMap.get(p.id)?.price.toFixed(2)}/box</option>)}
              </select>
              <Button variant="secondary" onClick={addProduct} disabled={!addProductId}>+ Add</Button>
            </div>
          )}

          <div className="ord-review" style={{ marginTop: 16 }}>
            <div className="ord-row ord-total"><span>New Total</span><strong>£{total.toFixed(2)}</strong></div>
          </div>

          <div className="actions-row" style={{ marginTop: 16 }}>
            <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save Changes"}</Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
