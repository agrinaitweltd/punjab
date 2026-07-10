import type { Customer, Order, Product, ActivityLog } from '../../types'
import { Card } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/Table'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function DashboardHome({
  customers, products, orders, activity,
}: {
  customers: Customer[]
  products: Product[]
  orders: Order[]
  activity: ActivityLog[]
}) {
  const openBalance = customers.reduce((s, c) => s + c.balance, 0)
  const unpaidTickets = 0
  const liveProducts = products.length
  const activeOrders = orders.filter((o) => o.status !== 'Delivered' && o.status !== 'Cancelled').length

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      Pending: 'badge badge-yellow', Confirmed: 'badge badge-blue',
      Preparing: 'badge badge-blue', Delivered: 'badge badge-green', Cancelled: 'badge badge-red',
    }
    return <span className={map[status] ?? 'badge badge-gray'}>{status}</span>
  }

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0d2b1e' }}>Overview</h2>
        <p style={{ fontSize: 13.5, color: '#6b7a70', marginTop: 3 }}>
          Manage stock, customers, orders, credit control, tickets and exports from one place.
        </p>
      </div>

      <div className="stats-row">
        <StatCard label="Open Balance"    value={`�${openBalance.toFixed(2)}`}    sub="vs last month" />
        <StatCard label="Unpaid Tickets"  value={`�${unpaidTickets.toFixed(2)}`}  sub="outstanding" />
        <StatCard label="Live Products"   value={String(liveProducts)}            sub="in catalogue" />
        <StatCard label="Active Orders"   value={String(activeOrders)}            sub="in progress" />
      </div>

      <Card title="Recent Orders">
        <DataTable columns={['Order #', 'Customer', 'Date', 'Amount', 'Status']}>
          {orders.slice(0, 6).map((order) => (
            <tr key={order.id}>
              <td><strong>{order.orderNumber}</strong></td>
              <td>{order.customerName}</td>
              <td>{order.date}</td>
              <td>�{order.amount.toFixed(2)}</td>
              <td>{statusBadge(order.status)}</td>
            </tr>
          ))}
        </DataTable>
      </Card>

      <Card title="Recent Activity">
        <DataTable columns={['Customer', 'Activity', 'Time']}>
          {activity.slice(0, 6).map((item) => (
            <tr key={item.id}>
              <td>{item.customerName}</td>
              <td>{item.action}</td>
              <td style={{ color: '#6b7a70' }}>{item.timestamp}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  )
}
