import { useEffect, useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Spinner } from './ui/Spinner'
import { findInvoicePdf } from '../lib/fileService'
import type { Invoice, Customer } from '../types'

/** Preview a stored invoice PDF in a popup, no forced download. The PDF is
 *  already the fetched base64 data URI Supabase returned - <embed> renders
 *  it instantly, there's no re-generation or extra round trip. */
export function InvoicePdfModal({ invoice, customer, onClose }: { invoice: Invoice | null; customer: Customer | null; onClose: () => void }) {
  const [dataUri, setDataUri] = useState('')
  const [fileName, setFileName] = useState('')
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    if (!invoice || !customer) return
    setState('loading'); setDataUri('')
    findInvoicePdf(customer.id, invoice.invoiceNumber, invoice.id, invoice.amount).then(file => {
      if (file) { setDataUri(file.dataUri); setFileName(file.name); setState('ready') }
      else setState('missing')
    })
  }, [invoice, customer])

  const download = () => {
    if (!dataUri) return
    const anchor = document.createElement('a'); anchor.href = dataUri; anchor.download = fileName || `Invoice-${invoice?.invoiceNumber}.pdf`; anchor.click()
  }

  return (
    <Modal open={Boolean(invoice)} title={invoice ? `Invoice ${invoice.invoiceNumber}` : 'Invoice'} onClose={onClose} wide>
      <div className="invoice-pdf-modal">
        {state === 'loading' && <div className="invoice-pdf-loading"><Spinner size={20} /> <span>Loading PDF…</span></div>}
        {state === 'missing' && <p className="error-message">No generated PDF is stored for this invoice yet.</p>}
        {state === 'ready' && <embed src={dataUri} type="application/pdf" className="invoice-pdf-embed" />}
        <div className="actions-row" style={{ marginTop: 12 }}>
          <Button variant="secondary" onClick={download} disabled={state !== 'ready'}>Download</Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}
