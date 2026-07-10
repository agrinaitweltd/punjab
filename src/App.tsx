import { Component, useState } from 'react'
import type { ReactNode } from 'react'
import './App.css'
import { loginUser, logoutUser } from './api/authApi'
import { LoginPage } from './pages/LoginPage'
import { AdminPortal } from './pages/admin/AdminPortal'
import { CustomerPortal } from './pages/customer/CustomerPortal'
import { SyncStatus } from './components/SyncStatus'
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
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
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

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')

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
  }

  const handleLogout = async () => {
    await logoutUser()
    setUser(null)
  }

  return (
    <ErrorBoundary>
      {!user ? <LoginPage onLogin={handleLogin} error={error} /> : null}
      {user?.role === 'admin' ? <AdminPortal user={user} onLogout={handleLogout} /> : null}
      {user?.role === 'customer' ? <CustomerPortal user={user} onLogout={handleLogout} /> : null}
      <SyncStatus />
    </ErrorBoundary>
  )
}

export default App
