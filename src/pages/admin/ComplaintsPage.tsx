import type { SupportTicket } from '../../types'
import { Card } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/Table'

export function ComplaintsPage({ tickets }: { tickets: SupportTicket[] }) {
  const complaints = tickets.filter((ticket) => {
    const text = `${ticket.subject} ${ticket.message}`.toLowerCase()
    return text.includes('complaint') || text.includes('issue') || text.includes('problem')
  })

  return (
    <Card title="Complaints Tracker">
      <DataTable columns={['Subject', 'Customer ID', 'Status', 'Created At']}>
        {(complaints.length ? complaints : tickets).map((ticket) => (
          <tr key={ticket.id}>
            <td>{ticket.subject}</td>
            <td>{ticket.customerId ?? '-'}</td>
            <td>{ticket.status}</td>
            <td>{ticket.createdAt}</td>
          </tr>
        ))}
      </DataTable>
    </Card>
  )
}
