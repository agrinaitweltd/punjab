import { useEffect, useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Spinner } from './ui/Spinner'
import { getFileById } from '../lib/fileService'

/** Previews a stored PDF by its exact activity_log file id - simpler and
    more reliable than re-deriving a match by customer/invoice number, and
    the right tool when the caller already knows exactly which file it wants
    (e.g. an invoice's own sourceDocumentId vs canonicalDocumentId, item 16). */
export function StoredFileModal({ fileId, title, onClose }: { fileId: string | null; title: string; onClose: () => void }) {
  const [dataUri, setDataUri] = useState('')
  const [fileName, setFileName] = useState('')
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    if (!fileId) return
    setState('loading'); setDataUri('')
    getFileById(fileId).then(file => {
      if (file) { setDataUri(file.dataUri); setFileName(file.name); setState('ready') }
      else setState('missing')
    })
  }, [fileId])

  const download = () => {
    if (!dataUri) return
    const anchor = document.createElement('a'); anchor.href = dataUri; anchor.download = fileName || 'document.pdf'; anchor.click()
  }

  return (
    <Modal open={Boolean(fileId)} title={title} onClose={onClose} wide>
      <div className="invoice-pdf-modal">
        {state === 'loading' && <div className="invoice-pdf-loading"><Spinner size={20} /> <span>Loading PDF…</span></div>}
        {state === 'missing' && <p className="error-message">This document could not be found.</p>}
        {state === 'ready' && <embed src={dataUri} type="application/pdf" className="invoice-pdf-embed" />}
        <div className="actions-row" style={{ marginTop: 12 }}>
          <Button variant="secondary" onClick={download} disabled={state !== 'ready'}>Download</Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}
