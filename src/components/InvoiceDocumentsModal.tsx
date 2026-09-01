import { useEffect, useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Spinner } from './ui/Spinner'
import { getFileById, type StoredFile } from '../lib/fileService'
import type { Invoice } from '../types'

const fmtDateTime = (value?: string) => value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

/** "View Invoice" (item 1) opens this instead of two separate buttons -
    shows the ORIGINAL (received via Email Imports or manually uploaded) and
    GENERATED (system-produced Punjab Exotic Foods PDF) documents together,
    clearly labelled, both linked to this one invoice record (item 11: one
    invoice row, two document pointers - never two invoice records). */
export function InvoiceDocumentsModal({ invoice, onClose, onRegenerate, regenerating }: {
  invoice: Invoice | null
  onClose: () => void
  onRegenerate?: () => void
  regenerating?: boolean
}) {
  const [original, setOriginal] = useState<StoredFile | null | 'loading'>('loading')
  const [generated, setGenerated] = useState<StoredFile | null | 'loading'>('loading')
  const [preview, setPreview] = useState<StoredFile | null>(null)

  useEffect(() => {
    if (!invoice) return
    setOriginal(invoice.sourceDocumentId ? 'loading' : null)
    setGenerated(invoice.canonicalDocumentId ? 'loading' : null)
    if (invoice.sourceDocumentId) getFileById(invoice.sourceDocumentId).then(setOriginal)
    if (invoice.canonicalDocumentId) getFileById(invoice.canonicalDocumentId).then(setGenerated)
  }, [invoice])

  if (!invoice) return null

  const isStatementBackfill = invoice.importedMetadata?.source === 'statement_backfill'
  // item 10: a linked "generated" PDF that came from the pdf-lib fallback
  // renderer (converter was down) is not the official template - surfaced
  // here exactly like a hard generation failure, with the same retry entry
  // point (item 9), rather than looking like a normal success.
  const pdfGenerationPending = Boolean(invoice.importedMetadata?.pdfGenerationPending)
  const pdfGenerationError = typeof invoice.importedMetadata?.pdfGenerationError === 'string' ? invoice.importedMetadata.pdfGenerationError : ''
  const download = (file: StoredFile) => { const anchor = document.createElement('a'); anchor.href = file.dataUri; anchor.download = file.name; anchor.click() }

  const section = (title: string, state: StoredFile | null | 'loading', emptyReason: string) => (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6b7280', margin: '0 0 6px' }}>{title}</p>
      {state === 'loading' && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: 13 }}><Spinner size={14} /> Loading…</div>}
      {state === null && <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>{emptyReason}</p>}
      {state && state !== 'loading' && (
        <div>
          <p style={{ fontSize: 13, color: '#374151', margin: '0 0 8px' }}>
            {title.startsWith('Original') ? 'Received' : 'Generated'}: <strong>{fmtDateTime(state.uploadedAt)}</strong>
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="secondary" className="btn-sm" onClick={() => setPreview(state)}>View</Button>
            <Button variant="secondary" className="btn-sm" onClick={() => download(state)}>Download</Button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      <Modal open={Boolean(invoice) && !preview} title={`Invoice ${invoice.invoiceNumber}`} onClose={onClose}>
        <div className="stack" style={{ gap: 12 }}>
          {pdfGenerationPending && (
            <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px' }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: '#854d0e', margin: '0 0 3px' }}>Generated PDF: Failed — Needs Review</p>
              <p style={{ fontSize: 12.5, color: '#854d0e', margin: 0 }}>{pdfGenerationError || 'The official PDF could not be generated. A basic fallback version is shown below if one exists.'}</p>
            </div>
          )}
          {section('Original Invoice', original, 'No original document on file for this invoice.')}
          {section(
            'Generated Invoice',
            generated,
            isStatementBackfill
              ? 'No PDF — this invoice was backfilled from historical customer-statement data; no original document or generated PDF was ever created for it.'
              : 'No system-generated PDF for this invoice yet.',
          )}
          {onRegenerate && (
            <Button variant="ghost" disabled={regenerating} onClick={onRegenerate}>
              {regenerating ? 'Regenerating…' : pdfGenerationPending ? 'Retry PDF Generation' : 'Regenerate Official PDF'}
            </Button>
          )}
          <div className="actions-row"><Button variant="secondary" onClick={onClose}>Close</Button></div>
        </div>
      </Modal>
      <Modal open={Boolean(preview)} title={preview?.name ?? 'Document'} onClose={() => setPreview(null)} wide>
        {preview && <embed src={preview.dataUri} type="application/pdf" className="invoice-pdf-embed" />}
        <div className="actions-row" style={{ marginTop: 12 }}><Button variant="ghost" onClick={() => setPreview(null)}>Back</Button></div>
      </Modal>
    </>
  )
}
