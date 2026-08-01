import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/** True once Supabase's recovery-link redirect has landed here and the
    client has parsed a session out of the URL — checked before rendering
    so we never show this page for an ordinary visit. */
export function isPasswordRecoveryUrl() {
  return /type=recovery/.test(window.location.hash) || /type=recovery/.test(window.location.search)
}

export function SetPasswordPage({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!supabase) return
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    // The event can fire before this listener is attached — recheck the
    // current session directly as a fallback.
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true) })
    return () => sub.subscription.unsubscribe()
  }, [])

  const submit = async () => {
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError("Passwords don't match."); return }
    if (!supabase) { setError('Not connected to Supabase.'); return }
    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (updateError) { setError(updateError.message); return }
    // Clean the recovery params out of the URL, then hand back to the app.
    window.history.replaceState(null, '', window.location.pathname)
    onDone()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f7f2', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '36px 40px', maxWidth: 400, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 6 }}>Set your password</h2>
        <p style={{ fontSize: 13.5, color: '#6b7280', marginBottom: 20 }}>
          {ready
            ? "You're switching to secure login — pick a password you'll use going forward."
            : 'Verifying your recovery link…'}
        </p>
        {ready && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="password" placeholder="New password" value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14 }} />
            <input type="password" placeholder="Confirm password" value={confirm}
              onChange={e => setConfirm(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14 }} />
            {error && <p style={{ color: '#b91c1c', fontSize: 13, background: '#fef2f2', borderRadius: 8, padding: '8px 12px', margin: 0 }}>{error}</p>}
            <button onClick={submit} disabled={busy}
              style={{ marginTop: 4, padding: '10px 20px', background: '#22913f', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              {busy ? 'Saving…' : 'Save password'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
