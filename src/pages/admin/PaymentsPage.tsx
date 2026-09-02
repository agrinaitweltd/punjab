import { useMemo } from 'react'
import type { Customer, Invoice, Payment } from '../../types'
import { Card } from '../../components/ui/Card'
import { DateAccordion } from '../../components/ui/DateAccordion'
import { groupByDate } from '../../lib/dateGrouping'

export function PaymentsPage({ payments, customers = [], invoices = [], onOpenCustomer }: {
  payments: Payment[]
  customers?: Customer[]
  invoices?: Invoice[]
  /** Jumps to the customer's invoices (the same connected-record pattern
      used from Invoices/Reminders/Dashboard) - lets an admin go straight
      from a payment to the account it was recorded against. */
  onOpenCustomer?: (customerId: string) => void
}) {
  const totalValue = payments.reduce((sum, payment) => sum + payment.amount, 0)
  const groups = useMemo(() => groupByDate(payments, p => p.date, 'desc'), [payments])
  const customerById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers])
  const invoiceById = useMemo(() => new Map(invoices.map(i => [i.id, i])), [invoices])

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
                <thead><tr><th>Reference</th><th>Customer</th><th>Account No.</th><th>Invoice</th><th>Method</th><th>Amount</th><th>Date</th></tr></thead>
                <tbody>
                  {group.items.map(payment => {
                    const customer = customerById.get(payment.customerId)
                    const invoice = payment.invoiceId ? invoiceById.get(payment.invoiceId) : undefined
                    return (
                      <tr key={payment.id}>
                        <td>{payment.paymentReference}</td>
                        <td>
                          {customer && onOpenCustomer ? (
                            <button type="button" onClick={() => onOpenCustomer(customer.id)} style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "#1f7a3a", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>{customer.companyName}</button>
                          ) : (customer?.companyName ?? payment.customerId)}
                        </td>
                        <td>{customer?.customerNumber ?? '—'}</td>
                        <td>
                          {invoice && onOpenCustomer ? (
                            <button type="button" onClick={() => onOpenCustomer(payment.customerId)} style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "#1f7a3a", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>{invoice.invoiceNumber}</button>
                          ) : (invoice?.invoiceNumber ?? '—')}
                        </td>
                        <td>{payment.method}</td>
                        <td>£{payment.amount.toFixed(2)}</td>
                        <td>{payment.date}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        />
      </Card>
    </div>
  )
}
