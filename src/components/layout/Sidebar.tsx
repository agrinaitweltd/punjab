import type { UserRole } from "../../types"

const adminMain = [
  { key: "dashboard",      label: "Overview",         d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
  { key: "products",       label: "Products",         d: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" },
  { key: "orders",         label: "Orders",           d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" },
  { key: "customers",      label: "Customers",        d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
  { key: "tickets",        label: "Messages",         d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", badge: 2 },
]
const adminTools = [
  { key: "payments",       label: "Payments",         d: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { key: "stats",          label: "Analytics",        d: "M18 20V10M12 20V4M6 20v-6" },
  { key: "stock",          label: "Stock",            d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" },
  { key: "data-extract",   label: "Data Extract",     d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" },
]
const adminWorkspace = [
  { key: "delivery-areas", label: "Deliveries",       d: "M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z", badge: 5 },
  { key: "enquiries",      label: "Enquiries",        d: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6", badge: 4 },
]
const adminBottom = [
  { key: "complaints",     label: "Complaints",       d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" },
  { key: "admins",         label: "Settings",         d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
]

const customerMain = [
  { key: "dashboard",   label: "Dashboard",     d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
  { key: "stock",       label: "Daily Stock",   d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" },
  { key: "place-order", label: "Place Order",   d: "M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" },
  { key: "orders",      label: "My Orders",     d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" },
  { key: "payments",    label: "Balance",       d: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { key: "tickets",     label: "Support",       d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { key: "complaints",  label: "Complaints",    d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" },
]

function SvgIcon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={d} />
    </svg>
  )
}

function NavItem({ item, active, onClick }: { item: { key: string; label: string; d: string; badge?: number }; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? "sb-item active" : "sb-item"} onClick={onClick} type="button">
      <SvgIcon d={item.d} />
      <span className="sb-label">{item.label}</span>
      {item.badge ? <span className="sb-badge">{item.badge}</span> : null}
    </button>
  )
}

export function Sidebar({ role, current, onNavigate }: { role: UserRole; current: string; onNavigate: (k: string) => void; userName?: string }) {
  const isAdmin = role === "admin"
  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sb-brand">
        <div className="sb-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M17 8C8 10 5.9 16.17 3.82 20.77L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-8 8" /></svg>
        </div>
        <div>
          <div className="sb-brand-name">Punjab Exotic Foods</div>
          <div className="sb-brand-plan">{isAdmin ? "Admin Software" : "Customer Portal"}</div>
        </div>
        <button className="sb-collapse" title="Collapse">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
        </button>
      </div>

      {/* Search */}
      <div className="sb-search-wrap">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input className="sb-search" placeholder="Search..." />
        <span className="sb-search-shortcut">K</span>
      </div>

      {/* Main menu */}
      <div className="sb-section">
        <p className="sb-section-label">Main Menu</p>
        <nav>
          {(isAdmin ? adminMain : customerMain).map((item) => (
            <NavItem key={item.key} item={item} active={current === item.key} onClick={() => onNavigate(item.key)} />
          ))}
        </nav>
      </div>

      {isAdmin && (
        <>
          <div className="sb-section">
            <p className="sb-section-label">Tools</p>
            <nav>
              {adminTools.map((item) => (
                <NavItem key={item.key} item={item} active={current === item.key} onClick={() => onNavigate(item.key)} />
              ))}
            </nav>
          </div>
          <div className="sb-section">
            <p className="sb-section-label">Workspace</p>
            <nav>
              {adminWorkspace.map((item) => (
                <NavItem key={item.key} item={item} active={current === item.key} onClick={() => onNavigate(item.key)} />
              ))}
            </nav>
          </div>
        </>
      )}

      <div className="sb-spacer" />

      {/* Bottom */}
      <div className="sb-bottom">
        {isAdmin && adminBottom.map((item) => (
          <NavItem key={item.key} item={item} active={current === item.key} onClick={() => onNavigate(item.key)} />
        ))}
        <div className="sb-upgrade">
          <div className="sb-upgrade-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <div>
            <div className="sb-upgrade-title">Upgrade plan</div>
            <div className="sb-upgrade-sub">Unlock all features</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
    </aside>
  )
}