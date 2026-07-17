import { useState, useEffect } from "react"
import type { UserRole } from "../../types"

const adminMain = [
  { key: "dashboard",  label: "Dashboard", d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
  { key: "session",    label: "Daily Session", d: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM12 6v6l4 2" },
  { key: "products",   label: "Product",   d: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" },
  { key: "orders",     label: "Order",     d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" },
  { key: "customers",  label: "Customer",  d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
  { key: "tickets",    label: "Message",   d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
]
const adminTools = [
  { key: "payments",      label: "Payments",    d: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6", badge: undefined },
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

export function Sidebar({ role, current, onNavigate, isSuperAdmin, mobileOpen, badges }: {
  role: UserRole; current: string; onNavigate: (k: string) => void; userName?: string; isSuperAdmin?: boolean; mobileOpen?: boolean
  badges?: Record<string, number>
}) {
  const [query, setQuery] = useState("")
  const [collapsed, setCollapsed] = useState(false)
  const isAdmin = role === "admin"

  const q = query.trim().toLowerCase()
  const matches = <T extends { label: string }>(items: T[]) =>
    q ? items.filter(i => i.label.toLowerCase().includes(q)) : items
  const mainItems      = matches(isAdmin ? adminMain : customerMain)
  const toolItems      = matches(adminTools)
  const workspaceItems = matches(adminWorkspace)
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
        {(workspaceItems.length > 0 || (isSuperAdmin && (!q || "admin users".includes(q)))) && (
          <div className="sb-section">
            <p className="sb-section-label">Workspace</p>
            <nav>
              {workspaceItems.map(item => (
                <NavItem key={item.key} label={item.label} dot={item.dot} badge={badgeFor(item.key)}
                  active={current === item.key} onClick={() => onNavigate(item.key)} />
              ))}
              {/* Only super-admins see the Admins management link */}
              {isSuperAdmin && (!q || "admin users".includes(q)) && (
                <NavItem
                  label="Admin Users"
                  d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
                  active={current === "admins"}
                  onClick={() => onNavigate("admins")}
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