import { useMemo, useState } from 'react'
import type { Customer, Invoice, NotificationLog, WhatsAppLog } from '../../types'
import { Card } from '../../components/ui/Card'
import { DateAccordion } from '../../components/ui/DateAccordion'
import type { CommunicationDeliveryLog } from '../../services/communicationLogService'
import { CommunicationDetailModal } from '../../components/CommunicationDetailModal'
import { groupByDate } from '../../lib/dateGrouping'

type Row = {
  id: string
  date: string
  customer: string
  invoice: string
  action: string
  channel: string
  status: string
  error: string
  detail: CommunicationDeliveryLog
}

export function CommunicationHistoryPage({ customers, invoices, emailLogs, deliveryLogs, whatsappLogs, onNavigate }: {
  customers: Customer[]; invoices: Invoice[]; emailLogs: NotificationLog[]; deliveryLogs: CommunicationDeliveryLog[]; whatsappLogs: WhatsAppLog[]; onNavigate: (p: string) => void
}) {
  const [detail, setDetail] = useState<CommunicationDeliveryLog | null>(null)
  const [query, setQuery] = useState('')

  // Every email send (reminder, invoice, receipt...) now lands in
  // communication_logs (deliveryLogs) with a full recipient/subject/body -
  // `legacy` is only the older notification_logs rows from before that
  // table existed, kept so their history isn't lost.
  const deliveredIds = new Set(deliveryLogs.map(x => `${x.invoiceId || ''}:${x.customerId || ''}:${x.sentAt || x.createdAt}`))
  const legacy = emailLogs.filter(x => x.channel === 'email' && !deliveredIds.has(`${x.invoiceId || ''}:${x.customerId || ''}:${x.sentAt || x.scheduledFor || ''}`))

  const rows: Row[] = [
    ...deliveryLogs.map((x): Row => ({
      id: `d-${x.id}`, date: x.sentAt || x.createdAt,
      customer: customers.find(c => c.id === x.customerId)?.companyName || x.recipient || '—',
      invoice: invoices.find(i => i.id === x.invoiceId)?.invoiceNumber || '—',
      action: x.subject || x.type, channel: x.senderEmail ? `Email · ${x.senderEmail}` : 'Email',
      status: x.status, error: x.error || '', detail: x,
    })),
    ...legacy.map((x): Row => ({
      id: `n-${x.id}`, date: x.sentAt || x.scheduledFor || '',
      customer: customers.find(c => c.id === x.customerId)?.companyName || x.customerId,
      invoice: invoices.find(i => i.id === x.invoiceId)?.invoiceNumber || x.invoiceId,
      action: 'Payment Reminder', channel: 'Email', status: x.status, error: x.error || '',
      detail: {
        id: x.id, customerId: x.customerId, invoiceId: x.invoiceId, type: 'payment_reminder', channel: 'email',
        recipient: customers.find(c => c.id === x.customerId)?.email || '', status: x.status, error: x.error,
        createdAt: x.sentAt || x.scheduledFor || '', sentAt: x.sentAt, subject: 'Payment Reminder', retryCount: 0,
        attachmentNames: [],
      },
    })),
    ...whatsappLogs.map((x): Row => ({
      id: `w-${x.id}`, date: x.sentAt || '',
      customer: x.customerName || customers.find(c => c.id === x.customerId)?.companyName || '—',
      invoice: '—', action: x.type, channel: 'WhatsApp', status: x.status, error: x.response || '',
      detail: {
        id: x.id, customerId: x.customerId, type: x.type, channel: 'whatsapp', recipient: x.phone,
        status: x.status, error: x.response, createdAt: x.sentAt || '', sentAt: x.sentAt, subject: x.type,
        retryCount: 0, attachmentNames: [], html: `<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px">${x.message.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]!))}</pre>`,
      },
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))
  const failed = rows.filter(x => x.status === 'Failed').length

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(x => `${x.customer} ${x.invoice} ${x.action} ${x.channel} ${x.status}`.toLowerCase().includes(q))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query])
  const groups = useMemo(() => groupByDate(filteredRows, x => x.date, 'desc'), [filteredRows])

  return (
    <div className="stack">
      <div className="page-heading"><div><h1>Communication History</h1><p>Email, WhatsApp, reminders, payment confirmations and failed sends in one audit trail.</p></div></div>
      <div className="overview-grid">
        <Card title="All Communications"><p className="metric">{rows.length}</p></Card>
        <Card title="Failed Notifications"><p className="metric">{failed}</p></Card>
      </div>
      <Card title="Automation & Send Log">
        <label className="data-table-search" style={{ marginBottom: 12 }}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search customer, invoice, action, channel, status…" aria-label="Search communication history" />
        </label>
        <DateAccordion
          groups={groups}
          emptyMessage="No communications yet."
          renderGroup={group => (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Time</th><th>Customer / Recipient</th><th>Invoice</th><th>Action</th><th>Channel / Sender</th><th>Status</th><th>Error</th><th>Actions</th></tr></thead>
                <tbody>
                  {group.items.map(x => (
                    <tr key={x.id}>
                      <td>{x.date.slice(11, 16) || '—'}</td>
                      <td>{x.customer}</td>
                      <td>{x.invoice}</td>
                      <td>{x.action}</td>
                      <td>{x.channel}</td>
                      <td><span className={`status-badge ${x.status === 'Failed' ? 'danger' : x.status === 'Sent' ? 'info' : 'warning'}`}>{x.status}</span></td>
                      <td title={x.error}>{x.status === 'Failed' ? (x.error.slice(0, 70) || 'Send failed') : '—'}</td>
                      <td>
                        {x.status === 'Failed'
                          ? <button className="btn btn-secondary btn-sm" onClick={() => onNavigate(x.channel === 'WhatsApp' ? 'communication-history' : 'reminders-due-today')}>Retry</button>
                          : <button className="btn btn-secondary btn-sm" onClick={() => setDetail(x.detail)}>View</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        />
      </Card>
      <CommunicationDetailModal log={detail} customers={customers} invoices={invoices} onClose={() => setDetail(null)} />
    </div>
  )
}
