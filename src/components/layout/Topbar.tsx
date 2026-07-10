import type { User } from "../../types"

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Overview", products: "Product", orders: "Order", customers: "Customer",
  tickets: "Message", stock: "Stock", payments: "Payments", stats: "Analytics",
  "delivery-areas": "Deliveries", enquiries: "Enquiries", complaints: "Complaints",
  admins: "Admin Users", "data-extract": "Data Extract",
}

export function Topbar({ user, onLogout, current }: { user: User; onLogout: () => void; current?: string }) {
  const title = current ? (PAGE_LABELS[current] ?? current.charAt(0).toUpperCase() + current.slice(1)) : "Dashboard"
  return (
    <header className="topbar">
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-actions">
        {/* Star */}
        <button className="tb-icon-btn">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>
        {/* Bell */}
        <button className="tb-icon-btn">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </button>
        {/* Avatar stack */}
        <div className="tb-avatars">
          <div className="tb-avatar" style={{ background: "#22913f" }}>A</div>
          <div className="tb-avatar" style={{ background: "#e05c2a", marginLeft: -8 }}>B</div>
          <div className="tb-avatar" style={{ background: "#4f46e5", marginLeft: -8 }}>C</div>
          <div className="tb-avatar-count" style={{ marginLeft: -8 }}>+3</div>
        </div>
        {/* Person */}
        <button className="tb-icon-btn">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </button>
        {/* Customize Widget */}
        <button className="tb-customize-btn" onClick={onLogout} title={`Signed in as ${user.displayName}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          Customise Widget
        </button>
      </div>
    </header>
  )
}