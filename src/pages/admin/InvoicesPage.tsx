import { useMemo } from 'react'
import type { CreditNote, CreditNoteAllocation, Invoice } from '../../types'
import { Card } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/Table'
import { invoiceDisplayStatus, invoiceOutstanding } from '../../lib/creditNotes'

export function InvoicesPage({ invoices, creditNotes = [], allocations = [], onOpenCreditNote }: {
  invoices: Invoice[]
  creditNotes?: CreditNote[]
  allocations?: CreditNoteAllocation[]
  onOpenCreditNote?: (creditNoteId: string) => void
}) {
  const unpaid = useMemo(() => invoices.filter((invoice) => invoiceOutstanding(invoice) > 0), [invoices])

  // DataTable only renders one page of these <tr>s at a time, but building
  // them (including the per-invoice allocation scan below) still happens for
  // the full list on every render - memoize it instead of recomputing on
  // every keystroke/unrelated state change elsewhere on the page.
  const notesByInvoiceId = useMemo(() => {
    const map = new Map<string, CreditNote[]>()
    for (const allocation of allocations) {
      const note = creditNotes.find(c => c.id === allocation.creditNoteId)
      if (!note) continue
      const list = map.get(allocation.invoiceId)
      if (list) list.push(note); else map.set(allocation.invoiceId, [note])
    }
    return map
  }, [allocations, creditNotes])

  const rows = useMemo(() => invoices.map((invoice) => {
    const notes = notesByInvoiceId.get(invoice.id) ?? []
    return (
              <tr key={invoice.id}>
                <td>{invoice.invoiceNumber}</td>
                <td>{invoice.customerId}</td>
                <td>£{invoice.amount.toFixed(2)}</td>
                <td>£{(invoice.amountPaid ?? 0).toFixed(2)}</td>
                <td>£{(invoice.creditApplied ?? 0).toFixed(2)}</td>
                <td>£{invoiceOutstanding(invoice).toFixed(2)}</td>
                <td>{invoice.dueDate}</td>
                <td>{invoiceDisplayStatus(invoice)}</td>
                <td>
                  {notes.length === 0 ? '—' : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {notes.map(note => (
                        <button key={note.id} type="button"
                          onClick={() => onOpenCreditNote?.(note.id)}
                          style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: onOpenCreditNote ? 'pointer' : 'default', color: '#1d4ed8', fontSize: 12.5, textDecoration: 'underline' }}>
                          This invoice has been credited by Credit Note {note.creditNumber}
                        </button>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
    )
  }), [invoices, notesByInvoiceId, onOpenCreditNote])

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
        <DataTable columns={['Invoice Number', 'Customer ID', 'Amount', 'Cash Paid', 'Credits', 'Outstanding', 'Due Date', 'Status', 'Credit Notes']}>
          {rows}
        </DataTable>
      </Card>
    </div>
  )
}
