import { useEffect, useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import type { ConfirmRequest } from '../lib/appDialogs'

export function AppDialogs() {
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const onConfirm = (event: Event) => setConfirm((event as CustomEvent<ConfirmRequest>).detail)
    const onNotice = (event: Event) => setNotice((event as CustomEvent<string>).detail)
    window.addEventListener('app-confirm', onConfirm)
    window.addEventListener('app-notice', onNotice)
    return () => { window.removeEventListener('app-confirm', onConfirm); window.removeEventListener('app-notice', onNotice) }
  }, [])
  const answer = (value: boolean) => { confirm?.resolve(value); setConfirm(null) }
  return <>
    <Modal open={Boolean(confirm)} title="Please Confirm" onClose={() => answer(false)}><div className="app-dialog-copy"><p>{confirm?.message}</p><div className="modal-actions"><Button variant="danger" onClick={() => answer(true)}>Confirm Action</Button><Button variant="secondary" onClick={() => answer(false)}>Cancel</Button></div></div></Modal>
    <Modal open={Boolean(notice)} title="Action Required" onClose={() => setNotice('')}><div className="app-dialog-copy"><p>{notice}</p><div className="modal-actions"><Button onClick={() => setNotice('')}>OK</Button></div></div></Modal>
  </>
}
