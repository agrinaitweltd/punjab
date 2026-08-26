import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppNotification, User, UserRole } from '../../types'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { URGENT_SUPPORT_PHONE } from '../../lib/emailService'
import { getSystemMode } from '../../lib/secureAdminApi'
import { isRuntimeTestMode, setRuntimeTestMode } from '../../lib/runtimeMode'

export function AppLayout({
  role,
  user,
  current,
  onNavigate,
  onLogout,
  children,
  badges,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onOpenNotification,
  notifCount,
  onBellClick,
  onDayEnd,
}: {
  role: UserRole
  user: User
  current: string
  onNavigate: (key: string) => void
  onLogout: () => void
  children: ReactNode
  badges?: Record<string, number>
  notifications?: AppNotification[]
  onMarkNotificationRead?: (id: string) => void
  onMarkAllNotificationsRead?: () => void
  onOpenNotification?: (notification: AppNotification) => void
  /** Legacy simple unread-count bell, still used by the customer portal. */
  notifCount?: number
  onBellClick?: () => void
  onDayEnd?: () => void
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [testMode, setTestMode] = useState(isRuntimeTestMode())
  const [simulationNotice, setSimulationNotice] = useState('')

  useEffect(() => {
    let active = true
    const check = () => getSystemMode().then(mode => {
      if (!active) return
      if (mode.testMode !== isRuntimeTestMode()) {
        setRuntimeTestMode(mode.testMode)
        window.location.reload()
        return
      }
      setTestMode(mode.testMode)
    }).catch(() => {})
    check()
    const timer = window.setInterval(check, 15_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [user.id])

  useEffect(() => {
    const show = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      setSimulationNotice(detail || 'External communication simulated. Nothing was sent.')
      window.setTimeout(() => setSimulationNotice(''), 5000)
    }
    window.addEventListener('test-mode-simulation', show)
    return () => window.removeEventListener('test-mode-simulation', show)
  }, [])

  const handleNavigate = (key: string) => {
    setMobileOpen(false)
    onNavigate(key)
  }

  return (
    <div className={sidebarCollapsed ? "app-layout sidebar-is-collapsed" : "app-layout"}>
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <Sidebar
        user={user}
        current={current}
        onNavigate={handleNavigate}
        mobileOpen={mobileOpen}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        onMobileClose={() => setMobileOpen(false)}
        badges={badges}
        onDayEnd={role === 'admin' ? onDayEnd : undefined}
        onLogout={onLogout}
      />
      <div className="main-layout">
        {testMode && <div className="global-test-banner" role="status"><strong>TEST MODE</strong><span>Changes made here will not affect live company data. External communications are simulated.</span></div>}
        {simulationNotice && <div className="simulation-toast" role="status"><strong>TEST MODE</strong>{simulationNotice}</div>}
        <Topbar
          user={user} onLogout={onLogout} current={current} onMenuOpen={() => setMobileOpen(true)}
          notifications={notifications}
          onMarkNotificationRead={onMarkNotificationRead}
          onMarkAllNotificationsRead={onMarkAllNotificationsRead}
          onOpenNotification={onOpenNotification}
          notifCount={notifCount}
          onBellClick={onBellClick}
        />
        <main className="content">{children}</main>
        <div style={{ padding: '8px 24px', fontSize: 11.5, color: '#9ca3af', textAlign: 'right', borderTop: '1px solid #eef1ee' }}>
          Urgent Support: <strong style={{ color: '#4d7c5f' }}>{URGENT_SUPPORT_PHONE}</strong>
        </div>
      </div>
    </div>
  )
}
