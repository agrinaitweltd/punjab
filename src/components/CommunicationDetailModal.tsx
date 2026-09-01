import { useEffect, useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import type { Customer, Invoice } from '../types'
import type { CommunicationDeliveryLog } from '../services/communicationLogService'
import { findInvoicePdf, type StoredFile } from '../lib/fileService'

/** Full detail view for a single sent communication (item 7) - shows exactly
    what CommunicationHistoryPage's "View" button previously failed to: the
    actual recipient, subject, body, attachment, and related
    customer/invoice/status, instead of just re-navigating the page. */
export function CommunicationDetailModal({ log, customers, invoices, onClose }: {
  log: CommunicationDeliveryLog | null
  customers: Customer[]
  invoices: Invoice[]
  onClose: () => void
}) {
  const [attachment, setAttachment] = useState<StoredFile | null>(null)

  const customer = customers.find(c => c.id === log?.customerId)
  const invoice = invoices.find(i => i.id === log?.invoiceId)

  useEffect(() => {
    setAttachment(null)
    if (!log?.attachmentNames.length || !customer || !invoice) return
    findInvoicePdf(customer.id, invoice.invoiceNumber, invoice.id, invoice.amount).then(setAttachment)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log?.id])

  const downloadAttachment = () => {
    if (!attachment) return
    const anchor = document.createElement('a'); anchor.href = attachment.dataUri; anchor.download = attachment.name; anchor.click()
  }

  return (
    <Modal open={Boolean(log)} title={log ? (log.subject || 'Communication') : 'Communication'} onClose={onClose} wide>
      {log && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="form-grid" style={{ fontSize: 13.5 }}>
            <div><strong>Recipient</strong><div style={{ color: '#4b5563' }}>{log.recipient || '—'}</div></div>
            <div><strong>Sender</strong><div style={{ color: '#4b5563' }}>{log.senderEmail || '—'}</div></div>
            <div><strong>Date/Time</strong><div style={{ color: '#4b5563' }}>{(log.sentAt || log.createdAt || '').replace('T', ' ').slice(0, 19)}</div></div>
            <div><strong>Status</strong><div style={{ color: log.status === 'Sent' ? '#15803d' : log.status === 'Failed' ? '#b91c1c' : '#a16207' }}>{log.status}{log.error ? ` — ${log.error}` : ''}</div></div>
            <div><strong>Related Customer</strong><div style={{ color: '#4b5563' }}>{customer?.companyName || '—'}</div></div>
            <div><strong>Related Invoice</strong><div style={{ color: '#4b5563' }}>{invoice?.invoiceNumber || '—'}</div></div>
            {log.providerMessageId && <div><strong>Provider Message ID</strong><div style={{ color: '#4b5563', fontSize: 12 }}>{log.providerMessageId}</div></div>}
          </div>

          <div>
            <strong style={{ fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 0.4, color: '#6b7280' }}>Message</strong>
            {log.html ? (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, marginTop: 6, overflow: 'hidden' }}>
                <iframe title="Message body" srcDoc={log.html} style={{ width: '100%', height: 360, border: 'none', background: '#fff' }} />
              </div>
            ) : (
              <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 6 }}>No message body was stored for this send (sent before message content was recorded).</p>
            )}
          </div>

          {log.attachmentNames.length > 0 && (
            <div>
              <strong style={{ fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 0.4, color: '#6b7280' }}>Attachment</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                <span style={{ fontSize: 13.5 }}>{log.attachmentNames.join(', ')}</span>
                {attachment && <Button variant="secondary" className="btn-sm" onClick={downloadAttachment}>Download</Button>}
              </div>
            </div>
          )}

          <div className="actions-row" style={{ marginTop: 8 }}>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
