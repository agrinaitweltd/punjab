import type { UserRole } from "../../types"

const adminItems = [
  { key: "dashboard",      label: "Overview",         icon: "grid" },
  { key: "data-extract",   label: "Data Extract",     icon: "download" },
  { key: "customers",      label: "Customers",        icon: "users" },
  { key: "stock",          label: "Stock",            icon: "box" },
  { key: "products",       label: "Products",         icon: "leaf" },
  { key: "delivery-areas", label: "Delivery Charges", icon: "truck" },
  { key: "tickets",        label: "Tickets",          icon: "ticket" },
  { key: "orders",         label: "Orders",           icon: "clipboard" },
  { key: "enquiries",      label: "Enquiries",        icon: "mail" },
  { key: "complaints",     label: "Complaints",       icon: "alert" },
  { key: "payments",       label: "Payments",         icon: "pound" },
  { key: "admins",         label: "Admins",           icon: "key" },
  { key: "stats",          label: "Stats",            icon: "chart" },
]

const customerItems = [
  { key: "dashboard",   label: "Dashboard",         icon: "grid" },
  { key: "stock",       label: "Daily Stock",        icon: "box" },
  { key: "place-order", label: "Place Order",        icon: "cart" },
  { key: "orders",      label: "My Orders",          icon: "clipboard" },
  { key: "payments",    label: "Balance & Payments", icon: "pound" },
  { key: "tickets",     label: "Support Tickets",    icon: "ticket" },
  { key: "complaints",  label: "Complaints",         icon: "alert" },
]

const ICONS: Record<string, string> = {
  grid: "M3 3h7v7H3zm0 11h7v7H3zm11-11h7v7h-7zm0 11h7v7h-7z",
  download: "M12 16l-6-6h4V4h4v6h4zM3 20h18v2H3z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  box: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  leaf: "M17 8C8 10 5.9 16.17 3.82 20.77L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-8 8",
  truck: "M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  ticket: "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 0 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 1 0-4V7a2 2 0 0 0-2-2H5z",
  clipboard: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z",
  mail: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
  alert: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  pound: "M8 14h8M7 10.5C7 8.57 8.57 7 10.5 7c1.38 0 2.57.78 3.15 1.93M10.5 7V17",
  key: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
  chart: "M18 20V10M12 20V4M6 20v-6",
  cart: "M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
}

function Icon({ name }: { name: string }) {
  const d = ICONS[name] ?? ICONS.grid
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={d} />
    </svg>
  )
}

export function Sidebar({ role, current, onNavigate, userName }: { role: UserRole; current: string; onNavigate: (k: string) => void; userName?: string }) {
  const items = role === "admin" ? adminItems : customerItems
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">PEF</div>
        <div>
          <strong>Punjab Exotic Foods</strong>
          <p>{role === "admin" ? "Admin Software" : "Customer Portal"}</p>
        </div>
      </div>
      {userName && (
        <div style={{ padding: "12px 18px 8px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: 12, color: "#7dba8f", fontWeight: 600 }}>{userName}</div>
          <div style={{ fontSize: 11, color: "#567a60", marginTop: 2 }}>{role === "admin" ? "Owner" : "Customer"}</div>
        </div>
      )}
      <p className="sidebar-section-label">Main Menu</p>
      <nav className="menu">
        {items.map((item) => (
          <button key={item.key} className={item.key === current ? "menu-item active" : "menu-item"} onClick={() => onNavigate(item.key)}>
            <span className="mi-icon"><Icon name={item.icon} /></span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">Punjab Exotic Foods Ltd &copy; {new Date().getFullYear()}</div>
    </aside>
  )
}