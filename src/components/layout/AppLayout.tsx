import { useState } from 'react'
import type { ReactNode } from 'react'
import type { User, UserRole } from '../../types'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

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
        mobileOpen={mobileOpen}
        badges={badges}
      />
      <div className="main-layout">
        <Topbar user={user} onLogout={onLogout} current={current} onMenuOpen={() => setMobileOpen(true)} notifCount={notifCount} onBellClick={onBellClick} />
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
