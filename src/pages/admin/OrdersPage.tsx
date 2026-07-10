import type { Order, OrderStatus } from "../../types"
import { Card } from "../../components/ui/Card"
import { DataTable } from "../../components/ui/Table"
import { Select } from "../../components/ui/Input"
import { EmptyState } from "../../components/ui/EmptyState"

const statusOptions: OrderStatus[] = ["Pending", "Confirmed", "Preparing", "Delivered", "Cancelled"]

export function OrdersPage({ orders, onUpdateOrder }: {
  orders: Order[]
  onUpdateOrder: (id: string, input: Partial<Order>) => Promise<void>
}) {
  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>Orders</h2>
        <p style={{ fontSize: 13.5, color: "#6b7280", marginTop: 3 }}>View and update order statuses.</p>
      </div>
      <Card title={`Orders (${orders.length})`}>
        <DataTable columns={["Order #", "Customer", "Date", "Amount", "Status"]}>
          {orders.map(order => (
            <tr key={order.id}>
              <td><strong>{order.orderNumber}</strong></td>
              <td>{order.customerName}</td>
              <td>{order.date}</td>
              <td>£{order.amount.toFixed(2)}</td>
              <td>
                <Select label="" options={statusOptions} value={order.status}
                  onChange={v => onUpdateOrder(order.id, { status: v as OrderStatus })} />
              </td>
            </tr>
          ))}
        </DataTable>
        {orders.length === 0 && (
          <EmptyState icon="📋" title="No orders yet"
            description="Orders placed by customers will appear here. Connect Supabase to load live order data." />
        )}
      </Card>
    </div>
  )
}