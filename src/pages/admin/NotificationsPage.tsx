import type { AppNotification } from '../../types'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { groupByDate } from '../../lib/dateGrouping'

/** Full-page notification history (item 4) - the bell dropdown only shows
    the most recent 50; this is the complete list, grouped by date. */
export function NotificationsPage({ notifications, onMarkRead, onMarkAllRead, onOpen }: {
  notifications: AppNotification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onOpen: (notification: AppNotification) => void
}) {
  const unread = notifications.filter(n => !n.read)
  const groups = groupByDate(notifications, n => n.createdAt)

  return (
    <div className="stack">
      <div className="page-heading">
        <div><h1>Notifications</h1><p>Everything the system has flagged for admin attention, newest first.</p></div>
        {unread.length > 0 && <Button variant="secondary" onClick={onMarkAllRead}>Mark all as read ({unread.length})</Button>}
      </div>
      {notifications.length === 0 && <Card title="Notifications"><div className="empty-state">No notifications yet.</div></Card>}
      {groups.map(group => (
        <Card key={group.label} title={group.label}>
          <div className="stack" style={{ gap: 6 }}>
            {group.items.map(notification => (
              <button
                key={notification.id} type="button"
                onClick={() => { if (!notification.read) onMarkRead(notification.id); onOpen(notification) }}
                style={{
                  textAlign: 'left', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px',
                  background: notification.read ? '#fff' : '#f0fdf4', cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#111827' }}>{notification.title}</div>
                {notification.message && <div style={{ fontSize: 13, color: '#4b5563', marginTop: 2 }}>{notification.message}</div>}
                <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 4 }}>{notification.createdAt.replace('T', ' ').slice(0, 16)}</div>
              </button>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
