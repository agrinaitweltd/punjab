import type { Payment } from '../../types'
import { Card } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/Table'

export function PaymentsPage({ payments }: { payments: Payment[] }) {
  const totalValue = payments.reduce((sum, payment) => sum + payment.amount, 0)

  return (
    <div className="stack">
      <div className="overview-grid">
        <Card title="Payment Count">
          <p className="metric">{payments.length}</p>
        </Card>
        <Card title="Total Received">
          <p className="metric">£{totalValue.toFixed(2)}</p>
        </Card>
      </div>

      <Card title="Payment History">
        <DataTable columns={['Reference', 'Customer ID', 'Method', 'Amount', 'Date']}>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td>{payment.paymentReference}</td>
              <td>{payment.customerId}</td>
              <td>{payment.method}</td>
              <td>£{payment.amount.toFixed(2)}</td>
              <td>{payment.date}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  )
}
