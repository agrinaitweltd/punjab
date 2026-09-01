import { useMemo } from 'react'
import type { Payment } from '../../types'
import { Card } from '../../components/ui/Card'
import { DateAccordion } from '../../components/ui/DateAccordion'
import { groupByDate } from '../../lib/dateGrouping'

export function PaymentsPage({ payments }: { payments: Payment[] }) {
  const totalValue = payments.reduce((sum, payment) => sum + payment.amount, 0)
  const groups = useMemo(() => groupByDate(payments, p => p.date, 'desc'), [payments])

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
        <DateAccordion
          groups={groups}
          emptyMessage="No payments recorded yet."
          renderGroup={group => (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Reference</th><th>Customer ID</th><th>Method</th><th>Amount</th><th>Date</th></tr></thead>
                <tbody>
                  {group.items.map(payment => (
                    <tr key={payment.id}>
                      <td>{payment.paymentReference}</td>
                      <td>{payment.customerId}</td>
                      <td>{payment.method}</td>
                      <td>£{payment.amount.toFixed(2)}</td>
                      <td>{payment.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        />
      </Card>
    </div>
  )
}
