import { useMemo, useState } from 'react'
import type { Product, StockItem } from '../../types'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { GmtClock } from '../../components/GmtClock'
import { currentCycleStart, isStockFresh, latestStockUpdate, formatGmtTime, nextCycleStart } from '../../lib/stockCycle'

const STATUS_META: Record<StockItem['status'], { label: string; bg: string; color: string }> = {
  available: { label: 'In Stock', bg: '#dcfce7', color: '#15803d' },
  low:       { label: 'Low Stock', bg: '#fef9c3', color: '#a16207' },
  out:       { label: 'Out of Stock', bg: '#fee2e2', color: '#b91c1c' },
}
const AV_COLORS = ['#22913f', '#f2790f', '#0ea5e9', '#8b5cf6', '#d93025']

export function StockPage({
  products, stock, onUpdateStock, onNavigate,
}: {
  products: Product[]
  stock: StockItem[]
  onUpdateStock: (id: string, input: Partial<StockItem>) => Promise<void>
  onNavigate?: (key: string) => void
}) {
  const [editingStock, setEditingStock] = useState<StockItem | null>(null)
  const [editForm, setEditForm] = useState({ availableQuantity: 0, price: 0, status: 'available' as StockItem['status'] })
  const [query, setQuery] = useState('')

  const fresh = isStockFresh(stock)
  const updatedAt = latestStockUpdate(stock)
  const cycleStart = currentCycleStart()
  const inCycle = (s: StockItem) => { const t = new Date(s.lastUpdated); return !isNaN(t.getTime()) && t >= cycleStart }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return stock
      .map(item => ({ item, product: products.find(p => p.id === item.productId) }))
      .filter(({ product }) => !q || `${product?.productName} ${product?.variety} ${product?.category}`.toLowerCase().includes(q))
      .sort((a, b) => (a.product?.productName ?? '').localeCompare(b.product?.productName ?? ''))
  }, [stock, products, query])

  const counts = {
    in: stock.filter(s => s.status === 'available').length,
    low: stock.filter(s => s.status === 'low').length,
    out: stock.filter(s => s.status === 'out').length,
    today: stock.filter(inCycle).length,
  }

  const handleEdit = (item: StockItem) => {
    setEditingStock(item)
    setEditForm({ availableQuantity: item.availableQuantity, price: item.price, status: item.status })
  }

  const handleSave = async () => {
    if (!editingStock) return
    await onUpdateStock(editingStock.id, {
      availableQuantity: editForm.availableQuantity,
      price: editForm.price,
      status: editForm.status,
    })
    setEditingStock(null)
  }

  const handleQuickUpdate = async (id: string, delta: number) => {
    const item = stock.find(s => s.id === id)
    if (!item) return
    const nextQty = Math.max(0, item.availableQuantity + delta)
    await onUpdateStock(id, {
      availableQuantity: nextQty,
      status: nextQty === 0 ? 'out' : nextQty <= 10 ? 'low' : 'available',
    })
  }

  return (
    <div className="stack">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0d2b1e' }}>Stock Management</h2>
          <p style={{ fontSize: 13.5, color: '#6b7a70', marginTop: 3 }}>Live quantities and prices — synced with your daily selling session.</p>
        </div>
        <GmtClock />
      </div>

      {/* session sync banner */}
      <div className={'stk-banner ' + (fresh ? 'ok' : 'due')} style={{ marginBottom: 0 }}>
        <span className="stk-banner-ico">
          {fresh
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        </span>
        <div className="stk-banner-body">
          {fresh
            ? <><strong>Synced with today's session.</strong> {counts.today} line{counts.today !== 1 ? 's' : ''} updated {updatedAt ? `at ${formatGmtTime(updatedAt)}` : 'today'} — live until {nextCycleStart().toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short' })} 06:00 GMT.</>
            : <><strong>No session published today.</strong> Start the daily session to set today's produce, quantities and prices.</>}
        </div>
        <button className="stk-banner-btn" onClick={() => onNavigate?.('session')}>
          {fresh ? 'Review Session' : 'Start Daily Session'}
        </button>
      </div>

      {/* summary pills */}
      <div className="stk-health" style={{ marginBottom: 0 }}>
        <div className="stk-pill"><span className="stk-num" style={{ color: '#1f7a3a' }}>{counts.today}</span> Updated today</div>
        <div className="stk-pill"><span className="stk-num" style={{ color: '#15803d' }}>{counts.in}</span> In stock</div>
        <div className="stk-pill"><span className="stk-num" style={{ color: '#b45309' }}>{counts.low}</span> Low</div>
        <div className="stk-pill"><span className="stk-num" style={{ color: '#b91c1c' }}>{counts.out}</span> Out</div>
        <div className="ps-search-wrap" style={{ marginLeft: 'auto', maxWidth: 240, padding: '7px 12px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="ps-search" placeholder="Search stock…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </div>

      {/* stock table */}
      <div className="ps-table-card">
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr>
              <th>Product</th>
              <th>Packaging</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Updated</th>
              <th>Status</th>
              <th>Actions</th>
            </tr></thead>
            <tbody>
              {rows.map(({ item, product }, i) => {
                const meta = STATUS_META[item.status]
                const t = new Date(item.lastUpdated)
                return (
                  <tr key={item.id} className="ps-row">
                    <td>
                      <div className="ps-product-cell">
                        <div className="ps-product-avatar" style={{ background: AV_COLORS[i % AV_COLORS.length] + '22', color: AV_COLORS[i % AV_COLORS.length] }}>
                          {(product?.productName ?? '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="ps-product-name">{product?.productName ?? 'Unknown'}</div>
                          <div className="ps-product-variety">{product?.variety || product?.category || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: '#6b7280', fontSize: 13 }}>{product?.size || '—'}</td>
                    <td>
                      <div className="stk-qty">
                        <button className="stk-step" title="Remove 10" onClick={() => handleQuickUpdate(item.id, -10)}>−10</button>
                        <strong>{item.availableQuantity}</strong>
                        <button className="stk-step" title="Add 10" onClick={() => handleQuickUpdate(item.id, 10)}>+10</button>
                      </div>
                    </td>
                    <td><strong>£{item.price.toFixed(2)}</strong></td>
                    <td>
                      {inCycle(item)
                        ? <span className="stk-today">Today {isNaN(t.getTime()) ? '' : formatGmtTime(t)}</span>
                        : <span style={{ color: '#9ca3af', fontSize: 12.5 }}>{isNaN(t.getTime()) ? item.lastUpdated || '—' : t.toLocaleDateString('en-GB')}</span>}
                    </td>
                    <td><span className="ps-badge" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span></td>
                    <td>
                      <Button variant="secondary" className="btn-sm" onClick={() => handleEdit(item)}>Edit</Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div style={{ padding: '42px 24px', textAlign: 'center', color: '#9ca3af' }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#c3c9d2" strokeWidth="1.6" style={{ marginBottom: 8 }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              <div style={{ fontWeight: 600, marginBottom: 4, color: '#374151' }}>{stock.length === 0 ? 'No stock lines yet' : 'Nothing matches your search'}</div>
              <div style={{ fontSize: 13 }}>{stock.length === 0 ? 'Run the Daily Session to publish today\'s produce, or add products first.' : 'Try a different search term.'}</div>
            </div>
          )}
        </div>
      </div>

      <Modal open={Boolean(editingStock)} title="Edit Stock Line" onClose={() => setEditingStock(null)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input label="Available Quantity" type="number" min="0" value={editForm.availableQuantity}
            onChange={(e) => setEditForm({ ...editForm, availableQuantity: Number(e.target.value) })} />
          <Input label="Price (£ per unit)" type="number" step="0.01" min="0" value={editForm.price}
            onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })} />
          <div className="form-control">
            <span>Status</span>
            <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as StockItem['status'] })}>
              <option value="available">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
          <div className="actions-row">
            <Button onClick={handleSave}>Save Changes</Button>
            <Button variant="secondary" onClick={() => setEditingStock(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
