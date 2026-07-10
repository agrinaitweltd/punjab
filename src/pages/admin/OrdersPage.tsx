import type { Order, OrderStatus } from '../../types'
import { Card } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/Table'
import { Select } from '../../components/ui/Input'

const statusOptions: OrderStatus[] = ['Pending', 'Confirmed', 'Preparing', 'Delivered', 'Cancelled']

export function OrdersPage({
  orders,
  onUpdateOrder,
}: {
  orders: Order[]
  onUpdateOrder: (id: string, input: Partial<Order>) => Promise<void>
}) {
  return (
    <Card title="Orders">
      <DataTable columns={['Order Number', 'Customer', 'Date', 'Amount', 'Status']}>
        {orders.map((order) => (
          <tr key={order.id}>
            <td>{order.orderNumber}</td>
            <td>{order.customerName}</td>
            <td>{order.date}</td>
            <td>£{order.amount.toFixed(2)}</td>
            <td>
              <Select
                label=""
                options={statusOptions}
                value={order.status}
                onChange={(value) => onUpdateOrder(order.id, { status: value as OrderStatus })}
              />
            </td>
          </tr>
        ))}
      </DataTable>
    </Card>
  )
}

