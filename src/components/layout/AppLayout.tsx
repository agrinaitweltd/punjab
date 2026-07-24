import { useState } from 'react'
import type { ReactNode } from 'react'
import type { User, UserRole } from '../../types'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { URGENT_SUPPORT_PHONE } from '../../lib/emailService'

export function AppLayout({
  role,
  user,
  current,
  onNavigate,
  onLogout,
  children,
  badges,
  notifCount,
  onBellClick,
}: {
  role: UserRole
  user: User
  current: string
  onNavigate: (key: string) => void
  onLogout: () => void
  children: ReactNode
  badges?: Record<string, number>
  notifCount?: number
  onBellClick?: () => void
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleNavigate = (key: string) => {
    setMobileOpen(false)
    onNavigate(key)
  }

  return (
    <div className="app-layout">
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <Sidebar
        role={role}
        current={current}
        onNavigate={handleNavigate}
        userName={user.displayName}
        isSuperAdmin={user.isSuperAdmin}
        permissions={user.permissions}
        mobileOpen={mobileOpen}
        badges={badges}
      />
      <div className="main-layout">
        <Topbar user={user} onLogout={onLogout} current={current} onMenuOpen={() => setMobileOpen(true)} notifCount={notifCount} onBellClick={onBellClick} />
        <main className="content">{children}</main>
        <div style={{ padding: '8px 24px', fontSize: 11.5, color: '#9ca3af', textAlign: 'right', borderTop: '1px solid #eef1ee' }}>
          Urgent Support: <strong style={{ color: '#4d7c5f' }}>{URGENT_SUPPORT_PHONE}</strong>
        </div>
      </div>
    </div>
  )
}
