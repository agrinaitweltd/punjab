import { useState } from 'react'
import type { FormEvent } from 'react'
import type { SupportTicket } from '../../types'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input, TextArea } from '../../components/ui/Input'
import { DataTable } from '../../components/ui/Table'

export function TicketsPage({
  tickets,
  onCreate,
}: {
  tickets: SupportTicket[]
  onCreate: (subject: string, message: string) => Promise<void>
}) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!subject.trim() || !message.trim()) return
    await onCreate(subject.trim(), message.trim())
    setSubject('')
    setMessage('')
  }

  return (
    <div className="stack">
      <Card title="Create Internal Support Ticket">
        <form className="form-grid" onSubmit={submit}>
          <Input label="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
          <div className="wide">
            <TextArea
              label="Message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
            />
          </div>
          <div className="wide actions-row">
            <Button type="submit">Create Ticket</Button>
          </div>
        </form>
      </Card>

      <Card title="Ticket Queue">
        <DataTable columns={['Subject', 'Created By', 'Customer ID', 'Status', 'Created At']}>
          {tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td>{ticket.subject}</td>
              <td>{ticket.createdByRole}</td>
              <td>{ticket.customerId ?? '-'}</td>
              <td>{ticket.status}</td>
              <td>{ticket.createdAt}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  )
}
