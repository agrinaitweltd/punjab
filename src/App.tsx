import { Component, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import './App.css'
import { loginUser, logoutUser } from './api/authApi'
import { LoginPage } from './pages/LoginPage'
import { SetPasswordPage, isPasswordRecoveryUrl } from './pages/SetPasswordPage'
import { QuickUnlock } from './pages/QuickUnlock'
import { AdminPortal } from './pages/admin/AdminPortal'
import { CustomerPortal } from './pages/customer/CustomerPortal'
import { SyncStatus } from './components/SyncStatus'
import { CookieConsent } from './components/CookieConsent'
import { RememberDeviceModal } from './components/RememberDeviceModal'
import { getDeviceAccount, hasBeenPromptedToRemember, markPromptedToRemember } from './lib/deviceAuth'
import type { User } from './types'
import { getSystemMode } from './lib/secureAdminApi'
import { setRuntimeTestMode } from './lib/runtimeMode'
import { AppDialogs } from './components/AppDialogs'
import { SuccessToastStack } from './components/SuccessToastStack'
import { supabase } from './lib/supabase'
import { showAppError } from './lib/appDialogs'

// Blanket coverage for the ~30+ action handlers across the app that don't
// individually handle their errors (fired with `void`) - anything that
// slips through still surfaces as a coded 801 error instead of failing
// silently. Flows that matter enough to get a precise code do so at their
// own throw site via resolveAppError/appError instead.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', event => {
    showAppError(event.reason, { feature: 'Unhandled', fallbackCode: 801 })
  })
}

/** Only a System Developer sees the raw crash message (and the schema.sql
    hint below it) - everyone else gets a safe, generic message. A crash
    before login (isSystemDeveloper undefined) also gets the safe message,
    since nobody's role is known yet at that point. */
class ErrorBoundary extends Component<{ children: ReactNode; isSystemDeveloper?: boolean }, { error: string | null }> {
  constructor(props: { children: ReactNode; isSystemDeveloper?: boolean }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(e: Error) { return { error: e.message } }
  render() {
    if (this.state.error) {
      const showTechnical = this.props.isSystemDeveloper
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f7f2', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '36px 40px', maxWidth: 480, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16, background: '#fef3c7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16, color: '#d97706', margin: '0 auto 16px'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 13.5, color: '#6b7280', marginBottom: 20 }}>
              {showTechnical ? this.state.error : 'Unable to complete this action right now. Please try again shortly.'}
            </p>
            {showTechnical && (
              <p style={{ fontSize: 12.5, color: '#9ca3af' }}>
                If Supabase tables are not set up yet, run <strong>src/lib/schema.sql</strong> in your Supabase SQL editor first.
              </p>
            )}
            <button onClick={() => this.setState({ error: null })} style={{ marginTop: 20, padding: '9px 20px', background: '#22913f', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              Try Again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const SESSION_KEY = 'punjab-session-user'

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function App() {
  const [user, setUser] = useState<User | null>(() => loadStoredUser())
  const [modeReady, setModeReady] = useState(() => !loadStoredUser())
  const [error, setError] = useState('')
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [rememberPrompt, setRememberPrompt] = useState<{
    role: 'admin' | 'customer'; displayName: string; usernameOrEmail: string; password: string
  } | null>(null)

  // OAuth (e.g. "Continue with Google") signs the user into Supabase Auth
  // directly - there is no self-service provisioning path yet linking that
  // account to an admin_staff/customers row, so a fresh OAuth sign-in with
  // no matching Punjab account would otherwise land back here with a
  // dangling Supabase session and no explanation. Catch that case once on
  // mount and surface it clearly instead of silently doing nothing.
  useEffect(() => {
    if (user || !supabase || isPasswordRecoveryUrl()) return
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setError('No Punjab Exotic Foods account is linked to this sign-in yet. Ask a System Developer to link your account, or sign in with your email and password.')
        void supabase!.auth.signOut()
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let active = true
    if (!user) {
      setRuntimeTestMode(false)
      setModeReady(true)
      return () => { active = false }
    }
    setModeReady(false)
    const restoreSession = async () => {
      const sessionResult = supabase ? await supabase.auth.getSession() : null
      const session = sessionResult?.data.session
      const expectedAccountId = session?.user.app_metadata?.legacy_id
      if (supabase && (sessionResult?.error || !session || (expectedAccountId && expectedAccountId !== user.id))) {
        try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
        setRuntimeTestMode(false)
        if (active) { setUser(null); setModeReady(true) }
        return
      }
      try {
        const mode = await getSystemMode()
        if (active) setRuntimeTestMode(mode.testMode)
      } catch {
        if (active) setRuntimeTestMode(false)
      } finally {
        if (active) setModeReady(true)
      }
    }
    void restoreSession()
    return () => { active = false }
  }, [user])

  if (isPasswordRecoveryUrl()) {
    return <SetPasswordPage onDone={() => window.location.reload()} />
  }

  const deviceAccount = !showSwitcher ? getDeviceAccount() : null

  const handleLogin = async (
    role: 'admin' | 'customer',
    usernameOrEmail: string,
    password: string,
  ) => {
    setError('')
    const loggedInUser = await loginUser(role, usernameOrEmail.trim(), password)
    if (!loggedInUser) {
      setError('Invalid login details.')
      return
    }
    setUser(loggedInUser)
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(loggedInUser)) } catch { /* ignore */ }
    setShowSwitcher(false)
    if (role !== 'admin' && !hasBeenPromptedToRemember() && !getDeviceAccount()) {
      setRememberPrompt({ role, displayName: loggedInUser.displayName, usernameOrEmail: usernameOrEmail.trim(), password })
    }
  }

  const handleQuickUnlock = async (usernameOrEmail: string, password: string, role: 'admin' | 'customer') => {
    await handleLogin(role, usernameOrEmail, password)
  }

  const handleLogout = async () => {
    await logoutUser()
    try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
    setUser(null)
  }

  const dismissRememberPrompt = () => {
    markPromptedToRemember()
    setRememberPrompt(null)
  }

  if (!user && deviceAccount) {
    return (
      <ErrorBoundary>
        <QuickUnlock account={deviceAccount} onUnlocked={handleQuickUnlock} onSwitchAccount={() => setShowSwitcher(true)} />
      </ErrorBoundary>
    )
  }

  if (user && !modeReady) {
    return <div className="portal-boot"><img src="/logo.png" alt="" /><strong>Preparing your workspace</strong><span>Loading the correct data environment...</span></div>
  }

  return (
    <ErrorBoundary isSystemDeveloper={user?.role === 'admin' && user.isSystemDeveloper}>
      <AppDialogs />
      <SuccessToastStack />
      {!user ? <LoginPage onLogin={handleLogin} error={error} /> : null}
      {user?.role === 'admin' ? <AdminPortal user={user} onLogout={handleLogout} /> : null}
      {user?.role === 'customer' ? <CustomerPortal user={user} onLogout={handleLogout} /> : null}
      <SyncStatus />
      <CookieConsent />
      <RememberDeviceModal open={Boolean(rememberPrompt)} account={rememberPrompt} onDone={dismissRememberPrompt} />
    </ErrorBoundary>
  )
}

export default App
