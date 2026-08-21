import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function isPasswordRecoveryUrl() {
  const authType = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type')
    || new URLSearchParams(window.location.search).get('type')
  return authType === 'recovery' || authType === 'invite' || new URLSearchParams(window.location.search).get('setup') === 'password'
}

const validPassword = (value: string) =>
  value.length >= 10 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value)

export function SetPasswordPage({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    if (!supabase) return
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) setReady(true)
    })
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true) })
    return () => sub.subscription.unsubscribe()
  }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('')
    if (!validPassword(password)) { setError('Use at least 10 characters with uppercase, lowercase, a number and a symbol.'); return }
    if (password !== confirm) { setError("Passwords don't match."); return }
    if (!supabase) { setError('Secure account setup is temporarily unavailable.'); return }
    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) { setBusy(false); setError('Your password could not be saved. The link may have expired; request a new one.'); return }
    const { data } = await supabase.auth.getSession()
    if (data.session?.access_token) {
      await fetch('/api/complete-account-setup', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token }, body: '{}' }).catch(() => null)
    }
    window.history.replaceState(null, '', window.location.pathname)
    setBusy(false); setComplete(true)
  }

  return <main className="setup-page">
    <section className="setup-shell">
      <div className="setup-form-side">
        <div className="setup-brand"><img src="/logo.png" alt="" /><span><strong>Punjab Exotic Foods</strong><small>Secure account access</small></span></div>
        {complete ? <div className="setup-success"><span>✓</span><h1>Password saved</h1><p>Your one-time setup is complete. You can now sign in securely.</p><button onClick={onDone}>Continue to login</button></div> : <>
          <div className="setup-heading"><span>ACCOUNT SECURITY</span><h1>Create your password</h1><p>Choose a strong password for your Punjab Exotic Foods account.</p></div>
          {!ready ? <div className="setup-verifying"><span /><div><strong>Verifying secure link</strong><small>This should only take a moment.</small></div></div> :
          <form onSubmit={submit} className="setup-form">
            <label>New Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" required autoFocus /></label>
            <label>Confirm Password<input type="password" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" required /></label>
            <ul className="password-rules"><li className={password.length >= 10 ? 'met' : ''}>At least 10 characters</li><li className={/[A-Z]/.test(password) && /[a-z]/.test(password) ? 'met' : ''}>Uppercase and lowercase letters</li><li className={/\d/.test(password) && /[^A-Za-z0-9]/.test(password) ? 'met' : ''}>A number and a symbol</li></ul>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="setup-submit" type="submit" disabled={busy}>{busy ? 'Saving securely…' : 'Save password'}</button>
          </form>}
        </>}
      </div>
      <div className="setup-visual" aria-hidden="true">
        <div className="setup-preview">
          <header><span /><span /><span /></header>
          <div className="setup-preview-body"><aside>{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</aside><div><div className="preview-stats"><i/><i/><i/></div><div className="preview-chart"><span/><span/><span/><span/><span/><span/></div><div className="preview-table">{Array.from({ length: 5 }, (_, i) => <i key={i} />)}</div></div></div>
        </div>
        <div className="setup-visual-copy"><h2>One secure place for your account</h2><p>Invoices, payments, stock and customer operations protected by verified access.</p></div>
      </div>
    </section>
  </main>
}
