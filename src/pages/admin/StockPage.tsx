import { useState } from 'react'
import type { Product, StockItem } from '../../types'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/Table'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'

function statusLabel(status: StockItem['status']) {
  if (status === 'low') return 'Low Stock'
  if (status === 'out') return 'Out'
  return 'Available'
}

function statusBadge(status: StockItem['status']) {
  if (status === 'low') return 'badge-yellow'
  if (status === 'out') return 'badge-red'
  return 'badge-green'
}

export function StockPage({
  products,
  stock,
  onUpdateStock,
}: {
  products: Product[]
  stock: StockItem[]
  onUpdateStock: (id: string, input: Partial<StockItem>) => Promise<void>
}) {
  const [editingStock, setEditingStock] = useState<StockItem | null>(null)
  const [editForm, setEditForm] = useState({ availableQuantity: 0, price: 0, status: 'available' as StockItem['status'] })

  const handleEdit = (item: StockItem) => {
    setEditingStock(item)
    setEditForm({
      availableQuantity: item.availableQuantity,
      price: item.price,
      status: item.status
    })
  }

  const handleSave = async () => {
    if (editingStock) {
      await onUpdateStock(editingStock.id, {
        availableQuantity: editForm.availableQuantity,
        price: editForm.price,
        status: editForm.status,
        lastUpdated: new Date().toLocaleDateString()
      })
      setEditingStock(null)
    }
  }

  const handleQuickUpdate = async (id: string, quantityDelta: number) => {
    const item = stock.find(s => s.id === id)
    if (item) {
      await onUpdateStock(id, {
        availableQuantity: Math.max(0, item.availableQuantity + quantityDelta),
        status: item.availableQuantity + quantityDelta <= 5 ? 'low' : 'available'
      })
    }
  }

  return (
    <Card title="Stock Management">
      <DataTable columns={['Product', 'Available Quantity', 'Price', 'Last Updated', 'Status', 'Actions']}>
        {stock.map((item) => {
          const product = products.find((row) => row.id === item.productId)
          return (
            <tr key={item.id}>
              <td>{product?.productName ?? 'Unknown'}</td>
              <td>{item.availableQuantity}</td>
              <td>£{item.price.toFixed(2)}</td>
              <td>{item.lastUpdated}</td>
              <td><span className={`badge ${statusBadge(item.status)}`}>{statusLabel(item.status)}</span></td>
              <td>
                <div className="table-actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleQuickUpdate(item.id, 10)}
                  >
                    +10
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleQuickUpdate(item.id, -10)}
                  >
                    -10
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleEdit(item)}
                  >
                    Edit
                  </Button>
                </div>
              </td>
            </tr>
          )
        })}
      </DataTable>
      {stock.length === 0 && (
        <EmptyState title="No stock entries yet"
          description="Add products first, then manage their stock levels and prices here. Connect Supabase to load live stock data." />
      )}
      
      <Modal 
        open={Boolean(editingStock)} 
        title="Edit Stock" 
        onClose={() => setEditingStock(null)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Available Quantity"
            type="number"
            value={editForm.availableQuantity}
            onChange={(e) => setEditForm({ ...editForm, availableQuantity: Number(e.target.value) })}
          />
          <Input
            label="Price (£)"
            type="number"
            step="0.01"
            value={editForm.price}
            onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })}
          />
          <div className="form-control">
            <span>Status</span>
            <select
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value as StockItem['status'] })}
            >
              <option value="available">Available</option>
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
    </Card>
  )
}

