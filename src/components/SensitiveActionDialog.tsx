import { useEffect, useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { verifySensitiveAction } from '../lib/secureAdminApi'
import { resolveAppError } from '../lib/appErrors'

export function SensitiveActionDialog({ open, title, warning, actionLabel = 'Verify & Continue', onClose, onVerified }: {
  open: boolean; title: string; warning?: string; actionLabel?: string; onClose: () => void; onVerified: (token: string) => Promise<void>
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setPassword(''); setError('') } }, [open])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      const verified = await verifySensitiveAction(password)
      setPassword('')
      await onVerified(verified.token)
    } catch (reason) {
      const resolved = resolveAppError(reason, 402)
      setError(`Error ${resolved.code} — ${resolved.title}. ${resolved.message}`)
    }
    finally { setBusy(false) }
  }

  return <Modal open={open} title="Verify Your Identity" onClose={busy ? () => {} : onClose}>
    <form className="sensitive-dialog" onSubmit={submit}>
      <div className="sensitive-dialog-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div>
      <div><h3>{title}</h3><p>For security, enter your current login password to continue. Verification expires after 10 minutes.</p></div>
      {warning && <div className="sensitive-warning">{warning}</div>}
      <Input label="Current Password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required autoFocus />
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="actions-row">
        <Button type="submit" disabled={busy || !password}>{busy ? 'Verifying...' : actionLabel}</Button>
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
      </div>
    </form>
  </Modal>
}
