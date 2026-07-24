import { useEffect, useMemo, useState } from "react"
import { AppLayout } from "../../components/layout/AppLayout"
import { getProducts } from "../../api/productsApi"
import { getOrders } from "../../api/ordersApi"
import { createTicket, getInvoices, getPayments, getTickets, getCreditNotes, getCreditNoteAllocations } from "../../api/miscApi"
import { getCustomers } from "../../api/customersApi"
import { getStock } from "../../api/stockApi"
import { getCreditStatus } from "../../lib/creditControl"
import { invoiceOutstanding } from "../../lib/creditNotes"
import { sendEmail, URGENT_SUPPORT_PHONE, ADMIN_NOTIFY_EMAIL, paymentProofSubmittedEmailHtml, paymentProofAdminAlertEmailHtml } from "../../lib/emailService"
import { uploadPaymentProof, listPaymentProofsForCustomer, MAX_PROOF_BYTES, type PaymentProof } from "../../lib/paymentProofService"
import type { Customer, CreditNote, CreditNoteAllocation, Invoice, Order, Payment, Product, StockItem, SupportTicket, User } from "../../types"
import { Button } from "../../components/ui/Button"
import { Input, TextArea } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { PlaceOrderModal, catColor } from "./PlaceOrderModal"
import { exportToCsv } from "../../lib/exportCsv"
import { GmtClock } from "../../components/GmtClock"
import { isStockFresh, latestStockUpdate, currentCycleStart, formatLondonTime } from "../../lib/stockCycle"
import { listFilesForCustomer, type StoredFile } from "../../lib/fileService"
import { useUnseenCount, useLiveToasts, usePoll } from "../../lib/notifications"
import { ToastStack } from "../../components/ToastStack"

const STATUS_COLORS: Record<string, string> = {
  Pending: "#f59e0b", Confirmed: "#3b82f6", Preparing: "#8b5cf6",
  Delivered: "#22c55e", Cancelled: "#ef4444",
}
const STOCK_COLORS: Record<string, string> = {
  available: "#22c55e", low: "#f59e0b", out: "#ef4444",
}
const STATUS_TABS = ["All", "Pending", "Confirmed", "Preparing", "Delivered", "Cancelled"]

function Avatar({ name, color }: { name: string; color?: string }) {
  const bg = color ?? "#1f7a3a"
  return (
    <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}
function ProgressBar({ pct, color }: { pct: number; color?: string }) {
  return (
    <div style={{ width: 80, height: 6, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: color ?? "#1f7a3a", borderRadius: 99 }} />
    </div>
  )
}
function StatCard({ label, value, delta, positive, icon, iconBg, iconColor }: {
  label: string; value: string; delta?: string; positive?: boolean
  icon?: React.ReactNode; iconBg?: string; iconColor?: string
}) {
  return (
    <div className="sh-stat">
      <div className="sh-stat-top">
        {icon && <span className="sh-stat-ico" style={{ background: iconBg ?? "#e8f8ec", color: iconColor ?? "#1f7a3a" }}>{icon}</span>}
        <span className="sh-stat-label">{label}</span>
      </div>
      <div className="sh-stat-value">{value}</div>
      {delta && <div className="sh-stat-delta"><strong className={positive ? "pos" : "neg"}>{delta}</strong> from last month</div>}
    </div>
  )
}

/* Lightweight SVG area chart (no libs) */
function RevenueLine({ points }: { points: number[] }) {
  if (points.length < 2) return <div className="sh-empty-chart">Place orders to see your revenue trend</div>
  const W = 260, H = 120, pad = 6
  const max = Math.max(...points, 1)
  const step = (W - pad * 2) / (points.length - 1)
  const xy = points.map((v, i) => [pad + i * step, H - pad - (v / max) * (H - pad * 2)])
  const line = xy.map(p => p.join(",")).join(" ")
  const area = `${pad},${H - pad} ${line} ${pad + (points.length - 1) * step},${H - pad}`
  return (
    <div className="sh-line-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="140" preserveAspectRatio="none" role="img" aria-label="Revenue trend">
        <defs>
          <linearGradient id="shArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f7a3a" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#1f7a3a" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#shArea)" />
        <polyline points={line} fill="none" stroke="#1f7a3a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {xy.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#fff" stroke="#1f7a3a" strokeWidth="2" />)}
      </svg>
    </div>
  )
}

const TABS = ["overview", "stock", "orders", "tickets", "balance", "documents"] as const
type Tab = typeof TABS[number]

/* Sidebar nav keys ↔ portal tabs, so the side navigation really navigates */
const NAV_TO_TAB: Record<string, Tab> = {
  dashboard: "overview", stock: "stock", "place-order": "stock",
  orders: "orders", payments: "balance", tickets: "tickets", complaints: "tickets",
  documents: "documents",
}
const TAB_TO_NAV: Record<Tab, string> = {
  overview: "dashboard", stock: "stock", orders: "orders", tickets: "tickets", balance: "payments", documents: "documents",
}

export function CustomerPortal({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [tab, setTab]                   = useState<Tab>("overview")
  const [current, setCurrent]           = useState("dashboard")
  const [products, setProducts]         = useState<Product[]>([])
  const [stock, setStock]               = useState<StockItem[]>([])
  const [orders, setOrders]             = useState<Order[]>([])
  const [invoices, setInvoices]         = useState<Invoice[]>([])
  const [payments, setPayments]         = useState<Payment[]>([])
  const [creditNotes, setCreditNotes]   = useState<CreditNote[]>([])
  const [creditNoteAllocations, setCreditNoteAllocations] = useState<CreditNoteAllocation[]>([])
  const [tickets, setTickets]           = useState<SupportTicket[]>([])
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [search, setSearch]             = useState("")
  const [orderPage, setOrderPage]       = useState(1)
  const [showOrder, setShowOrder]       = useState(false)
  const [quickSearch, setQuickSearch]   = useState("")
  const [showTicket, setShowTicket]     = useState(false)
  const [ticketSubject, setTicketSubject] = useState("")
  const [ticketMsg, setTicketMsg]       = useState("")
  const [notifOpen, setNotifOpen]       = useState(false)
  const [myFiles, setMyFiles]           = useState<StoredFile[]>([])
  const [filesLoading, setFilesLoading] = useState(true)
  const [docPreview, setDocPreview]     = useState<StoredFile | null>(null)
  const [orderDetail, setOrderDetail]   = useState<Order | null>(null)
  const [ticketDetail, setTicketDetail] = useState<SupportTicket | null>(null)
  const [invoiceDetail, setInvoiceDetail] = useState<Invoice | null>(null)
  const [me, setMe]                     = useState<Customer | null>(null)
  const [paySel, setPaySel]             = useState<Set<string>>(new Set())
  const [payMsg, setPayMsg]             = useState<{ ok: boolean; text: string } | null>(null)
  const [showProofModal, setShowProofModal] = useState(false)
  const [myProofs, setMyProofs]         = useState<PaymentProof[]>([])
  const [proofFile, setProofFile]       = useState<File | null>(null)
  const [proofNote, setProofNote]       = useState("")
  const [proofBusy, setProofBusy]       = useState(false)
  const [proofError, setProofError]     = useState("")

  const load = async () => {
    const [p, s, o, inv, pay, tix, custs, cn, cna] = await Promise.all([
      getProducts(), getStock(), getOrders(), getInvoices(), getPayments(), getTickets(), getCustomers(),
      getCreditNotes(), getCreditNoteAllocations(),
    ])
    setProducts(p); setStock(s); setOrders(o); setInvoices(inv); setPayments(pay); setTickets(tix)
    setCreditNotes(cn); setCreditNoteAllocations(cna)
    setMe(custs.find(c => c.id === user.id) ?? null)
    setFilesLoading(true)
    listFilesForCustomer(user.id).then(setMyFiles).catch(() => setMyFiles([])).finally(() => setFilesLoading(false))
    listPaymentProofsForCustomer(user.id).then(setMyProofs).catch(() => setMyProofs([]))
    // Stock-update notification — shows once per daily cycle (06:00 GMT)
    try {
      const key = "punjab-stock-notif-" + currentCycleStart().toISOString().slice(0, 10)
      if (!sessionStorage.getItem(key)) setNotifOpen(true)
    } catch { /* storage unavailable */ }
  }
  useEffect(() => { load() }, [])

  const openProofUpload = () => {
    setProofFile(null); setProofNote(""); setProofError(""); setShowProofModal(true)
  }

  // Customer pays by bank transfer themselves, then uploads a screenshot of
  // the transfer here as proof. An admin reviews it and presses "Payment
  // Received" before the invoices are actually marked paid.
  const submitProof = async () => {
    if (!proofFile) { setProofError("Please choose a screenshot to upload."); return }
    if (proofFile.size > MAX_PROOF_BYTES) { setProofError("That file is too large — please upload a screenshot under 4 MB."); return }
    const invs = myInvoices.filter(i => i.status !== "Paid" && paySel.has(i.id))
    if (invs.length === 0) { setProofError("Select at least one invoice to pay."); return }
    setProofBusy(true); setProofError("")
    try {
      const dataUri = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = () => reject(r.error)
        r.readAsDataURL(proofFile)
      })
      const amount = invs.reduce((s, i) => s + i.amount, 0)
      const invoiceNumbers = invs.map(i => i.invoiceNumber)
      await uploadPaymentProof({
        customerId: user.id, customerName: user.displayName,
        invoiceIds: invs.map(i => i.id), invoiceNumbers,
        amount, fileName: proofFile.name, fileType: proofFile.type || "image/png",
        dataUri, note: proofNote.trim(),
      })
      void sendEmail(user.email, "We've received your payment proof", paymentProofSubmittedEmailHtml(user.displayName, invoiceNumbers, amount))
      void sendEmail(ADMIN_NOTIFY_EMAIL, `Payment proof to review — ${user.displayName}`, paymentProofAdminAlertEmailHtml(user.displayName, invoiceNumbers, amount))
      setPayMsg({ ok: true, text: "Thanks — your payment proof has been submitted and is awaiting review. We'll email you once it's confirmed." })
      setPaySel(new Set())
      setShowProofModal(false)
      await load()
    } catch {
      setProofError("Upload failed — please try again.")
    }
    setProofBusy(false)
  }

  const handleNav = (key: string) => {
    setCurrent(key)
    const t = NAV_TO_TAB[key]
    if (t) setTab(t)
    if (key === "place-order") setShowOrder(true)
    if (key === "orders") markOrdersSeen()
    if (key === "tickets") markTicketsSeen()
  }
  const switchTab = (t: Tab) => {
    setTab(t); setCurrent(TAB_TO_NAV[t])
    if (t === "orders") markOrdersSeen()
    if (t === "tickets") markTicketsSeen()
  }
  const reorder = (productName: string) => { setQuickSearch(productName); setShowOrder(true) }

  // The bell represents ALL notifications, not just one tab's — clear
  // everything and jump to whichever section actually has something new.
  const openNotifications = () => {
    markOrdersSeen()
    markTicketsSeen()
    switchTab(newOrderUpdates > 0 ? "orders" : newTicketUpdates > 0 ? "tickets" : "orders")
  }

  const dismissNotif = () => {
    try { sessionStorage.setItem("punjab-stock-notif-" + currentCycleStart().toISOString().slice(0, 10), "1") } catch { /* ignore */ }
    setNotifOpen(false)
  }

  const myOrders   = useMemo(() => orders.filter(o => o.customerId === user.id), [orders, user.id])
  const myTickets  = useMemo(() => tickets.filter(t => t.customerId === user.id), [tickets, user.id])
  const myInvoices = useMemo(() => invoices.filter(i => i.customerId === user.id), [invoices, user.id])
  const myPayments = useMemo(() => payments.filter(p => p.customerId === user.id), [payments, user.id])
  const myCreditNotes = useMemo(() => creditNotes.filter(c => c.customerId === user.id), [creditNotes, user.id])
  const myCreditAllocations = useMemo(
    () => creditNoteAllocations.filter(a => myCreditNotes.some(c => c.id === a.creditNoteId)),
    [creditNoteAllocations, myCreditNotes],
  )
  const myBalance  = myInvoices.filter(i => i.status !== "Paid").reduce((s, i) => s + invoiceOutstanding(i), 0)
  const totalCreditApplied = myCreditAllocations.reduce((s, a) => s + a.amount, 0)
  const remainingCredit = myCreditNotes.filter(c => c.status === "Active").reduce((s, c) => s + c.remainingBalance, 0)
  const stockMap   = useMemo(() => { const m: Record<string, StockItem> = {}; for (const s of stock) m[s.productId] = s; return m }, [stock])

  // Keep checking for order/ticket updates while the customer stays on one page
  usePoll(load, 25000)
  const { unseenCount: newOrderUpdates, markAllSeen: markOrdersSeen } = useUnseenCount(myOrders, `punjab-seen-orders-cust-${user.id}`)
  const { unseenCount: newTicketUpdates, markAllSeen: markTicketsSeen } = useUnseenCount(myTickets, `punjab-seen-tickets-cust-${user.id}`)
  const { toasts, dismiss } = useLiveToasts(myOrders, (prevById, o) => {
    const prev = prevById.get(o.id)
    if (prev && prev.status !== o.status) return { id: `order-${o.id}-${o.status}`, title: "Order update", body: `${o.orderNumber} is now ${o.status}` }
    return null
  })

  const totalBoxes  = myOrders.reduce((s, o) => s + o.items.reduce((q, it) => q + it.quantity, 0), 0)
  const stockFresh  = isStockFresh(stock)
  const stockAt     = latestStockUpdate(stock)

  const filteredOrders = useMemo(() => {
    return myOrders.filter(o => {
      if (statusFilter && o.status !== statusFilter) return false
      if (search && !`${o.orderNumber} ${o.customerName}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [myOrders, statusFilter, search])

  const ORDER_PAGE_SIZE = 6
  const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / ORDER_PAGE_SIZE))
  const safeOrderPage   = Math.min(orderPage, totalOrderPages)
  const pagedOrders     = filteredOrders.slice((safeOrderPage - 1) * ORDER_PAGE_SIZE, safeOrderPage * ORDER_PAGE_SIZE)

  const exportMyOrders = () => {
    exportToCsv(
      "my-orders",
      ["Order Number", "Date", "Status", "Items", "Order Value"],
      myOrders.map(o => [o.orderNumber, o.date, o.status, o.items.length, o.amount.toFixed(2)]),
    )
  }

  /* chart data — boxes ordered, grouped by date (non-financial) */
  const boxesOf = (o: Order) => o.items.reduce((q, it) => q + it.quantity, 0)
  const byDate: Record<string, number> = {}
  for (const o of myOrders) byDate[o.date] = (byDate[o.date] ?? 0) + boxesOf(o)
  const barData = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).slice(-8)
    .map(([date, n]) => ({ label: date.slice(5), value: n }))
  const maxBar = Math.max(...barData.map(b => b.value), 1)
  const cumulative: number[] = []
  ;[...myOrders].sort((a, b) => a.date.localeCompare(b.date)).forEach(o => {
    cumulative.push((cumulative[cumulative.length - 1] ?? 0) + boxesOf(o))
  })

  const statusCount = (s: string) => myOrders.filter(o => o.status === s).length

  /* Quick reorder — your 3 most-ordered products, one tap away */
  const boxesByProduct: Record<string, number> = {}
  for (const o of myOrders) for (const it of o.items) boxesByProduct[it.productId] = (boxesByProduct[it.productId] ?? 0) + it.quantity
  const topProducts = Object.entries(boxesByProduct)
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([pid, qty]) => ({ product: products.find(p => p.id === pid), qty }))
    .filter((x): x is { product: Product; qty: number } => Boolean(x.product) && stockMap[x.product!.id]?.status !== "out")

  const page = () => {
    switch (tab) {
      // ── OVERVIEW — Shopall style ─────────────────────────
      case "overview": return (
        <div className="cd-content">
          {/* promo banner */}
          <div className="sh-banner">
            <div className="sh-banner-left">
              <span className="sh-banner-eyebrow">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                Fresh stock daily
              </span>
              <span className="sh-banner-title">Today's exotic produce is live — browse stock &amp; place your order.</span>
            </div>
            <button className="sh-banner-btn" onClick={() => switchTab("stock")}>View Stock</button>
          </div>

          {/* overview head */}
          <div className="sh-head">
            <span className="sh-head-title">Overview</span>
            <div className="sh-controls">
              <span className="sh-chip" style={{ cursor: "default" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
              <button className="sh-chip" onClick={exportMyOrders} title="Download my orders as CSV">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export
              </button>
            </div>
          </div>

          {/* stat cards — non-financial */}
          <div className="sh-stats">
            <StatCard label="Total Orders" value={String(myOrders.length)} delta="+12%" positive
              iconBg="#ecfeff" iconColor="#0891b2"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>} />
            <StatCard label="Boxes Ordered" value={String(totalBoxes)} delta="+8%" positive
              iconBg="#f0fdf4" iconColor="#16a34a"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>} />
            <StatCard label="Pending Orders" value={String(myOrders.filter(o => o.status === "Pending").length)} delta="in review" positive
              iconBg="#e8f8ec" iconColor="#1f7a3a"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
            <StatCard label="Products Available" value={String(stock.filter(s => s.status !== "out").length)} delta={stockFresh ? "updated today" : "awaiting update"} positive={stockFresh}
              iconBg="#fef3c7" iconColor="#b45309"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>} />
          </div>

          {/* quick reorder — your most-ordered produce, one tap away */}
          {topProducts.length > 0 && (
            <div className="qr-row">
              <span className="qr-label">Quick Reorder</span>
              {topProducts.map(({ product, qty }) => (
                <button key={product.id} className="qr-chip" onClick={() => reorder(product.productName)}>
                  <span className="qr-chip-av" style={{ background: catColor(product.category) + "1f", color: catColor(product.category) }}>
                    {product.productName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="qr-chip-info">
                    <strong>{product.productName}</strong>
                    <small>Ordered {qty} boxes before</small>
                  </span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              ))}
            </div>
          )}

          {/* charts */}
          <div className="sh-charts">
            <div className="sh-chart-card">
              <div className="sh-chart-title">Order Activity</div>
              <div className="sh-chart-big">{myOrders.length ? `${myOrders.length} orders` : "No orders yet"}</div>
              <div className="sh-chart-sub"><strong>{myOrders.length ? "+20.1%" : ""}</strong>{myOrders.length ? " from last month" : "Your order history will appear here"}</div>
              {barData.length > 0 ? (
                <div className="sh-bars">
                  {barData.map((b, i) => (
                    <div key={i} className="sh-bar-col">
                      <div className="sh-bar-track">
                        <div className="sh-bar-fill" style={{ height: `${Math.max(6, (b.value / maxBar) * 100)}%` }} title={`${b.value} boxes`} />
                      </div>
                      <span className="sh-bar-lab">{b.label}</span>
                    </div>
                  ))}
                </div>
              ) : <div className="sh-empty-chart">Place your first order to see charts</div>}
            </div>
            <div className="sh-chart-card">
              <div className="sh-chart-title">Boxes Ordered</div>
              <div className="sh-chart-big">{totalBoxes.toLocaleString("en-GB")} boxes</div>
              <div className="sh-chart-sub"><strong>{cumulative.length > 1 ? "+20.1%" : ""}</strong>{cumulative.length > 1 ? " from last month" : "Cumulative boxes over time"}</div>
              <RevenueLine points={cumulative} />
            </div>
          </div>

          {/* recent orders */}
          <div className="sh-table-card">
            <div className="sh-ttabs">
              {STATUS_TABS.map(t => {
                const n = t === "All" ? myOrders.length : statusCount(t)
                const active = (t === "All" && !statusFilter) || statusFilter === t
                return (
                  <button key={t} className={"sh-ttab" + (active ? " on" : "")} onClick={() => { setStatusFilter(t === "All" ? "" : t); setOrderPage(1) }}>
                    {t}{n > 0 && t !== "All" && <span className="sh-ttab-badge">{n}</span>}
                  </button>
                )
              })}
              <div style={{ marginLeft: "auto", padding: "6px 4px" }}>
                <input className="cd-search" style={{ width: 140 }} placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setOrderPage(1) }} />
              </div>
            </div>
            <div className="cd-table-scroll">
              <table className="cd-table">
                <thead><tr>
                  <th style={{ width: 36 }}><input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(pagedOrders.map(o => o.id)) : new Set())} /></th>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Details</th>
                  <th>Value</th>
                  <th>Fulfilment</th>
                </tr></thead>
                <tbody>
                  {pagedOrders.map(order => {
                    const isSelected = selected.has(order.id)
                    const pct = order.status === "Delivered" ? 100 : order.status === "Preparing" ? 65 : order.status === "Confirmed" ? 35 : 10
                    return (
                      <tr key={order.id} className={(isSelected ? "cd-row selected" : "cd-row") + " cd-row-clickable"} onClick={() => setOrderDetail(order)}>
                        <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={() => { const s = new Set(selected); if (isSelected) s.delete(order.id); else s.add(order.id); setSelected(s) }} /></td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Avatar name={order.orderNumber} />
                            <div>
                              <div style={{ fontWeight: 600, color: "#111827", fontSize: 13.5 }}>{order.orderNumber}</div>
                              <div style={{ fontSize: 12, color: "#9ca3af" }}>{order.date}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className="cd-status-badge" style={{ background: STATUS_COLORS[order.status] + "20", color: STATUS_COLORS[order.status] }}>{order.status}</span></td>
                        <td style={{ fontSize: 13, color: "#6b7280" }}>{order.items.length} product{order.items.length !== 1 ? "s" : ""}</td>
                        <td><strong>£{order.amount.toFixed(2)}</strong></td>
                        <td><ProgressBar pct={pct} color={STATUS_COLORS[order.status]} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {filteredOrders.length === 0 && (
              <div style={{ padding: "36px 24px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#c3c9d2" strokeWidth="1.6" style={{ marginBottom: 8 }}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>
                <div>No orders yet — hit “+ Place Order” to get started.</div>
              </div>
            )}
            <div className="sh-pager-row">
              <button className="sh-pgbtn" onClick={() => setOrderPage(1)} disabled={safeOrderPage === 1}>&laquo;</button>
              <button className="sh-pgbtn" onClick={() => setOrderPage(p => Math.max(1, p - 1))} disabled={safeOrderPage === 1}>&lsaquo;</button>
              <button className="sh-pgbtn" onClick={() => setOrderPage(p => Math.min(totalOrderPages, p + 1))} disabled={safeOrderPage === totalOrderPages}>&rsaquo;</button>
              <button className="sh-pgbtn" onClick={() => setOrderPage(totalOrderPages)} disabled={safeOrderPage === totalOrderPages}>&raquo;</button>
            </div>
          </div>
        </div>
      )

      // ── DAILY STOCK ───────────────────────────────────────
      case "stock": return (
        <div className="cd-content">
          <div className="sh-stats" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <StatCard label="Available Products" value={String(stock.filter(s => s.status !== "out").length)} delta="+7%" positive
              iconBg="#f0fdf4" iconColor="#16a34a"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>} />
            <StatCard label="Low Stock Items" value={String(stock.filter(s => s.status === "low").length)}
              iconBg="#fef3c7" iconColor="#b45309"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} />
            <StatCard label="Out of Stock" value={String(stock.filter(s => s.status === "out").length)}
              iconBg="#fef2f2" iconColor="#dc2626"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>} />
          </div>
          <div className="cd-table-card">
            <div className="cd-table-scroll">
            <table className="cd-table">
              <thead><tr>
                <th>Product</th>
                <th>Variety / Size</th>
                <th>Price per Box</th>
                <th>Available</th>
                <th>Status</th>
                <th>Stock Level</th>
              </tr></thead>
              <tbody>
                {products.map(p => {
                  const s = stockMap[p.id]
                  if (!s) return null
                  const pct = Math.min(100, (s.availableQuantity / 100) * 100)
                  return (
                    <tr key={p.id} className="cd-row">
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={p.productName} color={STOCK_COLORS[s.status] + "cc"} />
                          <div>
                            <div style={{ fontWeight: 600, color: "#111827", fontSize: 13.5 }}>{p.productName}</div>
                            <div style={{ fontSize: 12, color: "#9ca3af" }}>{p.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>{p.variety}<br/><span style={{ color: "#9ca3af" }}>{p.size}</span></td>
                      <td><strong>£{s.price.toFixed(2)}</strong></td>
                      <td>{s.availableQuantity} boxes</td>
                      <td><span className="cd-status-badge" style={{ background: STOCK_COLORS[s.status] + "18", color: STOCK_COLORS[s.status] }}>{s.status === "available" ? "In Stock" : s.status === "low" ? "Low Stock" : "Out of Stock"}</span></td>
                      <td><ProgressBar pct={pct} color={STOCK_COLORS[s.status]} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
            {products.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No products available yet — check back soon.</div>}
          </div>
        </div>
      )

      // ── ORDERS ─────────────────────────────────────────────
      case "orders": return (
        <div className="cd-content">
          <div className="cd-table-card">
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #eaecf0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>All Orders ({myOrders.length})</span>
              <Button onClick={() => setShowOrder(true)} disabled={Boolean(me?.blocked)}
            title={me?.blocked ? "Ordering is paused until your balance is settled" : undefined}>+ Place Order</Button>
            </div>
            <div className="cd-table-scroll">
            <table className="cd-table">
              <thead><tr><th>Order #</th><th>Date</th><th>Products</th><th>Amount</th><th>Status</th><th>Progress</th></tr></thead>
              <tbody>
                {myOrders.map(o => {
                  const pct = o.status === "Delivered" ? 100 : o.status === "Preparing" ? 65 : o.status === "Confirmed" ? 35 : 10
                  return (
                    <tr key={o.id} className="cd-row cd-row-clickable" onClick={() => setOrderDetail(o)}>
                      <td><strong>{o.orderNumber}</strong></td>
                      <td style={{ color: "#6b7280" }}>{o.date}</td>
                      <td>{o.items.length} item{o.items.length !== 1 ? "s" : ""}</td>
                      <td><strong>£{o.amount.toFixed(2)}</strong></td>
                      <td><span className="cd-status-badge" style={{ background: STATUS_COLORS[o.status] + "20", color: STATUS_COLORS[o.status] }}>{o.status}</span></td>
                      <td><ProgressBar pct={pct} color={STATUS_COLORS[o.status]} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
            {myOrders.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No orders yet</div>}
          </div>
        </div>
      )

      // ── TICKETS ────────────────────────────────────────────
      case "tickets": return (
        <div className="cd-content">
          <div className="cd-table-card">
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #eaecf0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>Support Tickets</span>
              <Button onClick={() => setShowTicket(true)}>+ New Ticket</Button>
            </div>
            <div className="cd-table-scroll">
            <table className="cd-table">
              <thead><tr><th>Subject</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {myTickets.map(t => (
                  <tr key={t.id} className="cd-row cd-row-clickable" onClick={() => setTicketDetail(t)}>
                    <td><strong>{t.subject}</strong><br/><span style={{ fontSize: 12, color: "#9ca3af" }}>{t.message.slice(0, 60)}…</span></td>
                    <td><span className="cd-status-badge" style={{ background: t.status === "Open" ? "#fef9c3" : "#f3f4f6", color: t.status === "Open" ? "#a16207" : "#6b7280" }}>{t.status}</span></td>
                    <td style={{ color: "#6b7280", fontSize: 13 }}>{t.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {myTickets.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No tickets yet</div>}
          </div>
        </div>
      )

      // ── BALANCE ────────────────────────────────────────────
      case "balance": {
        const credit = me ? getCreditStatus(me, invoices) : null
        const overdueIds = new Set(credit?.overdueInvoices.map(i => i.id) ?? [])
        const unpaid = myInvoices.filter(i => i.status !== "Paid")
        const selTotal = unpaid.filter(i => paySel.has(i.id)).reduce((s, i) => s + i.amount, 0)
        return (
        <div className="cd-content">
          {payMsg && (
            <div style={{ padding: "10px 16px", borderRadius: 10, fontSize: 13.5, marginBottom: 4,
              background: payMsg.ok ? "#f0fdf4" : "#fef2f2", color: payMsg.ok ? "#15803d" : "#b91c1c" }}>
              {payMsg.text}
            </div>
          )}
          {credit && credit.minimumDue > 0 && (
            <div style={{ padding: "12px 16px", borderRadius: 10, fontSize: 13.5, marginBottom: 4, background: "#fef2f2", color: "#b91c1c" }}>
              <strong>Payment required:</strong> please pay at least <strong>£{credit.minimumDue.toFixed(2)}</strong> now
              {credit.overdueInvoices.length > 0 && <> — {credit.overdueInvoices.length} invoice{credit.overdueInvoices.length !== 1 ? "s are" : " is"} past your {me?.creditDays ?? 14}-day terms</>}
              {credit.overLimitBy > 0 && <> — your balance is £{credit.overLimitBy.toFixed(2)} over your £{(me?.creditLimit ?? 0).toFixed(2)} credit limit</>}.
            </div>
          )}
          <div className="sh-stats" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            <StatCard label="Outstanding Balance" value={`£${myBalance.toFixed(2)}`}
              iconBg="#fef2f2" iconColor="#dc2626"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} />
            <StatCard label="Invoices" value={String(myInvoices.length)}
              iconBg="#e8f8ec" iconColor="#1f7a3a"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} />
            <StatCard label="Payments Made" value={String(myPayments.length)}
              iconBg="#f0fdf4" iconColor="#16a34a"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>} />
            <StatCard label="Remaining Credit" value={`£${remainingCredit.toFixed(2)}`}
              iconBg="#eff6ff" iconColor="#1d4ed8"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 9l6-1z"/></svg>} />
          </div>
          <div className="cd-table-card">
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #eaecf0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Invoices</span>
              {unpaid.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {paySel.size > 0 && <span style={{ fontSize: 13.5 }}>Selected: <strong>£{selTotal.toFixed(2)}</strong></span>}
                  <Button className="btn-sm" disabled={paySel.size === 0} onClick={openProofUpload}>
                    {paySel.size > 0 ? `Upload Payment Proof for ${paySel.size} Invoice${paySel.size !== 1 ? "s" : ""}` : "Select invoices to pay"}
                  </Button>
                </div>
              )}
            </div>
            <p style={{ padding: "0 20px 14px", margin: 0, fontSize: 12.5, color: "#6b7a70" }}>
              Pay by bank transfer to Punjab Exotic Foods, then upload a screenshot of the transfer here — we'll confirm it once reviewed.
            </p>
            <div className="cd-table-scroll">
            <table className="cd-table">
              <thead><tr><th></th><th>Invoice #</th><th>Amount</th><th>Paid</th><th>Outstanding</th><th>Due Date</th><th>Status</th></tr></thead>
              <tbody>
                {myInvoices.map(inv => {
                  const isOverdue = overdueIds.has(inv.id)
                  const unpaidRow = inv.status !== "Paid"
                  const pendingProof = myProofs.find(p => p.status === "pending" && p.invoiceIds.includes(inv.id))
                  const paidSoFar = inv.amountPaid ?? 0
                  return (
                    <tr key={inv.id} className="cd-row cd-row-clickable" onClick={() => setInvoiceDetail(inv)}>
                      <td onClick={e => e.stopPropagation()}>
                        {unpaidRow && !pendingProof && (
                          <input type="checkbox" checked={paySel.has(inv.id)}
                            onChange={() => setPaySel(prev => {
                              const next = new Set(prev)
                              if (next.has(inv.id)) next.delete(inv.id); else next.add(inv.id)
                              return next
                            })} />
                        )}
                      </td>
                      <td><strong>{inv.invoiceNumber}</strong></td>
                      <td>£{inv.amount.toFixed(2)}</td>
                      <td style={{ color: "#15803d" }}>{paidSoFar > 0 ? `£${paidSoFar.toFixed(2)}` : "—"}</td>
                      <td style={{ color: invoiceOutstanding(inv) > 0 ? "#b91c1c" : "#9ca3af" }}>£{invoiceOutstanding(inv).toFixed(2)}</td>
                      <td style={{ color: isOverdue ? "#b91c1c" : "#6b7280" }}>{inv.dueDate}</td>
                      <td>
                        {inv.status === "Paid" ? (
                          <span className="cd-status-badge" style={{ background: "#dcfce7", color: "#15803d" }}>Paid</span>
                        ) : pendingProof ? (
                          <span className="cd-status-badge" style={{ background: "#dbeafe", color: "#1d4ed8" }}>Awaiting Review</span>
                        ) : inv.status === "Part Paid" ? (
                          <span className="cd-status-badge" style={{ background: "#dbeafe", color: "#1d4ed8" }}>Part Paid</span>
                        ) : (
                          <span className="cd-status-badge" style={{ background: isOverdue ? "#fee2e2" : "#fef9c3", color: isOverdue ? "#b91c1c" : "#a16207" }}>
                            {isOverdue ? "Overdue" : "Unpaid"}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
            {myInvoices.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No invoices yet</div>}
          </div>

          <div className="cd-table-card">
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #eaecf0" }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Credit Notes</span>
              <span style={{ marginLeft: 8, fontSize: 12.5, color: "#9ca3af" }}>Credit issued to your account, e.g. for returns or adjustments</span>
            </div>
            <div className="cd-table-scroll">
            <table className="cd-table">
              <thead><tr><th>Credit #</th><th>Date</th><th>Amount</th><th>Reason</th><th>Remaining</th><th>Status</th></tr></thead>
              <tbody>
                {myCreditNotes.map(cn => (
                  <tr key={cn.id} className="cd-row">
                    <td><strong>{cn.creditNumber}</strong></td>
                    <td style={{ color: "#6b7280" }}>{cn.date}</td>
                    <td>£{cn.amount.toFixed(2)}</td>
                    <td>{cn.reason}</td>
                    <td style={{ color: cn.remainingBalance > 0 ? "#15803d" : "#9ca3af" }}>£{cn.remainingBalance.toFixed(2)}</td>
                    <td>
                      <span className="cd-status-badge" style={cn.status === "Active" ? { background: "#dcfce7", color: "#15803d" } : { background: "#f3f4f6", color: "#6b7280" }}>{cn.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {myCreditNotes.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No credit notes yet</div>}
            {totalCreditApplied > 0 && (
              <p style={{ padding: "0 20px 14px", margin: 0, fontSize: 12.5, color: "#6b7a70" }}>
                Credit Applied to invoices so far: <strong>£{totalCreditApplied.toFixed(2)}</strong>
              </p>
            )}
          </div>
        </div>
        )
      }

      // ── DOCUMENTS ──────────────────────────────────────────
      case "documents": return (
        <div className="cd-content">
          <div className="cd-table-card">
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #eaecf0" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>My Documents</span>
              <span style={{ marginLeft: 8, fontSize: 12.5, color: "#9ca3af" }}>Invoices and files shared with you by Punjab Exotic Foods</span>
            </div>
            {filesLoading ? (
              <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>Loading your documents…</div>
            ) : myFiles.length === 0 ? (
              <div style={{ padding: "36px 24px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#c3c9d2" strokeWidth="1.6" style={{ marginBottom: 8 }}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/></svg>
                <div>No documents shared with you yet.</div>
              </div>
            ) : (
              <div className="fl-list" style={{ padding: 14 }}>
                {myFiles.map(f => {
                  const isImage = f.type.startsWith("image/")
                  const canPreview = isImage || f.type === "application/pdf"
                  return (
                    <div key={f.id} className="fl-row">
                      <span className="fl-kind" style={{ background: "#e8f8ec", color: "#1f7a3a" }}>
                        {f.type === "application/pdf" ? "PDF" : isImage ? "IMG" : "DOC"}
                      </span>
                      <div className="fl-info">
                        <div className="fl-name">{f.name}</div>
                        <div className="fl-meta">
                          {f.note && <>{f.note} · </>}
                          {f.uploadedAt ? new Date(f.uploadedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </div>
                      </div>
                      <div className="fl-actions">
                        {canPreview && <Button variant="secondary" className="btn-sm" onClick={() => setDocPreview(f)}>Preview</Button>}
                        <a className="btn btn-secondary btn-sm" href={f.dataUri} download={f.name}>Download</a>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )
    }
  }

  return (
    <AppLayout
      role="customer" user={user} current={current} onNavigate={handleNav} onLogout={onLogout}
      badges={{ orders: newOrderUpdates, tickets: newTicketUpdates }}
      notifCount={newOrderUpdates + newTicketUpdates}
      onBellClick={openNotifications}
    >
      {/* Daily stock notification — once per 06:00 UK-time cycle */}
      {notifOpen && (
        <div className={"cn-toast " + (stockFresh ? "ok" : "due")} role="status">
          {stockFresh
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          <div style={{ flex: 1 }}>
            {stockFresh
              ? <><strong>Today's stock has been updated{stockAt ? ` at ${formatLondonTime(stockAt)}` : ""}.</strong> Fresh produce is live — browse today's stock and place your order.</>
              : <><strong>Today's stock update is pending.</strong> Stock refreshes daily at 06:00 UK time — quantities and prices may change shortly.</>}
          </div>
          <button className="cn-toast-x" onClick={dismissNotif} aria-label="Dismiss">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Account blocked — payment required before any new orders */}
      {me?.blocked && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", margin: "0 0 4px", borderRadius: 12, background: "#7f1d1d", color: "#fff", fontSize: 13.5 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          <div style={{ flex: 1 }}>
            <strong>Payment needed to continue — your account is on hold until this is paid.</strong>{" "}
            You can't place new orders until your balance is settled. Please pay in Balance, or call us on {URGENT_SUPPORT_PHONE}.
          </div>
          <Button className="btn-sm" variant="secondary" onClick={() => switchTab("balance")}>View &amp; Pay</Button>
        </div>
      )}

      {/* Breadcrumb bar — Shopall style */}
      <div className="cb-bar">
        <button className="cb-arrow" onClick={() => switchTab("overview")} disabled={tab === "overview"} title="Back to overview">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button className="cb-arrow" onClick={() => switchTab("stock")} disabled={tab !== "overview"} title="Go to stock">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <span className="cb-path">Pages / <strong>{tab.charAt(0).toUpperCase() + tab.slice(1)}</strong></span>
        <div className="cb-right">
          <GmtClock />
          <button className="cd-import-btn" onClick={exportMyOrders} title="Download my orders as CSV">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Export
          </button>
          <Button onClick={() => setShowOrder(true)} disabled={Boolean(me?.blocked)}
            title={me?.blocked ? "Ordering is paused until your balance is settled" : undefined}>+ Place Order</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="cd-tabs">
        {(["overview", "stock", "orders", "tickets", "balance", "documents"] as Tab[]).map(t => (
          <button key={t} className={"cd-tab" + (tab === t ? " active" : "")} onClick={() => switchTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === "documents" && myFiles.length > 0 && <span className="cd-tab-badge">{myFiles.length}</span>}
          </button>
        ))}
      </div>

      {page()}

      {/* Place order — premium multi-item shop experience */}
      <PlaceOrderModal
        key={quickSearch}
        open={showOrder && !me?.blocked}
        onClose={() => { setShowOrder(false); setQuickSearch("") }}
        products={products}
        stock={stock}
        customerId={user.id}
        customerName={user.displayName}
        customerEmail={user.email}
        onPlaced={load}
        initialSearch={quickSearch}
      />

      {/* Upload bank-transfer payment proof */}
      <Modal open={showProofModal} title="Upload Payment Proof" onClose={() => setShowProofModal(false)}>
        <div>
          <p style={{ fontSize: 13.5, color: "#6b7a70", marginBottom: 14 }}>
            Once you've paid by bank transfer, upload a screenshot of the transfer confirmation. An admin will check it
            and mark your invoice{paySel.size !== 1 ? "s" : ""} as paid once confirmed.
          </p>
          <div style={{ marginBottom: 14 }}>
            {myInvoices.filter(i => paySel.has(i.id)).map(i => (
              <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "4px 0", color: "#374151" }}>
                <span>{i.invoiceNumber}</span>
                <strong>£{i.amount.toFixed(2)}</strong>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: "#14532d", marginTop: 8, paddingTop: 8, borderTop: "1px solid #eef1ee" }}>
              <span>Total</span>
              <span>£{myInvoices.filter(i => paySel.has(i.id)).reduce((s, i) => s + i.amount, 0).toFixed(2)}</span>
            </div>
          </div>
          <label className="form-control">
            <span>Screenshot of transfer</span>
            <input type="file" accept="image/*" onChange={e => { setProofFile(e.target.files?.[0] ?? null); setProofError("") }} />
          </label>
          <div style={{ marginTop: 10 }}>
            <TextArea label="Note (optional)" value={proofNote} onChange={e => setProofNote(e.target.value)} rows={2} placeholder="e.g. reference number used" />
          </div>
          {proofError && <p style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", marginTop: 10 }}>{proofError}</p>}
          <div className="actions-row" style={{ marginTop: 16 }}>
            <Button onClick={submitProof} disabled={proofBusy}>{proofBusy ? "Uploading…" : "Submit for Review"}</Button>
            <Button variant="secondary" onClick={() => setShowProofModal(false)} disabled={proofBusy}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* New ticket modal */}
      <Modal open={showTicket} title="Submit Support Ticket" onClose={() => setShowTicket(false)}>
        <form className="form-grid" onSubmit={async e => {
          e.preventDefault()
          await createTicket('customer', user.id, ticketSubject, ticketMsg)
          setTicketSubject(""); setTicketMsg(""); setShowTicket(false); load()
        }}>
          <Input label="Subject" value={ticketSubject} onChange={e => setTicketSubject(e.target.value)} className="wide" required />
          <div className="wide"><TextArea label="Message" value={ticketMsg} onChange={e => setTicketMsg(e.target.value)} rows={4} /></div>
          <div className="wide actions-row">
            <Button type="submit">Submit Ticket</Button>
            <Button type="button" variant="secondary" onClick={() => setShowTicket(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Order detail popup */}
      <Modal open={Boolean(orderDetail)} title={orderDetail ? `Order ${orderDetail.orderNumber}` : "Order"} onClose={() => setOrderDetail(null)}>
        {orderDetail && (() => {
          const o = orderDetail
          const pct = o.status === "Delivered" ? 100 : o.status === "Preparing" ? 65 : o.status === "Confirmed" ? 35 : 10
          const steps = ["Pending", "Confirmed", "Preparing", "Delivered"]
          const stepIdx = o.status === "Cancelled" ? -1 : steps.indexOf(o.status)
          return (
            <div>
              <div className="ord-review">
                <div className="ord-row"><span>Status</span><span className="cd-status-badge" style={{ background: STATUS_COLORS[o.status] + "20", color: STATUS_COLORS[o.status] }}>{o.status}</span></div>
                <div className="ord-row"><span>Date placed</span><strong>{o.date}</strong></div>
                <div className="ord-row ord-total"><span>Total</span><strong>£{o.amount.toFixed(2)}</strong></div>
              </div>

              {o.status !== "Cancelled" && (
                <div className="ord-track">
                  {steps.map((s, i) => (
                    <div key={s} className={"ord-track-step" + (i <= stepIdx ? " done" : "")}>
                      <span className="ord-track-dot" />
                      <span className="ord-track-label">{s}</span>
                    </div>
                  ))}
                </div>
              )}
              <ProgressBar pct={pct} color={STATUS_COLORS[o.status]} />

              <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", margin: "18px 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Items ({o.items.length})
              </p>
              <div className="ord-items">
                {o.items.map((it, i) => {
                  const p = products.find(x => x.id === it.productId)
                  return (
                    <div key={i} className="ord-item-row">
                      <Avatar name={p?.productName ?? it.productId} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: "#111827" }}>{p?.productName ?? "Product"}</div>
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>{it.quantity} × £{it.unitPrice.toFixed(2)}</div>
                      </div>
                      <strong>£{(it.quantity * it.unitPrice).toFixed(2)}</strong>
                    </div>
                  )
                })}
              </div>
              <div className="actions-row" style={{ marginTop: 16 }}>
                <Button variant="secondary" onClick={() => setOrderDetail(null)}>Close</Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Ticket detail popup */}
      <Modal open={Boolean(ticketDetail)} title={ticketDetail?.subject ?? "Ticket"} onClose={() => setTicketDetail(null)}>
        {ticketDetail && (
          <div>
            <div className="ord-row" style={{ border: "1px solid var(--border)", borderRadius: 12, marginBottom: 14 }}>
              <span>Status</span>
              <span className="cd-status-badge" style={{ background: ticketDetail.status === "Open" ? "#fef9c3" : "#f3f4f6", color: ticketDetail.status === "Open" ? "#a16207" : "#6b7280" }}>{ticketDetail.status}</span>
            </div>
            <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>Submitted {ticketDetail.createdAt}</p>
            <p style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.6, background: "#fafbfc", border: "1px solid var(--border-light)", borderRadius: 10, padding: 14 }}>
              {ticketDetail.message || "No message provided."}
            </p>
            <div className="actions-row" style={{ marginTop: 16 }}>
              <Button variant="secondary" onClick={() => setTicketDetail(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Invoice detail popup */}
      <Modal open={Boolean(invoiceDetail)} title={invoiceDetail?.invoiceNumber ?? "Invoice"} onClose={() => setInvoiceDetail(null)}>
        {invoiceDetail && (
          <div>
            <div className="ord-review">
              <div className="ord-row"><span>Status</span><span className="cd-status-badge" style={{ background: invoiceDetail.status === "Paid" ? "#dcfce7" : "#fee2e2", color: invoiceDetail.status === "Paid" ? "#15803d" : "#b91c1c" }}>{invoiceDetail.status}</span></div>
              <div className="ord-row"><span>Due date</span><strong>{invoiceDetail.dueDate}</strong></div>
              <div className="ord-row"><span>Invoice Total</span><strong>£{invoiceDetail.amount.toFixed(2)}</strong></div>
              <div className="ord-row"><span>Amount Paid</span><strong style={{ color: "#15803d" }}>£{(invoiceDetail.amountPaid ?? 0).toFixed(2)}</strong></div>
              <div className="ord-row ord-total"><span>Outstanding Balance</span><strong style={{ color: invoiceOutstanding(invoiceDetail) > 0 ? "#b91c1c" : "#9ca3af" }}>£{invoiceOutstanding(invoiceDetail).toFixed(2)}</strong></div>
            </div>
            {(() => {
              const invPayments = myPayments.filter(p => p.invoiceId === invoiceDetail.id)
              const invAllocations = myCreditAllocations.filter(a => a.invoiceId === invoiceDetail.id)
              if (invPayments.length === 0 && invAllocations.length === 0) return null
              return (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: 0.5 }}>Payment History</p>
                  {invPayments.map(p => (
                    <div key={p.id} style={{ fontSize: 12.5, color: "#374151", padding: "4px 0" }}>· {p.date} — Payment {p.paymentReference} £{p.amount.toFixed(2)}</div>
                  ))}
                  {invAllocations.map(a => {
                    const note = myCreditNotes.find(c => c.id === a.creditNoteId)
                    return <div key={a.id} style={{ fontSize: 12.5, color: "#1d4ed8", padding: "4px 0" }}>· {a.date} — Credit applied {note?.creditNumber ?? ""} £{a.amount.toFixed(2)}</div>
                  })}
                </div>
              )
            })()}
            <p style={{ fontSize: 12.5, color: "#9ca3af", margin: "14px 2px" }}>
              Looking for the PDF? Check <strong>Documents</strong> in the sidebar — your admin may have uploaded it there.
            </p>
            <div className="actions-row">
              <Button onClick={() => { setInvoiceDetail(null); switchTab("documents") }}>Go to Documents</Button>
              <Button variant="secondary" onClick={() => setInvoiceDetail(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Document preview popup */}
      <Modal open={Boolean(docPreview)} title={docPreview?.name ?? "Preview"} onClose={() => setDocPreview(null)}>
        {docPreview && (
          docPreview.type.startsWith("image/")
            ? <img src={docPreview.dataUri} alt={docPreview.name} style={{ maxWidth: "100%", borderRadius: 10 }} />
            : <iframe src={docPreview.dataUri} title={docPreview.name} style={{ width: "100%", height: "62vh", border: "none", borderRadius: 10 }} />
        )}
      </Modal>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </AppLayout>
  )
}
