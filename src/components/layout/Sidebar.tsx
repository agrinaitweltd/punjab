import { useEffect, useMemo, useRef, useState } from "react"
import type { PermissionSet, SubAccountPermissions, User } from "../../types"
import { ChartNoAxesCombined, ChevronRight, CircleHelp, ClipboardList, Clock3, DollarSign, FileText, LayoutDashboard, LogOut, MessageSquare, Package, PanelLeftClose, Search, Settings, UserRound, UserRoundCog, UsersRound, X, type LucideIcon } from "lucide-react"

const CUSTOMER_NAV_PERMISSION_KEY: Partial<Record<string, keyof SubAccountPermissions>> = {
  "place-order": "placeOrders", orders: "viewOrders", payments: "viewInvoicesBalance",
  documents: "viewDocuments", tickets: "raiseTickets", complaints: "raiseTickets",
}

const NAV_PERMISSION_KEY: Partial<Record<string, keyof PermissionSet>> = {
  products: "products", orders: "orders", customers: "customers", "add-customer": "customersCreate", tickets: "tickets",
  payments: "payments", "payment-proofs": "payments", "credit-control": "payments",
  "credit-notes": "creditNotesIssue", "customer-applications": "applicationsManage", "payment-reminders": "payments",
  stats: "stats", "day-check": "stats", stock: "stock", "data-extract": "extracts",
  enquiries: "enquiries", complaints: "complaints",
}

const ICONS = {
  dashboard: LayoutDashboard, customers: UsersRound, invoices: FileText, finance: DollarSign,
  stock: Package, sales: ChartNoAxesCombined, communications: MessageSquare, documents: FileText,
  admin: UserRoundCog, search: Search, help: CircleHelp, settings: Settings, clock: Clock3,
  logout: LogOut, order: ClipboardList, team: UserRound,
} satisfies Record<string, LucideIcon>

type IconName = keyof typeof ICONS
type NavigationItem = { key: string; label: string; icon: IconName; badgeKey?: string; access?: "users" | "superAdmin" | "systemDeveloper" }
type NavigationGroup = { key: string; label: string; icon: IconName; children: NavigationItem[] }

const adminNavigation: NavigationGroup[] = [
  { key: "customers-group", label: "Customers", icon: "customers", children: [
    { key: "customers", label: "All Customers", icon: "customers" }, { key: "add-customer", label: "Add Customer", icon: "customers" },
    { key: "customer-applications", label: "Customer Applications", icon: "customers" }, { key: "outstanding", label: "Outstandings", icon: "clock" },
    { key: "credit-control", label: "Credit Control", icon: "finance" },
  ] },
  { key: "invoices-group", label: "Invoices", icon: "invoices", children: [
    { key: "invoices", label: "Invoice History", icon: "invoices" }, { key: "create-invoice", label: "Create Invoice", icon: "invoices" },
    { key: "invoice-numbers", label: "Invoice Numbers", icon: "invoices" }, { key: "credit-notes", label: "Credit Notes", icon: "documents" },
    { key: "payment-reminders", label: "Payment Reminders", icon: "clock" },
  ] },
  { key: "finance-group", label: "Finance", icon: "finance", children: [
    { key: "payments", label: "Payments", icon: "finance" }, { key: "expenses", label: "Expenses", icon: "finance" },
    { key: "payment-proofs", label: "Payment Proofs", icon: "documents" }, { key: "day-trade", label: "Day Trades", icon: "clock" },
    { key: "day-check", label: "Day Check", icon: "clock" }, { key: "stats", label: "Analytics", icon: "sales" },
  ] },
  { key: "stock-group", label: "Stock & Products", icon: "stock", children: [
    { key: "stock", label: "Stock", icon: "stock" }, { key: "session", label: "Buying Desk", icon: "finance" },
    { key: "products", label: "Products", icon: "stock" }, { key: "suppliers", label: "Suppliers", icon: "customers" },
  ] },
  { key: "sales-group", label: "Sales & Orders", icon: "sales", children: [
    { key: "orders", label: "Sales & Orders", icon: "order", badgeKey: "orders" }, { key: "delivery-areas", label: "Deliveries", icon: "stock" },
    { key: "enquiries", label: "Enquiries", icon: "communications" },
  ] },
  { key: "communications-group", label: "Communications", icon: "communications", children: [
    { key: "tickets", label: "Messages", icon: "communications", badgeKey: "tickets" }, { key: "communication-history", label: "Communication History", icon: "clock" },
    { key: "whatsapp-logs", label: "WhatsApp Logs", icon: "communications" }, { key: "whatsapp-send", label: "Send WhatsApp", icon: "communications", access: "superAdmin" },
  ] },
  { key: "documents-group", label: "Documents", icon: "documents", children: [
    { key: "files", label: "Files", icon: "documents" }, { key: "data-extract", label: "Integration", icon: "documents" },
  ] },
  { key: "admin-group", label: "Users & Administration", icon: "admin", children: [
    { key: "admins", label: "Admin Users", icon: "admin", access: "users" }, { key: "sales-users", label: "Sales Users", icon: "team", access: "users" },
    { key: "assign-task", label: "Assign Task", icon: "order", access: "users" }, { key: "sub-accounts", label: "Sub-Account Approvals", icon: "team", access: "superAdmin" },
  ] },
  { key: "system-group", label: "System Management", icon: "settings", children: [
    { key: "system-overview", label: "System Overview", icon: "dashboard", access: "systemDeveloper" },
    { key: "system-users", label: "Users", icon: "admin", access: "systemDeveloper" },
    { key: "login-activity", label: "Login Activity", icon: "clock", access: "systemDeveloper" },
    { key: "audit-logs", label: "Audit Logs", icon: "documents", access: "systemDeveloper" },
    { key: "test-mode", label: "Test Mode", icon: "settings", access: "systemDeveloper" },
    { key: "backup-recovery", label: "Backup & Recovery", icon: "documents", access: "systemDeveloper" },
    { key: "system-health", label: "Integrations & Health", icon: "communications", access: "systemDeveloper" },
    { key: "security", label: "Security", icon: "help", access: "systemDeveloper" },
  ] },
]

const customerNavigation: NavigationGroup[] = [
  { key: "ordering-group", label: "Orders", icon: "order", children: [
    { key: "stock", label: "Daily Stock", icon: "stock" }, { key: "place-order", label: "Place Order", icon: "order" },
    { key: "orders", label: "My Orders", icon: "invoices", badgeKey: "orders" },
  ] },
  { key: "account-group", label: "Account", icon: "customers", children: [
    { key: "payments", label: "Balance", icon: "finance" }, { key: "documents", label: "Documents", icon: "documents" },
    { key: "team", label: "Team", icon: "team" },
  ] },
  { key: "support-group", label: "Support", icon: "communications", children: [
    { key: "tickets", label: "Messages", icon: "communications", badgeKey: "tickets" }, { key: "complaints", label: "Complaints", icon: "help" },
  ] },
]

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const Component = ICONS[name]
  return <Component size={size} strokeWidth={1.8} aria-hidden="true" />
}

function Chevron({ open }: { open: boolean }) {
  return <ChevronRight className={open ? "pn-chevron open" : "pn-chevron"} size={15} strokeWidth={2} aria-hidden="true" />
}

export function Sidebar({ user, current, onNavigate, mobileOpen, collapsed, onCollapsedChange, onMobileClose, badges, onDayEnd, onLogout }: {
  user: User; current: string; onNavigate: (key: string) => void; mobileOpen?: boolean; collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void; onMobileClose: () => void; badges?: Record<string, number>
  onDayEnd?: () => void; onLogout: () => void
}) {
  const isAdmin = user.role === "admin"
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => {
    const source = isAdmin ? adminNavigation : customerNavigation
    return source.map(group => ({ ...group, children: group.children.filter(item => {
      if (isAdmin) {
        if (item.access === "superAdmin" && !user.isSuperAdmin) return false
        if (item.access === "users" && !user.isSuperAdmin && !user.permissions?.usersManage) return false
        if (item.access === "systemDeveloper" && !user.isSystemDeveloper) return false
        if (user.isSuperAdmin) return true
        const permission = NAV_PERMISSION_KEY[item.key]
        return !permission || Boolean(user.permissions?.[permission])
      }
      if (!user.subAccount) return true
      if (item.key === "team") return false
      const permission = CUSTOMER_NAV_PERMISSION_KEY[item.key]
      return !permission || Boolean(user.subAccount.permissions[permission])
    }) })).filter(group => group.children.length > 0)
  }, [isAdmin, user.isSuperAdmin, user.isSystemDeveloper, user.permissions, user.subAccount])

  const activeGroup = groups.find(group => group.children.some(item => item.key === current))
  const activeGroupKey = activeGroup?.key
  useEffect(() => { if (activeGroupKey) setOpenGroup(activeGroupKey) }, [activeGroupKey])

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false) }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (isAdmin && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); onNavigate("global-search") }
      if (event.key === "Escape" && mobileOpen) onMobileClose()
    }
    window.addEventListener("keydown", keydown)
    return () => window.removeEventListener("keydown", keydown)
  }, [isAdmin, mobileOpen, onMobileClose, onNavigate])

  const badgeFor = (key?: string) => { const count = key ? badges?.[key] ?? 0 : 0; return count > 0 ? (count > 99 ? "99+" : String(count)) : undefined }
  const selectGroup = (group: NavigationGroup) => { if (collapsed) onCollapsedChange(false); setOpenGroup(openGroup === group.key && !collapsed ? null : group.key) }
  const navigate = (key: string) => { setProfileOpen(false); onNavigate(key) }
  const asideClass = ["sidebar", "pn-sidebar", collapsed ? "pn-collapsed" : "", mobileOpen ? "sidebar-mobile-open" : ""].filter(Boolean).join(" ")
  const initials = user.displayName.trim().split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "PF"

  return <aside className={asideClass} aria-label="Primary navigation">
    <div className="pn-rail">
      <button className="pn-rail-brand" type="button" onClick={() => onCollapsedChange(false)} aria-label="Open Punjab Exotic Foods navigation" data-tooltip="Punjab Exotic Foods"><img src="/logo.png" alt="" /></button>
      <div className="pn-rail-nav">
        <button className={current === "dashboard" ? "pn-rail-button active" : "pn-rail-button"} type="button" onClick={() => navigate("dashboard")} aria-label="Dashboard" data-tooltip="Dashboard"><Icon name="dashboard" /></button>
        {isAdmin && <button className={current === "global-search" ? "pn-rail-button active" : "pn-rail-button"} type="button" onClick={() => navigate("global-search")} aria-label="Global Search" data-tooltip="Global Search"><Icon name="search" /></button>}
        <div className="pn-rail-divider" />
        {groups.map(group => <button key={group.key} className={activeGroup?.key === group.key ? "pn-rail-button active" : "pn-rail-button"} type="button" onClick={() => selectGroup(group)} aria-label={group.label} aria-expanded={!collapsed && openGroup === group.key} data-tooltip={group.label}><Icon name={group.icon} /></button>)}
      </div>
      <div className="pn-rail-utilities">
        {isAdmin && <button className={current === "complaints" ? "pn-rail-button active" : "pn-rail-button"} type="button" onClick={() => navigate("complaints")} aria-label="Help Centre" data-tooltip="Help Centre"><Icon name="help" /></button>}
        {isAdmin && <button className={current === "settings" ? "pn-rail-button active" : "pn-rail-button"} type="button" onClick={() => navigate("settings")} aria-label="Settings" data-tooltip="Settings"><Icon name="settings" /></button>}
        {onDayEnd && <button className="pn-rail-button pn-day-end" type="button" onClick={onDayEnd} aria-label="Day End" data-tooltip="Day End"><Icon name="clock" /></button>}
        <button className="pn-rail-avatar" type="button" onClick={() => { onCollapsedChange(false); setProfileOpen(value => !value) }} aria-label={`Account menu for ${user.displayName}`} data-tooltip={user.displayName}>{initials}</button>
      </div>
    </div>

    <div className="pn-panel">
      <div className="pn-header">
        <div className="pn-brand-copy"><strong>Punjab Exotic Foods</strong><span>{isAdmin ? "Admin dashboard" : "Customer portal"}</span></div>
        <button className="pn-collapse-control" type="button" onClick={() => onCollapsedChange(true)} aria-label="Collapse navigation" title="Collapse navigation"><PanelLeftClose size={18} strokeWidth={1.8} /></button>
        <button className="pn-mobile-close" type="button" onClick={onMobileClose} aria-label="Close navigation"><X size={19} strokeWidth={2} /></button>
      </div>
      {isAdmin && <button className={current === "global-search" ? "pn-search active" : "pn-search"} type="button" onClick={() => navigate("global-search")}><Icon name="search" size={19} /><span>Global Search</span><kbd>Ctrl K</kbd></button>}
      <nav className="pn-menu" aria-label="Dashboard sections">
        <span className="pn-menu-label">Menu</span>
        <button className={current === "dashboard" ? "pn-parent active" : "pn-parent"} type="button" onClick={() => navigate("dashboard")}><Icon name="dashboard" /><span>Dashboard</span></button>
        {groups.map(group => {
          const isOpen = openGroup === group.key
          const isActive = activeGroup?.key === group.key
          return <div className="pn-group" key={group.key}>
            <button className={isActive ? "pn-parent active" : "pn-parent"} type="button" onClick={() => selectGroup(group)} aria-expanded={isOpen}><Icon name={group.icon} /><span>{group.label}</span><Chevron open={isOpen} /></button>
            <div className={isOpen ? "pn-children open" : "pn-children"} aria-hidden={!isOpen}>
              {group.children.map(item => {
                const badge = badgeFor(item.badgeKey)
                return <button key={item.key} className={current === item.key ? "pn-child active" : "pn-child"} type="button" tabIndex={isOpen ? 0 : -1} onClick={() => navigate(item.key)} aria-current={current === item.key ? "page" : undefined}><span className="pn-child-line" /><span>{item.label}</span>{badge && <span className="pn-badge">{badge}</span>}</button>
              })}
            </div>
          </div>
        })}
      </nav>
      {isAdmin && <div className="pn-utilities">
        <button className={current === "complaints" ? "pn-utility active" : "pn-utility"} type="button" onClick={() => navigate("complaints")}><Icon name="help" /><span>Help Centre</span></button>
        <button className={current === "settings" ? "pn-utility active" : "pn-utility"} type="button" onClick={() => navigate("settings")}><Icon name="settings" /><span>Settings</span></button>
        {onDayEnd && <button className="pn-utility pn-day-end" type="button" onClick={onDayEnd}><Icon name="clock" /><span>Day End</span></button>}
      </div>}
      <div className="pn-profile" ref={profileRef}>
        {profileOpen && <div className="pn-profile-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => navigate(isAdmin ? "settings" : "dashboard")}><Icon name="customers" size={16} />Profile</button>
          {isAdmin && <button type="button" role="menuitem" onClick={() => navigate("settings")}><Icon name="settings" size={16} />Settings</button>}
          <button type="button" role="menuitem" className="danger" onClick={onLogout}><Icon name="logout" size={16} />Sign Out</button>
        </div>}
        <button className="pn-profile-button" type="button" onClick={() => setProfileOpen(value => !value)} aria-expanded={profileOpen} aria-haspopup="menu">
          <span className="pn-avatar">{initials}</span><span className="pn-profile-copy"><strong>{user.displayName}</strong><small>{isAdmin ? (user.isSystemDeveloper ? "System Developer" : user.isSuperAdmin ? "System administrator" : "Administrator") : "Customer account"}</small></span><Chevron open={profileOpen} />
        </button>
      </div>
    </div>
  </aside>
}
