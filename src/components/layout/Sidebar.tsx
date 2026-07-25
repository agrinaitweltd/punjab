import { useState, useEffect } from "react"
import type { PermissionSet, SubAccountPermissions, UserRole } from "../../types"

/* Maps a customer nav item's key to the sub-account permission flag that
   gates it — items not listed (Dashboard, Support pointer) stay visible to
   every sub-account. The main customer login always sees everything. */
const CUSTOMER_NAV_PERMISSION_KEY: Partial<Record<string, keyof SubAccountPermissions>> = {
  "place-order": "placeOrders", orders: "viewOrders", payments: "viewInvoicesBalance",
  documents: "viewDocuments", tickets: "raiseTickets", complaints: "raiseTickets",
}

/* Maps a nav item's key to the permission flag that gates it for non-super
   admins. Items not listed here (Dashboard, Daily Session, Deliveries,
   Files, Settings) are operational pages every admin can see. */
const NAV_PERMISSION_KEY: Partial<Record<string, keyof PermissionSet>> = {
  products: "products", orders: "orders", customers: "customers", tickets: "tickets",
  payments: "payments", "payment-proofs": "payments", "credit-control": "payments",
  "credit-notes": "creditNotesIssue", "customer-applications": "applicationsManage",
  "payment-reminders": "payments",
  stats: "stats", "day-check": "stats", stock: "stock", "data-extract": "extracts",
  enquiries: "enquiries", complaints: "complaints",
}

const adminMain = [
  { key: "dashboard",  label: "Dashboard", d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
  { key: "session",    label: "Buying Desk", d: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM12 6v6l4 2" },
  { key: "suppliers",  label: "Suppliers", d: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" },
  { key: "products",   label: "Product",   d: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" },
  { key: "orders",     label: "Sale",     d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" },
  { key: "customers",  label: "Customer",  d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
  { key: "tickets",    label: "Message",   d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
]
const adminTools = [
  { key: "payments",      label: "Payments",    d: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6", badge: undefined },
  { key: "payment-proofs", label: "Payment Proofs", d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", badge: undefined },
  { key: "credit-control", label: "Credit Control", d: "M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z", badge: undefined },
  { key: "credit-notes", label: "Credit Notes", d: "M9 14l2 2 4-4M7 21h10a2 2 0 0 0 2-2V7l-5-5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2z", badge: undefined },
  { key: "customer-applications", label: "Customer Applications", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6", badge: undefined },
  { key: "payment-reminders", label: "Payment Reminders", d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0", badge: undefined },
  { key: "invoice-numbers", label: "Invoice Numbers", d: "M9 12h6m-6 4h6M9 8h6M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2z", badge: undefined },
  { key: "day-trade", label: "Day Trade", d: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", badge: undefined },
  { key: "day-check", label: "Day Check", d: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", badge: undefined },
  { key: "stats",         label: "Analytics",   d: "M18 20V10M12 20V4M6 20v-6", badge: undefined },
  { key: "stock",         label: "Stock",       d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z", badge: undefined },
  { key: "files",         label: "Files",       d: "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM13 2v7h7", badge: undefined },
  { key: "data-extract",  label: "Integration", d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3", badge: undefined },
]
const adminWorkspace = [
  { key: "delivery-areas", label: "Deliveries", dot: "#22913f" },
  { key: "enquiries",      label: "Enquiries",  dot: "#e05c2a" },
]
const adminBottom = [
  { key: "complaints", label: "Help centre",  d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" },
  { key: "settings",   label: "Settings",     d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
]
const customerMain = [
  { key: "dashboard",   label: "Dashboard",  d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", badge: undefined },
  { key: "stock",       label: "Daily Stock", d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z", badge: undefined },
  { key: "place-order", label: "Place Order", d: "M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0", badge: undefined },
  { key: "orders",      label: "My Orders",  d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z", badge: undefined },
  { key: "payments",    label: "Balance",    d: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6", badge: undefined },
  { key: "documents",   label: "Documents",  d: "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM13 2v7h7", badge: undefined },
  { key: "team",        label: "Team",       d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75", badge: undefined },
  { key: "tickets",     label: "Support",    d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", badge: undefined },
  { key: "complaints",  label: "Complaints", d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01", badge: undefined },
]

function Icon({ d }: { d: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={d} />
    </svg>
  )
}

type NavItemProps = { label: string; d?: string; active: boolean; badge?: string; dot?: string; onClick: () => void }
function NavItem({ label, d, active, badge, dot, onClick }: NavItemProps) {
  return (
    <button className={active ? "sb-item active" : "sb-item"} onClick={onClick} type="button">
      {dot
        ? <span className="sb-dot" style={{ background: dot }} />
        : d ? <Icon d={d} /> : null
      }
      <span className="sb-label">{label}</span>
      {badge && <span className="sb-badge">{badge}</span>}
    </button>
  )
}

export function Sidebar({ role, current, onNavigate, isSuperAdmin, permissions, subAccountPermissions, mobileOpen, badges, onDayEnd }: {
  role: UserRole; current: string; onNavigate: (k: string) => void; userName?: string; isSuperAdmin?: boolean
  permissions?: PermissionSet; mobileOpen?: boolean
  /** Set when the logged-in customer is a team sub-account, not the main
      login — narrows which customer nav items show. */
  subAccountPermissions?: SubAccountPermissions
  badges?: Record<string, number>
  /** Closes the trading day and archives it to Day Trade. */
  onDayEnd?: () => void
}) {
  const [query, setQuery] = useState("")
  const [collapsed, setCollapsed] = useState(false)
  const isAdmin = role === "admin"

  // Super admins see every nav item; everyone else only sees items their
  // permissions actually grant (items with no mapped permission — dashboard,
  // daily session, deliveries, files, settings — stay visible to all admins).
  const allowed = <T extends { key: string }>(items: T[]) =>
    isSuperAdmin ? items : items.filter(i => {
      const permKey = NAV_PERMISSION_KEY[i.key]
      return !permKey || Boolean(permissions?.[permKey])
    })

  // Sub-accounts never manage the team, and otherwise only see what their
  // granted permissions allow — the main customer login always sees everything.
  const forSubAccount = <T extends { key: string }>(items: T[]) =>
    !subAccountPermissions ? items : items.filter(i => {
      if (i.key === "team") return false
      const permKey = CUSTOMER_NAV_PERMISSION_KEY[i.key]
      return !permKey || Boolean(subAccountPermissions[permKey])
    })

  const q = query.trim().toLowerCase()
  const matches = <T extends { label: string }>(items: T[]) =>
    q ? items.filter(i => i.label.toLowerCase().includes(q)) : items
  const mainItems      = matches(isAdmin ? allowed(adminMain) : forSubAccount(customerMain))
  const toolItems      = matches(allowed(adminTools))
  const workspaceItems = matches(allowed(adminWorkspace))
  const bottomItems    = matches(adminBottom)
  const badgeFor = (key: string) => { const n = badges?.[key] ?? 0; return n > 0 ? String(n > 99 ? "99+" : n) : undefined }

  useEffect(() => {
    const main = document.querySelector('.main-layout') as HTMLElement
    if (main) main.style.paddingLeft = collapsed ? '74px' : '220px'
  }, [collapsed])

  const asideClass = [
    "sidebar",
    collapsed ? "sidebar-collapsed" : "",
    mobileOpen ? "sidebar-mobile-open" : "",
  ].filter(Boolean).join(" ")

  return (
    <aside className={asideClass}>
      {/* Brand */}
      <div className="sb-brand">
        <div className="sb-logo">
          <img src="/logo.png" alt="Punjab Foods Logo" onError={(e) => {
            console.error("Logo failed to load:", e);
            (e.target as HTMLImageElement).style.display = 'none';
          }} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        <div>
          <div className="sb-brand-name">Punjab Exotic Foods</div>
          <div className="sb-brand-plan">{isAdmin ? "Admin Software" : "Customer Portal"}</div>
        </div>
        <button className="sb-collapse" title={collapsed ? "Expand" : "Collapse"} onClick={() => setCollapsed(c => !c)} type="button">
          {collapsed
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
          }
        </button>
      </div>

      {/* Search */}
      <div className="sb-search-wrap">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input className="sb-search" placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} />
        <div className="sb-kshortcut"><span>⌘</span> K</div>
      </div>

      {/* Main menu */}
      {mainItems.length > 0 && (
        <div className="sb-section">
          <p className="sb-section-label">Main Menu</p>
          <nav>
            {mainItems.map(item => (
              <NavItem key={item.key} label={item.label} d={item.d} badge={badgeFor(item.key)}
                active={current === item.key} onClick={() => onNavigate(item.key)} />
            ))}
          </nav>
        </div>
      )}

      {isAdmin && <>
        {toolItems.length > 0 && (
          <div className="sb-section">
            <p className="sb-section-label">Tools</p>
            <nav>
              {toolItems.map(item => (
                <NavItem key={item.key} label={item.label} d={item.d}
                  active={current === item.key} onClick={() => onNavigate(item.key)} />
              ))}
            </nav>
          </div>
        )}
        {(workspaceItems.length > 0 || ((isSuperAdmin || permissions?.usersManage) && (!q || "admin users sales users".includes(q)))) && (
          <div className="sb-section">
            <p className="sb-section-label">Workspace</p>
            <nav>
              {workspaceItems.map(item => (
                <NavItem key={item.key} label={item.label} dot={item.dot} badge={badgeFor(item.key)}
                  active={current === item.key} onClick={() => onNavigate(item.key)} />
              ))}
              {/* Only super-admins (or an explicit usersManage grant) see the Admins management link */}
              {(isSuperAdmin || permissions?.usersManage) && (!q || "admin users".includes(q)) && (
                <NavItem
                  label="Admin Users"
                  d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
                  active={current === "admins"}
                  onClick={() => onNavigate("admins")}
                />
              )}
              {(isSuperAdmin || permissions?.usersManage) && (!q || "sales users".includes(q)) && (
                <NavItem
                  label="Sales Users"
                  d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
                  active={current === "sales-users"}
                  onClick={() => onNavigate("sales-users")}
                />
              )}
              {(isSuperAdmin || permissions?.usersManage) && (!q || "assign task".includes(q)) && (
                <NavItem
                  label="Assign Task"
                  d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
                  active={current === "assign-task"}
                  onClick={() => onNavigate("assign-task")}
                />
              )}
              {(isSuperAdmin) && (!q || "sub account approvals".includes(q)) && (
                <NavItem
                  label="Sub-Account Approvals"
                  d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
                  active={current === "sub-accounts"}
                  onClick={() => onNavigate("sub-accounts")}
                />
              )}
            </nav>
          </div>
        )}
        {q && mainItems.length + toolItems.length + workspaceItems.length === 0 && (
          <p className="sb-no-results">No menu items match “{query}”</p>
        )}
      </>}

      <div className="sb-spacer" />

      {/* Bottom links */}
      {isAdmin && (
        <div className="sb-bottom">
          {bottomItems.map(item => (
            <NavItem key={item.key} label={item.label} d={item.d}
              active={current === item.key} onClick={() => onNavigate(item.key)} />
          ))}
          {onDayEnd && (!q || "day end".includes(q)) && (
            <button className="sb-item" type="button" onClick={onDayEnd} style={{ color: "#b91c1c" }}>
              <Icon d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              <span className="sb-label">Day End</span>
            </button>
          )}
          <div className="sb-upgrade" onClick={() => onNavigate("admins")}>
            <div className="sb-upgrade-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <div>
              <div className="sb-upgrade-title">Upgrade &amp; unlock</div>
              <div className="sb-upgrade-sub">all features</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" style={{ marginLeft: "auto" }}><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      )}
    </aside>
  )
}