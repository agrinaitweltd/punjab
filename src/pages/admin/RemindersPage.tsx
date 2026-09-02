import { useMemo, useState } from 'react'
import type { Customer, Invoice, NotificationLog } from '../../types'
import type { CommunicationDeliveryLog } from '../../services/communicationLogService'
import type { ReminderStage } from '../../lib/reminderTemplates'
import { Card } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/Table'
import { DateAccordion } from '../../components/ui/DateAccordion'
import { CommunicationDetailModal } from '../../components/CommunicationDetailModal'
import { invoiceOutstanding } from '../../lib/creditNotes'
import { formatUkPhoneForDisplay } from '../../lib/whatsapp'
import { ReminderStatusButton } from '../../components/ReminderStatusButton'
import { groupByDate } from '../../lib/dateGrouping'
import { reminderMilestoneDate, reminderStageFor } from '../../lib/reminderTemplates'

const money = (value: number) => `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const today = () => new Date().toISOString().slice(0, 10)
const daysBetween = (fromIso: string, toIso: string) => Math.round((new Date(`${toIso}T00:00:00`).getTime() - new Date(`${fromIso}T00:00:00`).getTime()) / 86_400_000)

/** One page, three views, driven by the `view` prop from the Reminders nav
    group. "Due Today" replaces the old automatic sender's daily run (item
    13) with a manual queue an admin works through; "day-14"/"day-21" are
    the separate reminder histories item 8 asked for. */
const linkStyle = { background: "none", border: "none", padding: 0, font: "inherit", color: "#1f7a3a", fontWeight: 600, cursor: "pointer", textDecoration: "underline" } as const

export function RemindersPage({ view, invoices, customers, notificationLogs, deliveryLogs, onSendReminder, onOpenCustomer }: {
  view: 'due-today' | 'day-14' | 'day-21'
  invoices: Invoice[]
  customers: Customer[]
  notificationLogs: NotificationLog[]
  deliveryLogs: CommunicationDeliveryLog[]
  onSendReminder: (invoice: Invoice, customer: Customer, stage: ReminderStage) => void
  /** Jumps to the customer's invoices - the same connected-record pattern
      used from Invoices/Payments/Dashboard. */
  onOpenCustomer?: (customerId: string) => void
}) {
  const [detail, setDetail] = useState<CommunicationDeliveryLog | null>(null)
  const customerFor = (id: string) => customers.find(c => c.id === id)
  const now = today()

  const dueTodayGroups = useMemo(() => {
    if (view !== 'due-today') return null
    const unpaid = invoices.filter(invoice => invoiceOutstanding(invoice) > 0)
    const day14 = unpaid.filter(invoice => invoice.date && daysBetween(invoice.date, now) === 14)
    const day21 = unpaid.filter(invoice => invoice.date && daysBetween(invoice.date, now) === 21)
    const overdue = unpaid.filter(invoice => invoice.date && daysBetween(invoice.date, now) > 21)
    return { day14, day21, overdue }
  }, [view, invoices, now])

  const history = useMemo(() => {
    if (view === 'due-today') return []
    return notificationLogs
      .filter(log => log.reminderStage === view)
      .sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''))
  }, [view, notificationLogs])

  const historyGroups = useMemo(() => groupByDate(history, log => log.sentAt ?? log.scheduledFor ?? '', 'desc'), [history])

  // Due-date-grouped worklist (items 4/5) - every unpaid invoice whose
  // invoice_date + 14 (or +21) falls on a given day, grouped by that
  // milestone date, newest first. Always computed from invoice.date -
  // never created_at/import date/today.
  const milestoneDays = view === 'day-14' ? 14 : 21
  const dueItems = useMemo(() => {
    if (view === 'due-today') return []
    return invoices
      .filter(invoice => invoiceOutstanding(invoice) > 0)
      .map(invoice => ({ invoice, milestone: reminderMilestoneDate(invoice, milestoneDays as 14 | 21) }))
      .filter((row): row is { invoice: Invoice; milestone: string } => Boolean(row.milestone))
  }, [view, invoices, milestoneDays])
  const dueGroups = useMemo(() => groupByDate(dueItems, row => row.milestone, 'desc'), [dueItems])

  const findDelivery = (log: NotificationLog): CommunicationDeliveryLog | undefined =>
    deliveryLogs.find(d => d.invoiceId === log.invoiceId && d.customerId === log.customerId && d.idempotencyKey === log.idempotencyKey)
      ?? deliveryLogs.find(d => d.invoiceId === log.invoiceId && d.customerId === log.customerId && d.sentAt === log.sentAt)

  const openDetail = (log: NotificationLog) => {
    const found = findDelivery(log)
    if (found) { setDetail(found); return }
    const customer = customerFor(log.customerId)
    setDetail({
      id: log.id, customerId: log.customerId, invoiceId: log.invoiceId, type: `reminder_${log.reminderStage ?? ''}`,
      channel: log.channel, recipient: log.channel === 'email' ? (customer?.email ?? '') : (customer?.phone ?? ''),
      status: log.status, error: log.error, createdAt: log.sentAt ?? log.scheduledFor ?? '', sentAt: log.sentAt,
      retryCount: 0, attachmentNames: [],
    })
  }

  const dueRow = (invoice: Invoice, stage: ReminderStage) => {
    const customer = customerFor(invoice.customerId)
    if (!customer) return null
    // The milestone-grouped worklist can include invoices that have since
    // escalated past this stage (or, rarely, aren't due yet) - only allow
    // sending when the invoice's CURRENT stage still matches this view.
    const currentStage = reminderStageFor(invoice)
    return (
      <tr key={invoice.id}>
        <td>{onOpenCustomer ? <button type="button" style={linkStyle} onClick={() => onOpenCustomer(customer.id)}>{customer.companyName}</button> : <strong>{customer.companyName}</strong>}</td>
        <td>{customer.customerNumber}</td>
        <td>{onOpenCustomer ? <button type="button" style={linkStyle} onClick={() => onOpenCustomer(customer.id)}>{invoice.invoiceNumber}</button> : invoice.invoiceNumber}</td>
        <td>{invoice.date}</td>
        <td>{money(invoice.amount)}</td>
        <td><strong>{money(invoiceOutstanding(invoice))}</strong></td>
        <td>{currentStage === stage
          ? <ReminderStatusButton invoice={invoice} onSend={() => onSendReminder(invoice, customer, stage)} />
          : <span style={{ color: '#9ca3af', fontSize: 12 }}>{currentStage ? 'Escalated' : 'Not yet due'}</span>}</td>
      </tr>
    )
  }

  if (view === 'due-today' && dueTodayGroups) {
    return (
      <div className="stack">
        <div className="page-heading"><div><h1>Reminders Due Today</h1><p>Invoices that need a communication today. Reminders are sent manually — review and send each one below.</p></div></div>
        {([
          ['14-Day Reminders Due Today', dueTodayGroups.day14, 'day-14' as ReminderStage],
          ['21-Day Reminders Due Today', dueTodayGroups.day21, 'day-21' as ReminderStage],
          ['21+ Day Follow-ups Due', dueTodayGroups.overdue, '21-plus' as ReminderStage],
        ] as const).map(([title, list, stage]) => (
          <Card key={title} title={`${title} (${list.length})`}>
            {list.length === 0 ? <div className="empty-state">Nothing due here today.</div> : (
              <DataTable columns={['Customer', 'Account', 'Invoice', 'Invoice Date', 'Amount', 'Outstanding', 'Action']}>
                {list.map(invoice => dueRow(invoice, stage))}
              </DataTable>
            )}
          </Card>
        ))}
      </div>
    )
  }

  const historyRow = (log: NotificationLog) => {
    const invoice = invoices.find(i => i.id === log.invoiceId)
    const customer = customerFor(log.customerId)
    const delivery = findDelivery(log)
    return (
      <tr key={log.id}>
        <td>{customer && onOpenCustomer ? <button type="button" style={linkStyle} onClick={() => onOpenCustomer(customer.id)}>{customer.companyName}</button> : (customer?.companyName ?? '—')}</td>
        <td>{customer?.customerNumber ?? '—'}</td>
        <td>{customer && onOpenCustomer ? <button type="button" style={linkStyle} onClick={() => onOpenCustomer(customer.id)}>{invoice?.invoiceNumber ?? log.invoiceId}</button> : (invoice?.invoiceNumber ?? log.invoiceId)}</td>
        <td>{invoice?.date ?? '—'}</td>
        <td>{invoice ? money(invoice.amount) : '—'}</td>
        <td>{(log.sentAt ?? log.scheduledFor ?? '').slice(0, 16).replace('T', ' ')}</td>
        <td>{log.channel === 'email' ? (customer?.email ?? '—') : formatUkPhoneForDisplay(customer?.phone ?? '') || '—'}</td>
        <td><span className={`status-badge ${log.status === 'Failed' ? 'danger' : log.status === 'Sent' ? 'info' : 'warning'}`}>{log.status}</span></td>
        <td>{log.sentBy ?? '—'}</td>
        <td><button className="btn btn-secondary btn-sm" onClick={() => openDetail(log)}>View{delivery?.attachmentNames.length ? ' & Attachment' : ''}</button></td>
      </tr>
    )
  }

  return (
    <div className="stack">
      <div className="page-heading"><div><h1>{view === 'day-14' ? '14-Day Reminders' : '21-Day Reminders'}</h1><p>Organised by reminder due date (invoice date + {milestoneDays} days) below, with the send history kept separately underneath.</p></div></div>
      <Card title={`Due (${dueItems.length})`}>
        <DateAccordion
          groups={dueGroups}
          emptyMessage="No unpaid invoices with this reminder milestone."
          renderGroup={group => (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Customer</th><th>Account</th><th>Invoice</th><th>Invoice Date</th><th>Amount</th><th>Outstanding</th><th>Action</th></tr></thead>
                <tbody>{group.items.map(row => dueRow(row.invoice, view as ReminderStage))}</tbody>
              </table>
            </div>
          )}
        />
      </Card>
      <Card title={`History (${history.length})`}>
        <DateAccordion
          groups={historyGroups}
          emptyMessage={`No ${view === 'day-14' ? '14-day' : '21-day'} reminders have been sent yet.`}
          renderGroup={group => (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Customer</th><th>Account</th><th>Invoice</th><th>Invoice Date</th><th>Amount</th><th>Reminder Time</th><th>Recipient</th><th>Status</th><th>Sent By</th><th>Message</th></tr></thead>
                <tbody>{group.items.map(log => historyRow(log))}</tbody>
              </table>
            </div>
          )}
        />
      </Card>
      <CommunicationDetailModal log={detail} customers={customers} invoices={invoices} onClose={() => setDetail(null)} />
    </div>
  )
}
