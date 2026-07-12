import { useState } from "react"
import type { User } from "../../types"

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Overview", products: "Product", orders: "Order", customers: "Customer",
  tickets: "Message", stock: "Stock", payments: "Payments", stats: "Analytics",
  "delivery-areas": "Deliveries", enquiries: "Enquiries", complaints: "Complaints",
  admins: "Admin Users", "data-extract": "Data Extract",
}

export function Topbar({ user, onLogout, current, onNavigate, onMenuOpen }: { user: User; onLogout: () => void; current?: string; onNavigate?: (key: string) => void; onMenuOpen?: () => void }) {
  const title = current ? (PAGE_LABELS[current] ?? current.charAt(0).toUpperCase() + current.slice(1)) : "Dashboard"
  const [starred, setStarred] = useState(false)
  return (
    <header className="topbar">
      <button className="tb-hamburger" onClick={onMenuOpen} aria-label="Open menu">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-actions">
        {/* Star — favourite current view */}
        <button className={"tb-icon-btn" + (starred ? " tb-icon-active" : "")} onClick={() => setStarred(s => !s)} title={starred ? "Unstar this view" : "Star this view"}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill={starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>
        {/* Bell — go to messages/tickets */}
        <button className="tb-icon-btn" onClick={() => onNavigate?.("tickets")} title="Messages">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span className="tb-bell-dot" />
        </button>
        {/* Avatar stack */}
        <div className="tb-avatars">
          <div className="tb-avatar" style={{ background: "#22913f" }}>A</div>
          <div className="tb-avatar" style={{ background: "#e05c2a", marginLeft: -8 }}>B</div>
          <div className="tb-avatar" style={{ background: "#4f46e5", marginLeft: -8 }}>C</div>
          <div className="tb-avatar-count" style={{ marginLeft: -8 }}>+3</div>
        </div>
        {/* Add member */}
        <button className="tb-icon-btn" title="Manage team" onClick={() => onNavigate?.("admins")}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        </button>
        {/* Signed-in user + sign out */}
        <div className="tb-user" title={`Signed in as ${user.displayName}`}>
          <span className="tb-user-avatar">{user.displayName.slice(0, 2).toUpperCase()}</span>
          <span className="tb-user-name">{user.displayName}</span>
        </div>
        <button className="tb-signout-btn" onClick={onLogout} title="Sign out">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign out
        </button>
      </div>
    </header>
  )
}