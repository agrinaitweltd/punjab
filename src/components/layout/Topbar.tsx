import type { User } from "../../types"

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Overview", products: "Product", orders: "Sale", customers: "Customer",
  tickets: "Message", stock: "Stock", payments: "Payments", stats: "Analytics",
  "delivery-areas": "Deliveries", enquiries: "Enquiries", complaints: "Complaints",
  "credit-control": "Credit Control", "payment-proofs": "Payment Proofs", "credit-notes": "Credit Notes",
  "customer-applications": "Customer Applications", "payment-reminders": "Payment Reminders",
  admins: "Admin Users", "data-extract": "Data Extract", files: "Files",
  session: "Produce Buying Desk", "place-order": "Place Order",
  "invoice-numbers": "Invoice Numbers", "day-trade": "Day Trade",
}

export function Topbar({ user, onLogout, current, onMenuOpen, notifCount, onBellClick }: {
  user: User; onLogout: () => void; current?: string
  onMenuOpen?: () => void; notifCount?: number; onBellClick?: () => void
}) {
  const title = current ? (PAGE_LABELS[current] ?? current.charAt(0).toUpperCase() + current.slice(1)) : "Dashboard"
  const count = notifCount ?? 0
  return (
    <header className="topbar">
      <button className="tb-hamburger" onClick={onMenuOpen} aria-label="Open menu">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-actions">
        {/* Notifications — real unread count of new orders/tickets; clears everything on click */}
        <button className="tb-icon-btn" onClick={onBellClick} title={count > 0 ? `${count} new notification${count !== 1 ? "s" : ""}` : "No new notifications"}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          {count > 0 && <span className="tb-bell-count">{count > 9 ? "9+" : count}</span>}
        </button>
        {/* Signed-in user + sign out */}
        <div className="tb-user" title={`Signed in as ${user.displayName}`}>
          <span className="tb-user-avatar">{user.displayName.slice(0, 2).toUpperCase()}</span>
          <span className="tb-user-name">{user.displayName}</span>
        </div>
        <button className="tb-signout-btn" onClick={onLogout} title="Sign out">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span>Sign out</span>
        </button>
      </div>
    </header>
  )
}
