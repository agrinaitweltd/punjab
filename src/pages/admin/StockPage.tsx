import type { Product, StockItem } from '../../types'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/Table'

function statusLabel(status: StockItem['status']) {
  if (status === 'low') return 'Low Stock'
  if (status === 'out') return 'Out'
  return 'Available'
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
              <td>{statusLabel(item.status)}</td>
              <td>
                <div className="table-actions">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      onUpdateStock(item.id, {
                        availableQuantity: item.availableQuantity + 5,
                        status: 'available',
                      })
                    }
                  >
                    + Quantity
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      onUpdateStock(item.id, {
                        price: Number((item.price + 0.5).toFixed(2)),
                      })
                    }
                  >
                    Update Price
                  </Button>
                  <Button
                    onClick={() =>
                      onUpdateStock(item.id, {
                        status: item.status === 'out' ? 'available' : 'out',
                      })
                    }
                  >
                    Save
                  </Button>
                </div>
              </td>
            </tr>
          )
        })}
      </DataTable>
    </Card>
  )
}

