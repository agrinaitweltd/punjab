import { useEffect, useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Spinner } from './ui/Spinner'
import type { AppErrorRequest } from '../lib/appDialogs'
import { reportError } from '../lib/secureAdminApi'

export function AppErrorDialog() {
  const [current, setCurrent] = useState<AppErrorRequest | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const onError = (event: Event) => {
      setCurrent((event as CustomEvent<AppErrorRequest>).detail)
      setShowReport(false); setNote(''); setSent(false)
    }
    window.addEventListener('app-error', onError)
    return () => window.removeEventListener('app-error', onError)
  }, [])

  if (!current) return null

  const close = () => setCurrent(null)
  const retry = () => { current.retry?.(); close() }
  const submitReport = async () => {
    setSending(true)
    try {
      await reportError({
        code: current.code, title: current.title, message: current.message, technicalDetail: current.technicalDetail,
        feature: current.feature, context: current.context, note: note.trim() || undefined,
      })
      setSent(true)
    } catch {
      setSent(false)
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal open title={`Error ${current.code} — ${current.title}`} onClose={close}>
      <div className="app-error-dialog">
        <p className="app-error-code">Error {current.code}</p>
        <p className="app-error-message">{current.message}</p>

        {sent ? (
          <p className="app-error-sent">Error report sent successfully.</p>
        ) : showReport ? (
          <div className="app-error-report-form">
            <label className="form-control">
              <span>Add a short note (optional)</span>
              <textarea rows={2} value={note} onChange={event => setNote(event.target.value)} placeholder="What were you doing when this happened?" />
            </label>
            <div className="modal-actions">
              <Button onClick={submitReport} disabled={sending}>{sending ? <><Spinner size={13} /> Sending…</> : 'Submit Report'}</Button>
              <Button variant="secondary" onClick={() => setShowReport(false)} disabled={sending}>Back</Button>
            </div>
          </div>
        ) : (
          <div className="modal-actions">
            {current.retryable && current.retry && <Button onClick={retry}>Try Again</Button>}
            <Button variant="secondary" onClick={() => setShowReport(true)}>Send this error to System Developer</Button>
            <Button variant="ghost" onClick={close}>Close</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
