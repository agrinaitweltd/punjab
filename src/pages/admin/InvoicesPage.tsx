import type { Invoice } from '../../types'
import { Card } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/Table'

export function InvoicesPage({ invoices }: { invoices: Invoice[] }) {
  const unpaid = invoices.filter((invoice) => invoice.status !== 'Paid')

  return (
    <div className="stack">
      <div className="overview-grid">
        <Card title="Total Invoices">
          <p className="metric">{invoices.length}</p>
        </Card>
        <Card title="Outstanding Invoices">
          <p className="metric">{unpaid.length}</p>
        </Card>
      </div>

      <Card title="Invoice Register">
        <DataTable columns={['Invoice Number', 'Customer ID', 'Amount', 'Due Date', 'Status']}>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td>{invoice.invoiceNumber}</td>
              <td>{invoice.customerId}</td>
              <td>£{invoice.amount.toFixed(2)}</td>
              <td>{invoice.dueDate}</td>
              <td>{invoice.status}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  )
}
