import type { User } from "../../types"
import { Bell, LogOut, Menu } from "lucide-react"

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Overview", products: "Products", orders: "Sales & Orders", customers: "Customers",
  tickets: "Messages", stock: "Stock", payments: "Payments", stats: "Analytics",
  "delivery-areas": "Deliveries", enquiries: "Enquiries", complaints: "Complaints",
  "credit-control": "Credit Control", "payment-proofs": "Payment Proofs", "credit-notes": "Credit Notes",
  "customer-applications": "Customer Applications", "payment-reminders": "Payment Reminders",
  admins: "Admin Users", "data-extract": "Data Extract", files: "Files",
  session: "Produce Buying Desk", "place-order": "Place Order",
  "invoice-numbers": "Invoice Numbers", "day-trade": "Day Trade",
  "add-customer": "Add Customer", "create-invoice": "Create Invoice", invoices: "Invoices",
  outstanding: "Outstandings", "global-search": "Global Search", expenses: "Expenses",
  "day-check": "Day Check", "communication-history": "Communication History",
  "whatsapp-logs": "WhatsApp Logs", suppliers: "Suppliers", "sales-users": "Sales Users",
  "assign-task": "Assign Task", "sub-accounts": "Sub-Account Approvals", "whatsapp-send": "Send WhatsApp",
  settings: "Settings", documents: "Documents", team: "Team",
  "system-overview": "System Overview", "system-users": "System Users", "login-activity": "Login Activity",
  "audit-logs": "Audit Logs", "test-mode": "Test Mode", "backup-recovery": "Backup & Recovery",
  "system-health": "Integrations & Health", security: "Security",
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
        <Menu size={18} strokeWidth={2} />
      </button>
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-actions">
        {/* Notifications — real unread count of new orders/tickets; clears everything on click */}
        <button className="tb-icon-btn" onClick={onBellClick} title={count > 0 ? `${count} new notification${count !== 1 ? "s" : ""}` : "No new notifications"}>
          <Bell size={17} strokeWidth={1.8} />
          {count > 0 && <span className="tb-bell-count">{count > 9 ? "9+" : count}</span>}
        </button>
        {/* Signed-in user + sign out */}
        <div className="tb-user" title={`Signed in as ${user.displayName}`}>
          <span className="tb-user-avatar">{user.displayName.slice(0, 2).toUpperCase()}</span>
          <span className="tb-user-name">{user.displayName}</span>
        </div>
        <button className="tb-signout-btn" onClick={onLogout} title="Sign out">
          <LogOut size={14} strokeWidth={2} />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  )
}
