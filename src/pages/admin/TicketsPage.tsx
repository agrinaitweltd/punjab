import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { SupportTicket } from '../../types'
import { Button } from '../../components/ui/Button'
import { Input, TextArea } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'

const STATUS_META: Record<SupportTicket['status'], { bg: string; color: string }> = {
  Open:        { bg: '#fef9c3', color: '#a16207' },
  'In Progress': { bg: '#dbeafe', color: '#1d4ed8' },
  Closed:      { bg: '#f3f4f6', color: '#6b7280' },
}
/* Tickets move forward through a fixed workflow — no free-form status editing. */
const NEXT_STEP: Partial<Record<SupportTicket['status'], { status: SupportTicket['status']; label: string }>> = {
  Open: { status: 'In Progress', label: 'Start Working' },
  'In Progress': { status: 'Closed', label: 'Resolve & Close' },
}
const STATUS_FILTERS: (SupportTicket['status'] | 'All')[] = ['All', 'Open', 'In Progress', 'Closed']

export function TicketsPage({
  tickets, onCreate, onUpdateStatus,
}: {
  tickets: SupportTicket[]
  onCreate: (subject: string, message: string) => Promise<void>
  onUpdateStatus?: (id: string, status: SupportTicket['status']) => Promise<void>
}) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [query, setQuery] = useState('')
  const [statusIdx, setStatusIdx] = useState(0)
  const [detail, setDetail] = useState<SupportTicket | null>(null)
  const [busy, setBusy] = useState(false)

  const statusFilter = STATUS_FILTERS[statusIdx]
  const cycleStatus = () => setStatusIdx(i => (i + 1) % STATUS_FILTERS.length)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tickets.filter(t =>
      (statusFilter === 'All' || t.status === statusFilter) &&
      (!q || `${t.subject} ${t.message}`.toLowerCase().includes(q))
    ).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [tickets, query, statusFilter])

  const openCount = tickets.filter(t => t.status === 'Open').length

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!subject.trim() || !message.trim()) return
    await onCreate(subject.trim(), message.trim())
    setSubject(''); setMessage(''); setShowCreate(false)
  }

  const advance = async (t: SupportTicket) => {
    const step = NEXT_STEP[t.status]
    if (!step || !onUpdateStatus) return
    setBusy(true)
    await onUpdateStatus(t.id, step.status)
    setDetail(d => d && d.id === t.id ? { ...d, status: step.status } : d)
    setBusy(false)
  }

  return (
    <div className="stack">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0d2b1e' }}>Support Tickets</h2>
          <p style={{ fontSize: 13.5, color: '#6b7a70', marginTop: 3 }}>
            Tickets move forward — start working, then resolve. Closed tickets are final.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New Internal Ticket</Button>
      </div>

      <div className="stk-health" style={{ marginBottom: 0 }}>
        <div className="stk-pill"><span className="stk-num" style={{ color: '#a16207' }}>{openCount}</span> Open</div>
        <div className="stk-pill"><span className="stk-num" style={{ color: '#1d4ed8' }}>{tickets.filter(t => t.status === 'In Progress').length}</span> In Progress</div>
        <div className="stk-pill"><span className="stk-num" style={{ color: '#6b7280' }}>{tickets.filter(t => t.status === 'Closed').length}</span> Closed</div>
        <div className="ps-search-wrap" style={{ marginLeft: 'auto', maxWidth: 240, padding: '7px 12px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="ps-search" placeholder="Search tickets…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <button className="ps-tool-btn" onClick={cycleStatus} title="Cycle status filter">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          {statusFilter === 'All' ? 'Filter' : statusFilter}
        </button>
      </div>

      <div className="ps-table-card">
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr>
              <th>Subject</th>
              <th>Raised By</th>
              <th>Status</th>
              <th>Created</th>
              <th>Action</th>
            </tr></thead>
            <tbody>
              {filtered.map(t => {
                const meta = STATUS_META[t.status]
                const step = NEXT_STEP[t.status]
                return (
                  <tr key={t.id} className="ps-row cd-row-clickable" onClick={() => setDetail(t)}>
                    <td>
                      <strong>{t.subject}</strong>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{t.message.slice(0, 60)}{t.message.length > 60 ? '…' : ''}</div>
                    </td>
                    <td style={{ color: '#6b7280', textTransform: 'capitalize' }}>{t.createdByRole}{t.customerId ? ` · ${t.customerId}` : ''}</td>
                    <td><span className="ps-badge" style={{ background: meta.bg, color: meta.color }}>{t.status}</span></td>
                    <td style={{ color: '#6b7280', fontSize: 13 }}>{t.createdAt}</td>
                    <td onClick={e => e.stopPropagation()}>
                      {step
                        ? <Button className="btn-sm" onClick={() => advance(t)} disabled={busy}>{step.label}</Button>
                        : <span className="ord-final-tag">Closed</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9ca3af' }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#c3c9d2" strokeWidth="1.6" style={{ marginBottom: 8 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <div style={{ fontWeight: 600, marginBottom: 4, color: '#374151' }}>No tickets found</div>
              <div style={{ fontSize: 13 }}>Support tickets from customers and staff will appear here.</div>
            </div>
          )}
        </div>
      </div>

      {/* Create internal ticket */}
      <Modal open={showCreate} title="Create Internal Support Ticket" onClose={() => setShowCreate(false)}>
        <form className="form-grid" onSubmit={submit}>
          <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="wide" required />
          <div className="wide"><TextArea label="Message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} /></div>
          <div className="wide actions-row">
            <Button type="submit">Create Ticket</Button>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Ticket detail + workflow */}
      <Modal open={Boolean(detail)} title={detail?.subject ?? 'Ticket'} onClose={() => setDetail(null)}>
        {detail && (
          <div>
            <div className="ord-row" style={{ border: '1px solid var(--border)', borderRadius: 12, marginBottom: 14 }}>
              <span>Status</span>
              <span className="ps-badge" style={{ background: STATUS_META[detail.status].bg, color: STATUS_META[detail.status].color }}>{detail.status}</span>
            </div>
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>
              Raised {detail.createdAt} by {detail.createdByRole}{detail.customerId ? ` (customer ${detail.customerId})` : ''}
            </p>
            <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.6, background: '#fafbfc', border: '1px solid var(--border-light)', borderRadius: 10, padding: 14 }}>
              {detail.message || 'No message provided.'}
            </p>
            {detail.status === 'Closed' && (
              <div className="ord-cancelled-note" style={{ background: '#f3f4f6', borderColor: '#e5e7eb', color: '#6b7280' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                This ticket is closed.
              </div>
            )}
            <div className="actions-row" style={{ marginTop: 16 }}>
              {NEXT_STEP[detail.status] && (
                <Button disabled={busy} onClick={() => advance(detail)}>{NEXT_STEP[detail.status]!.label}</Button>
              )}
              <Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
