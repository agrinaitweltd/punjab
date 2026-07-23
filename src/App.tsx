import { Component, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import './App.css'
import { loginUser, loginWithGoogleEmail, logoutUser } from './api/authApi'
import { supabase } from './lib/supabase'
import { LoginPage } from './pages/LoginPage'
import { QuickUnlock } from './pages/QuickUnlock'
import { AdminPortal } from './pages/admin/AdminPortal'
import { CustomerPortal } from './pages/customer/CustomerPortal'
import { SyncStatus } from './components/SyncStatus'
import { CookieConsent } from './components/CookieConsent'
import { RememberDeviceModal } from './components/RememberDeviceModal'
import { getDeviceAccount, hasBeenPromptedToRemember, markPromptedToRemember } from './lib/deviceAuth'
import type { User } from './types'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(e: Error) { return { error: e.message } }
  render() {
    if (this.state.error) {
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
            <p style={{ fontSize: 13.5, color: '#6b7280', marginBottom: 20 }}>{this.state.error}</p>
            <p style={{ fontSize: 12.5, color: '#9ca3af' }}>
              If Supabase tables are not set up yet, run <strong>src/lib/schema.sql</strong> in your Supabase SQL editor first.
            </p>
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
  const [error, setError] = useState('')
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [rememberPrompt, setRememberPrompt] = useState<{
    role: 'admin' | 'customer'; displayName: string; usernameOrEmail: string; password: string
  } | null>(null)

  const deviceAccount = !showSwitcher ? getDeviceAccount() : null

  // Complete "Continue with Google": after the OAuth redirect Supabase holds
  // the Google session — match its verified email to an account (or create a
  // customer account) and go straight to the dashboard.
  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    const completeGoogle = async (email?: string | null, name?: string) => {
      if (!email || cancelled) return
      const loggedIn = await loginWithGoogleEmail(email, name)
      if (loggedIn && !cancelled) {
        setUser(loggedIn)
        try { localStorage.setItem(SESSION_KEY, JSON.stringify(loggedIn)) } catch { /* ignore */ }
        // The Google identity has served its purpose — clear it so logout is clean.
        void supabase?.auth.signOut()
      }
    }
    // Handles the fresh redirect back from Google
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        void completeGoogle(session?.user?.email, (session?.user?.user_metadata?.full_name as string) || undefined)
      }
    })
    // Handles a session already present on load
    if (!user) {
      supabase.auth.getSession().then(({ data }) => {
        void completeGoogle(data.session?.user?.email, (data.session?.user?.user_metadata?.full_name as string) || undefined)
      })
    }
    return () => { cancelled = true; sub.subscription.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    if (!hasBeenPromptedToRemember() && !getDeviceAccount()) {
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

  return (
    <ErrorBoundary>
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
