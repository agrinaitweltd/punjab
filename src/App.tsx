import { useState } from 'react'
import './App.css'
import { loginUser, logoutUser } from './api/authApi'
import { LoginPage } from './pages/LoginPage'
import { AdminPortal } from './pages/admin/AdminPortal'
import { CustomerPortal } from './pages/customer/CustomerPortal'
import type { User } from './types'

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
    <>
      {!user ? <LoginPage onLogin={handleLogin} error={error} /> : null}
      {user?.role === 'admin' ? <AdminPortal user={user} onLogout={handleLogout} /> : null}
      {user?.role === 'customer' ? <CustomerPortal user={user} onLogout={handleLogout} /> : null}
    </>
  )
}

export default App
