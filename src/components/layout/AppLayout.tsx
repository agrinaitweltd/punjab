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
}: {
  role: UserRole
  user: User
  current: string
  onNavigate: (key: string) => void
  onLogout: () => void
  children: ReactNode
}) {
  return (
    <div className="app-layout">
      <Sidebar role={role} current={current} onNavigate={onNavigate} userName={user.displayName} />
      <div className="main-layout">
        <Topbar user={user} onLogout={onLogout} current={current} />
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
