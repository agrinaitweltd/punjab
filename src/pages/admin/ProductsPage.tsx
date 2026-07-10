import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Product } from '../../types'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { DataTable } from '../../components/ui/Table'

const initialForm = {
  productName: '',
  category: '',
  variety: '',
  size: '',
  sku: '',
  boxesPerPallet: '0',
  productImage: '',
}

export function ProductsPage({
  products,
  onCreate,
  onUpdate,
  onDelete,
}: {
  products: Product[]
  onCreate: (input: Omit<Product, 'id'>) => Promise<void>
  onUpdate: (id: string, input: Partial<Product>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [form, setForm] = useState(initialForm)

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault()
    await onCreate({
      ...form,
      boxesPerPallet: Number(form.boxesPerPallet),
    })
    setForm(initialForm)
  }

  return (
    <div className="stack">
      <Card title="Add Product">
        <form className="form-grid" onSubmit={submitCreate}>
          <Input label="Product Name" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} required />
          <Input label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
          <Input label="Variety" value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} required />
          <Input label="Size" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} required />
          <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          <Input label="Boxes Per Pallet" type="number" value={form.boxesPerPallet} onChange={(e) => setForm({ ...form, boxesPerPallet: e.target.value })} required />
          <div className="wide">
            <Input label="Product Image URL" value={form.productImage} onChange={(e) => setForm({ ...form, productImage: e.target.value })} placeholder="Optional" />
          </div>
          <div className="wide actions-row">
            <Button type="submit">Add Product</Button>
          </div>
        </form>
      </Card>

      <Card title="Products">
        <DataTable columns={['Name', 'Category', 'Variety', 'Size', 'SKU', 'Boxes/Pallet', 'Actions']}>
          {products.map((product) => (
            <tr key={product.id}>
              <td>{product.productName}</td>
              <td>{product.category}</td>
              <td>{product.variety}</td>
              <td>{product.size}</td>
              <td>{product.sku}</td>
              <td>{product.boxesPerPallet}</td>
              <td>
                <div className="table-actions">
                  <Button
                    variant="secondary"
                    onClick={() => onUpdate(product.id, { productName: `${product.productName} (Updated)` })}
                  >
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => onDelete(product.id)}>
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  )
}


