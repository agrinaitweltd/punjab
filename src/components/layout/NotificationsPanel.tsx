import { useEffect, useRef, useState } from "react"
import { Bell } from "lucide-react"
import type { AppNotification } from "../../types"

const fmt = (value: string) => {
  const date = new Date(value)
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 24 * 60) return `${Math.round(diffMin / 60)}h ago`
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
}

/** Bell icon + dropdown feed of real notification rows (not just an
    aggregate count of orders/tickets like the old placeholder). Owns its
    own open/close state; the actual data and realtime sync live in
    AdminPortal.tsx like everything else. */
export function NotificationsPanel({ notifications, onMarkRead, onMarkAllRead, onOpen }: {
  notifications: AppNotification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onOpen: (notification: AppNotification) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const unread = notifications.filter(n => !n.read)

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button className="tb-icon-btn" onClick={() => setOpen(v => !v)} title={unread.length > 0 ? `${unread.length} new notification${unread.length !== 1 ? "s" : ""}` : "No new notifications"}>
        <Bell size={17} strokeWidth={1.8} />
        {unread.length > 0 && <span className="tb-bell-count">{unread.length > 9 ? "9+" : unread.length}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="menu">
          <div className="notif-panel-head">
            <strong>Notifications</strong>
            {unread.length > 0 && <button type="button" className="notif-mark-all" onClick={onMarkAllRead}>Mark all as read</button>}
          </div>
          <div className="notif-panel-list">
            {notifications.length === 0 && <div className="notif-empty">No notifications yet.</div>}
            {notifications.slice(0, 50).map(notification => (
              <button
                key={notification.id} type="button" className={`notif-row${notification.read ? "" : " unread"}`}
                onClick={() => { if (!notification.read) onMarkRead(notification.id); onOpen(notification); setOpen(false) }}
              >
                <div className="notif-row-title">{notification.title}</div>
                {notification.message && <div className="notif-row-message">{notification.message}</div>}
                <div className="notif-row-time">{fmt(notification.createdAt)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
