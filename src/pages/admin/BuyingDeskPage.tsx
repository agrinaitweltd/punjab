import { useEffect, useMemo, useRef, useState } from "react"
import type { BuyingPrice, BuyingSession, Product, Supplier } from "../../types"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { Input, Select } from "../../components/ui/Input"
import { CAT_COLORS, type CatalogItem } from "./SessionPage"

type Tab = "current" | "best" | "confirmed" | "history" | "analytics" | "suppliers"

function todayIso() { return new Date().toISOString().slice(0, 10) }

/* Lightweight SVG line chart — same visual language as DashboardHome's AdminLine */
function PriceLine({ points, color = "#1f7a3a", empty }: { points: number[]; color?: string; empty: string }) {
  if (points.length < 2) return <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>{empty}</div>
  const W = 600, H = 160, pad = 10
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const range = max - min || 1
  const step = (W - pad * 2) / (points.length - 1)
  const xy = points.map((v, i) => [pad + i * step, H - pad - ((v - min) / range) * (H - pad * 2)])
  const line = xy.map(p => p.join(",")).join(" ")
  const area = `${pad},${H - pad} ${line} ${pad + (points.length - 1) * step},${H - pad}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="160" preserveAspectRatio="none" role="img">
      <defs>
        <linearGradient id="bdArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#bdArea)" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {xy.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#fff" stroke={color} strokeWidth="2" />)}
    </svg>
  )
}

export function BuyingDeskPage({
  sessions, prices, products, suppliers, canEdit = true, initialDate,
  onStartSession, onAddPrice, onUpdatePrice, onDeletePrice, onConfirm, onEndDailyBuying, onCreateSupplier,
}: {
  sessions: BuyingSession[]
  prices: BuyingPrice[]
  /** Products already created in the Products section — the Buying Desk only
      lets admins quote/confirm prices for produce that exists there already,
      it doesn't create new products itself. */
  products: Product[]
  suppliers: Supplier[]
  /** Gates Add/Edit/Delete/Confirm/End — history & analytics stay viewable to everyone. */
  canEdit?: boolean
  /** The current trading date (moves forward once Day End is used) —
      defaults the buying date picker here instead of always today. */
  initialDate?: string
  onStartSession: (date: string) => Promise<void>
  onAddPrice: (input: Omit<BuyingPrice, "id" | "confirmed">) => Promise<void>
  onUpdatePrice: (id: string, input: Partial<BuyingPrice>) => Promise<void>
  onDeletePrice: (id: string) => Promise<void>
  onConfirm: (price: BuyingPrice) => Promise<void>
  /** Moves confirmed items into Stock (hidden, qty 0) and navigates the admin
      to the Stock section, where quantity & selling price are set before it
      goes live — the Buying Desk itself no longer asks for those. */
  onEndDailyBuying: (session: BuyingSession, confirmedPrices: BuyingPrice[]) => Promise<void>
  onCreateSupplier: (input: Omit<Supplier, "id">) => Promise<void>
}) {
  const [tab, setTab] = useState<Tab>("current")
  const [date, setDate] = useState(initialDate || todayIso())
  const [busy, setBusy] = useState(false)
  const [startError, setStartError] = useState("")

  // Follow the trading date forward when Day End moves it — but only if the
  // admin hasn't manually browsed to a different date already.
  const prevInitialDate = useRef(initialDate)
  useEffect(() => {
    if (initialDate && initialDate !== prevInitialDate.current) {
      setDate(current => current === prevInitialDate.current ? initialDate : current)
      prevInitialDate.current = initialDate
    }
  }, [initialDate])

  const session = sessions.find(s => s.date === date) ?? null
  const sessionPrices = useMemo(() => prices.filter(p => p.date === date), [prices, date])
  const unconfirmed = useMemo(() => [...sessionPrices.filter(p => !p.confirmed)].sort((a, b) => a.product.localeCompare(b.product)), [sessionPrices])
  const unconfirmedByProduct = useMemo(() => {
    const map = new Map<string, typeof unconfirmed>()
    for (const p of unconfirmed) { if (!map.has(p.product)) map.set(p.product, []); map.get(p.product)!.push(p) }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [unconfirmed])
  const confirmed = sessionPrices.filter(p => p.confirmed)

  // ── Add Prices — browse & select products already created in the Products
  // section, then set supplier & price for each (Buying Desk records price
  // quotations only — quantity & selling price are set later in Stock).
  type DraftItem = CatalogItem & { supplier: string; brand: string; price: string; notes: string }
  const productCatalog: CatalogItem[] = useMemo(() => products.map(p => ({
    name: p.productName, group: p.variety || p.category || "Other", category: p.category || "Other", size: p.size,
  })), [products])
  const productCategories = useMemo(() => [...new Set(productCatalog.map(c => c.category))].sort(), [productCatalog])

  const [showAdd, setShowAdd] = useState(false)
  const [addStep, setAddStep] = useState<"select" | "details">("select")
  const [addSearch, setAddSearch] = useState("")
  const [addCat, setAddCat] = useState<string>("")
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [addError, setAddError] = useState("")

  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [supplierForm, setSupplierForm] = useState({ name: "", contact: "", country: "" })
  const [supplierError, setSupplierError] = useState("")
  const [supplierBusy, setSupplierBusy] = useState(false)

  const openAdd = () => {
    setDraftItems([]); setAddSearch(""); setAddCat(productCategories[0] ?? ""); setAddStep("select"); setAddError(""); setShowAdd(true)
  }

  const q = addSearch.trim().toLowerCase()
  const visibleCatalog = useMemo(() => {
    if (q) return productCatalog.filter(c => `${c.name} ${c.group} ${c.category}`.toLowerCase().includes(q))
    return productCatalog.filter(c => c.category === addCat)
  }, [q, addCat, productCatalog])
  const visibleGroups = useMemo(() => {
    const map = new Map<string, CatalogItem[]>()
    for (const c of visibleCatalog) { if (!map.has(c.group)) map.set(c.group, []); map.get(c.group)!.push(c) }
    return [...map.entries()]
  }, [visibleCatalog])

  const isSelected = (name: string, group: string) => draftItems.some(i => i.name === name && i.group === group)
  const toggleItem = (c: CatalogItem) => {
    setDraftItems(prev => isSelected(c.name, c.group)
      ? prev.filter(i => !(i.name === c.name && i.group === c.group))
      : [...prev, { ...c, supplier: suppliers[0]?.name ?? "", brand: "", price: "", notes: "" }])
  }
  const countInCat = (cat: string) => draftItems.filter(i => i.category === cat).length
  const setDraft = (name: string, group: string, patch: Partial<DraftItem>) =>
    setDraftItems(prev => prev.map(i => i.name === name && i.group === group ? { ...i, ...patch } : i))

  const startSession = async () => {
    setBusy(true); setStartError("")
    try { await onStartSession(date) }
    catch { setStartError("Couldn't start the buying session — please try again.") }
    setBusy(false)
  }

  const submitAdd = async () => {
    setAddError("")
    if (draftItems.length === 0) { setAddError("Select at least one product."); return }
    for (const item of draftItems) {
      if (!item.supplier.trim()) { setAddError(`Choose a supplier for ${item.name}.`); return }
      if (!(Number(item.price) > 0)) { setAddError(`Enter a valid price for ${item.name}.`); return }
    }
    setBusy(true)
    try {
      for (const item of draftItems) {
        await onAddPrice({
          sessionId: session?.id ?? "", date, supplier: item.supplier.trim(), product: item.name,
          brand: item.brand.trim(), size: item.size, price: Number(item.price), notes: item.notes.trim() || undefined,
        })
      }
      setShowAdd(false)
    } catch { setAddError("Couldn't save these prices — please try again.") }
    setBusy(false)
  }

  const submitAddSupplier = async () => {
    setSupplierError("")
    if (!supplierForm.name.trim()) { setSupplierError("Enter a supplier name."); return }
    setSupplierBusy(true)
    try {
      await onCreateSupplier({ name: supplierForm.name.trim(), contact: supplierForm.contact.trim(), country: supplierForm.country.trim() })
      setSupplierForm({ name: "", contact: "", country: "" })
      setShowAddSupplier(false)
    } catch { setSupplierError("Couldn't add this supplier — please try again.") }
    setSupplierBusy(false)
  }

  // ── Best Prices ──
  const bestByProduct = useMemo(() => {
    const map = new Map<string, BuyingPrice[]>()
    for (const p of sessionPrices) {
      const key = p.product.toLowerCase()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return [...map.entries()].map(([, rows]) => {
      const sorted = [...rows].sort((a, b) => a.price - b.price)
      const best = sorted[0]
      const nextBest = sorted[1]
      return { product: best.product, best, nextBest, count: rows.length }
    }).sort((a, b) => a.product.localeCompare(b.product))
  }, [sessionPrices])

  // ── Confirmed Orders ──
  const [confirmedQuery, setConfirmedQuery] = useState("")
  const filteredConfirmed = useMemo(() => {
    const cq = confirmedQuery.trim().toLowerCase()
    return confirmed.filter(p => !cq || `${p.supplier} ${p.product}`.toLowerCase().includes(cq))
      .sort((a, b) => a.product.localeCompare(b.product))
  }, [confirmed, confirmedQuery])
  const bySupplier = useMemo(() => {
    const map = new Map<string, BuyingPrice[]>()
    for (const p of filteredConfirmed) {
      if (!map.has(p.supplier)) map.set(p.supplier, [])
      map.get(p.supplier)!.push(p)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredConfirmed])

  const endDailyBuying = async () => {
    if (!session) return
    if (!window.confirm(`End daily buying for ${date}? This moves ${confirmed.length} confirmed item${confirmed.length !== 1 ? "s" : ""} into Stock — you'll set quantity and selling price there before it goes live.`)) return
    setBusy(true)
    try { await onEndDailyBuying(session, confirmed) } finally { setBusy(false) }
  }

  // ── Buying History — one row per date with a running total, drill down to
  // see every item bought that day. ──
  const [historyQuery, setHistoryQuery] = useState("")
  const [historyDetailDate, setHistoryDetailDate] = useState<string | null>(null)
  const historyByDate = useMemo(() => {
    const map = new Map<string, BuyingPrice[]>()
    for (const p of prices) { if (!map.has(p.date)) map.set(p.date, []); map.get(p.date)!.push(p) }
    const hq = historyQuery.trim().toLowerCase()
    return [...map.entries()]
      .map(([d, rows]) => ({
        date: d, rows,
        total: rows.reduce((s, r) => s + r.price, 0),
        confirmedTotal: rows.filter(r => r.confirmed).reduce((s, r) => s + r.price, 0),
        suppliers: new Set(rows.map(r => r.supplier)).size,
      }))
      .filter(g => !hq || g.rows.some(r => `${r.supplier} ${r.product}`.toLowerCase().includes(hq)))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [prices, historyQuery])
  const historyDetail = historyByDate.find(g => g.date === historyDetailDate) ?? null

  // ── Buying Analytics ──
  const [rangeFrom, setRangeFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })
  const [rangeTo, setRangeTo] = useState(todayIso())
  const [analyticsSupplier, setAnalyticsSupplier] = useState("")
  const [analyticsProduct, setAnalyticsProduct] = useState("")

  const analyticsRows = useMemo(() => prices.filter(p =>
    p.date >= rangeFrom && p.date <= rangeTo &&
    (!analyticsSupplier || p.supplier === analyticsSupplier) &&
    (!analyticsProduct || p.product.toLowerCase() === analyticsProduct.toLowerCase())
  ), [prices, rangeFrom, rangeTo, analyticsSupplier, analyticsProduct])

  const analyticsStats = useMemo(() => {
    if (analyticsRows.length === 0) return null
    const byDate = new Map<string, number[]>()
    for (const r of analyticsRows) { if (!byDate.has(r.date)) byDate.set(r.date, []); byDate.get(r.date)!.push(r.price) }
    const dates = [...byDate.keys()].sort()
    const series = dates.map(d => byDate.get(d)!.reduce((s, v) => s + v, 0) / byDate.get(d)!.length)
    const allPrices = analyticsRows.map(r => r.price)
    const avg = allPrices.reduce((s, v) => s + v, 0) / allPrices.length
    const highest = Math.max(...allPrices)
    const lowest = Math.min(...allPrices)
    const pctChange = series.length >= 2 ? ((series[series.length - 1] - series[0]) / series[0]) * 100 : 0
    return { series, avg, highest, lowest, pctChange }
  }, [analyticsRows])

  const allSuppliers = useMemo(() => [...new Set(prices.map(p => p.supplier))].sort(), [prices])
  const allProducts = useMemo(() => [...new Set(prices.map(p => p.product))].sort(), [prices])

  // ── Supplier Analytics — spend compared across suppliers within the same
  // date range used for Buying Analytics, with a drill-down per supplier. ──
  const [supplierDetail, setSupplierDetail] = useState<string | null>(null)
  const supplierStats = useMemo(() => {
    return suppliers.map(sup => {
      const rows = prices.filter(p => p.supplier === sup.name)
      const rangeRows = rows.filter(p => p.date >= rangeFrom && p.date <= rangeTo)
      const confirmedRows = rows.filter(p => p.confirmed)
      const avg = rows.length ? rows.reduce((s, r) => s + r.price, 0) / rows.length : 0
      const bestWins = bestByProduct.filter(b => b.best.supplier === sup.name).length
      return {
        supplier: sup, quotes: rows.length, confirmed: confirmedRows.length, avgPrice: avg, bestWins,
        rangeRows, rangeSpend: rangeRows.reduce((s, r) => s + r.price, 0),
      }
    }).sort((a, b) => b.rangeSpend - a.rangeSpend)
  }, [suppliers, prices, bestByProduct, rangeFrom, rangeTo])
  const supplierDetailStats = supplierStats.find(s => s.supplier.name === supplierDetail) ?? null

  return (
    <div className="stack">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Produce Buying Desk</h2>
          <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
            Record supplier quotations each morning, confirm orders, then set quantity &amp; selling price in Stock.
          </p>
        </div>
        <label className="form-control" style={{ marginBottom: 0 }}>
          <span>Buying Date</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </label>
      </div>

      {!session ? (
        <div className="ps-table-card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ fontWeight: 700, marginBottom: 8, color: "#374151" }}>No buying session yet for {date}</p>
          <p style={{ color: "#9ca3af", fontSize: 13.5, marginBottom: 16 }}>Start one to begin recording supplier quotations for this date.</p>
          {startError && <p style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{startError}</p>}
          {canEdit && <Button onClick={startSession} disabled={busy}>{busy ? "Starting…" : "Start Buying Session"}</Button>}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {([
              ["current", "Current Buying Prices"], ["best", "Best Prices"], ["confirmed", "Confirmed Orders"],
              ["history", "Buying History"], ["analytics", "Buying Analytics"], ["suppliers", "Supplier Analytics"],
            ] as [Tab, string][]).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setTab(key)}
                style={{ padding: "8px 14px", borderRadius: 10, cursor: "pointer", border: tab === key ? "2px solid #1f7a3a" : "1.5px solid #e5e7eb", background: tab === key ? "#f0fdf4" : "#fff", fontWeight: 700, fontSize: 13, color: tab === key ? "#14532d" : "#374151" }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Current Buying Prices ── */}
          {tab === "current" && (
            <div className="ps-table-card">
              <div className="ps-toolbar">
                <div className="ps-toolbar-left">
                  <span style={{ fontSize: 13, color: "#6b7a70" }}>{unconfirmed.length} awaiting confirmation</span>
                </div>
                {canEdit && (
                  <div className="ps-toolbar-right">
                    <Button variant="secondary" className="btn-sm" onClick={() => setShowAddSupplier(true)}>+ Add Supplier</Button>
                    <Button className="btn-sm" onClick={openAdd}>+ Add Price</Button>
                  </div>
                )}
              </div>
              <div className="ps-table-wrap">
                {unconfirmedByProduct.map(([productName, rows]) => (
                  <table key={productName} className="ps-table" style={{ marginBottom: 4 }}>
                    <thead><tr><th colSpan={6} style={{ background: "#f0fdf4", color: "#14532d" }}>{productName}</th></tr></thead>
                    <tbody>
                      {rows.map(p => {
                        const isBest = bestByProduct.find(b => b.product.toLowerCase() === p.product.toLowerCase())?.best.id === p.id
                        return (
                          <tr key={p.id} className="ps-row">
                            <td>{p.supplier} {isBest && <span className="ps-badge" style={{ background: "#dcfce7", color: "#15803d", marginLeft: 6 }}>Best</span>}</td>
                            <td>{p.brand || "—"}</td>
                            <td>{p.size || "—"}</td>
                            <td>
                              {canEdit ? (
                                <input type="number" min="0.01" step="0.01" defaultValue={p.price}
                                  style={{ width: 80 }}
                                  onBlur={e => { const v = parseFloat(e.target.value); if (v > 0 && v !== p.price) onUpdatePrice(p.id, { price: v }) }} />
                              ) : `£${p.price.toFixed(2)}`}
                            </td>
                            <td style={{ color: "#6b7280" }}>{p.notes || "—"}</td>
                            <td>
                              {canEdit && (
                                <div style={{ display: "flex", gap: 6 }}>
                                  <Button className="btn-sm" onClick={() => onConfirm(p)}>Confirm Order</Button>
                                  <Button variant="danger" className="btn-sm" onClick={() => onDeletePrice(p.id)}>Remove</Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ))}
                {unconfirmed.length === 0 && (
                  <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
                    No unconfirmed quotations — add supplier prices above.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Best Prices ── */}
          {tab === "best" && (
            <div className="ps-table-card">
              <div className="ps-table-wrap">
                <table className="ps-table">
                  <thead><tr><th>Product</th><th>Best Supplier</th><th>Brand</th><th>Size</th><th>Best Price</th><th>Next Best</th><th>Difference</th><th>Quotations</th></tr></thead>
                  <tbody>
                    {bestByProduct.map(({ product, best, nextBest, count }) => (
                      <tr key={product} className="ps-row" style={{ background: "#f0fdf4" }}>
                        <td><strong>{product}</strong></td>
                        <td>{best.supplier}</td>
                        <td>{best.brand || "—"}</td>
                        <td>{best.size || "—"}</td>
                        <td><strong style={{ color: "#15803d" }}>£{best.price.toFixed(2)}</strong></td>
                        <td>{nextBest ? `£${nextBest.price.toFixed(2)} (${nextBest.supplier})` : "—"}</td>
                        <td>{nextBest ? `-£${(nextBest.price - best.price).toFixed(2)}` : "—"}</td>
                        <td>{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {bestByProduct.length === 0 && <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>No quotations yet for {date}.</div>}
              </div>
            </div>
          )}

          {/* ── Confirmed Orders ── */}
          {tab === "confirmed" && (
            <div className="stack">
              <div className="ps-stats-row">
                <div className="ps-stat"><p className="ps-stat-label">Confirmed Items</p><p className="ps-stat-value">{confirmed.length}</p></div>
                <div className="ps-stat"><p className="ps-stat-label">Suppliers</p><p className="ps-stat-value">{bySupplier.length}</p></div>
              </div>
              <div className="ps-toolbar" style={{ background: "none", border: "none", padding: 0 }}>
                <div className="ps-toolbar-right">
                  <div className="ps-search-wrap">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input className="ps-search" placeholder="Search supplier or product…" value={confirmedQuery} onChange={e => setConfirmedQuery(e.target.value)} />
                  </div>
                </div>
              </div>
              {bySupplier.map(([supplier, rows]) => (
                <div key={supplier} className="ps-table-card">
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid #eaecf0", fontWeight: 700 }}>{supplier}</div>
                  <div className="ps-table-wrap">
                    <table className="ps-table">
                      <thead><tr><th>Product</th><th>Brand</th><th>Price</th></tr></thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r.id} className="ps-row">
                            <td>{r.product}</td>
                            <td>{r.brand || "—"}</td>
                            <td><strong>£{r.price.toFixed(2)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {confirmed.length === 0 && (
                <div className="ps-table-card" style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
                  No confirmed orders yet — confirm quotations from the Current Buying Prices tab.
                </div>
              )}
              {canEdit && confirmed.length > 0 && session.status === "Open" && (
                <div className="actions-row">
                  <Button onClick={endDailyBuying} disabled={busy}>{busy ? "Ending…" : "End Daily Buying → Go to Stock"}</Button>
                </div>
              )}
              {session.status === "Closed" && (
                <div className="ps-table-card" style={{ padding: 16, textAlign: "center", color: "#15803d", fontWeight: 700 }}>
                  Moved to Stock — set quantity and selling price there before it goes live to customers.
                </div>
              )}
            </div>
          )}

          {/* ── Buying History — per date, drill down for the full breakdown ── */}
          {tab === "history" && (
            <div className="ps-table-card">
              <div className="ps-toolbar">
                <div className="ps-toolbar-right">
                  <div className="ps-search-wrap">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input className="ps-search" placeholder="Search supplier or product…" value={historyQuery} onChange={e => setHistoryQuery(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="ps-table-wrap">
                <table className="ps-table">
                  <thead><tr><th>Date</th><th>Items</th><th>Suppliers</th><th>Total Buying</th><th>Confirmed</th><th></th></tr></thead>
                  <tbody>
                    {historyByDate.slice(0, 60).map(g => (
                      <tr key={g.date} className="ps-row" style={{ cursor: "pointer" }}
                        onClick={() => setHistoryDetailDate(g.date)} onDoubleClick={() => setHistoryDetailDate(g.date)}>
                        <td><strong>{g.date}</strong></td>
                        <td>{g.rows.length}</td>
                        <td>{g.suppliers}</td>
                        <td><strong>£{g.total.toFixed(2)}</strong></td>
                        <td>£{g.confirmedTotal.toFixed(2)}</td>
                        <td><Button variant="ghost" className="btn-sm" onClick={() => setHistoryDetailDate(g.date)}>View →</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {historyByDate.length === 0 && <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>No buying history yet.</div>}
              </div>
            </div>
          )}

          {/* ── Buying Analytics ── */}
          {tab === "analytics" && (
            <div className="stack">
              <div className="ps-table-card" style={{ padding: 16 }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <label className="form-control" style={{ marginBottom: 0 }}>
                    <span>From</span>
                    <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} />
                  </label>
                  <label className="form-control" style={{ marginBottom: 0 }}>
                    <span>To</span>
                    <input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)} />
                  </label>
                  <Select label="Supplier" options={["All Suppliers", ...allSuppliers]}
                    value={analyticsSupplier || "All Suppliers"} onChange={v => setAnalyticsSupplier(v === "All Suppliers" ? "" : v)} />
                  <Select label="Product" options={["All Products", ...allProducts]}
                    value={analyticsProduct || "All Products"} onChange={v => setAnalyticsProduct(v === "All Products" ? "" : v)} />
                </div>
              </div>

              {analyticsStats ? (
                <>
                  <div className="ps-stats-row">
                    <div className="ps-stat"><p className="ps-stat-label">Average Price</p><p className="ps-stat-value">£{analyticsStats.avg.toFixed(2)}</p></div>
                    <div className="ps-stat"><p className="ps-stat-label">Highest</p><p className="ps-stat-value">£{analyticsStats.highest.toFixed(2)}</p></div>
                    <div className="ps-stat"><p className="ps-stat-label">Lowest</p><p className="ps-stat-value">£{analyticsStats.lowest.toFixed(2)}</p></div>
                  </div>
                  <div className="ps-table-card" style={{ padding: 16 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Price Trend {analyticsStats.pctChange !== 0 && (
                        <span style={{ color: analyticsStats.pctChange > 0 ? "#b91c1c" : "#15803d" }}>
                          ({analyticsStats.pctChange > 0 ? "+" : ""}{analyticsStats.pctChange.toFixed(1)}%)
                        </span>
                      )}
                    </p>
                    <PriceLine points={analyticsStats.series} empty="Not enough data points to chart a trend." />
                  </div>
                </>
              ) : (
                <div className="ps-table-card" style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
                  No buying data in this range yet — adjust the filters above.
                </div>
              )}
            </div>
          )}

          {/* ── Supplier Analytics — compare spend per supplier in the date range
              from Buying Analytics; double-click a row to see what was bought. ── */}
          {tab === "suppliers" && (
            <div className="stack">
              <div className="ps-table-card" style={{ padding: 16 }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <label className="form-control" style={{ marginBottom: 0 }}>
                    <span>From</span>
                    <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} />
                  </label>
                  <label className="form-control" style={{ marginBottom: 0 }}>
                    <span>To</span>
                    <input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)} />
                  </label>
                  <p style={{ fontSize: 12.5, color: "#6b7a70", alignSelf: "flex-end", margin: 0 }}>Double-click a supplier to see everything bought from them in this range.</p>
                </div>
              </div>
              <div className="ps-table-card">
                <div className="ps-table-wrap">
                  <table className="ps-table">
                    <thead><tr><th>Supplier</th><th>Country</th><th>Contact</th><th>Spend in Range</th><th>Items in Range</th><th>Avg Price (all time)</th><th>Best-Price Wins</th></tr></thead>
                    <tbody>
                      {supplierStats.map(s => (
                        <tr key={s.supplier.id} className="ps-row" style={{ cursor: "pointer" }}
                          onClick={() => setSupplierDetail(s.supplier.name)} onDoubleClick={() => setSupplierDetail(s.supplier.name)}>
                          <td><strong>{s.supplier.name}</strong></td>
                          <td>{s.supplier.country || "—"}</td>
                          <td>{s.supplier.contact || "—"}</td>
                          <td><strong>£{s.rangeSpend.toFixed(2)}</strong></td>
                          <td>{s.rangeRows.length}</td>
                          <td>{s.quotes ? `£${s.avgPrice.toFixed(2)}` : "—"}</td>
                          <td>{s.bestWins}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {supplierStats.length === 0 && (
                    <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
                      No suppliers yet — add one from the Current Buying Prices tab.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Prices modal — browse & select from existing Products, then set supplier & price */}
      <Modal open={showAdd} title="Add Prices" onClose={() => setShowAdd(false)} wide>
        {productCatalog.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>
            No products yet — add produce in the <strong>Products</strong> section first, then come back here to record buying prices for it.
          </div>
        ) : addStep === "select" ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Select today's produce <span style={{ color: "#6b7280", fontWeight: 500 }}>({draftItems.length} selected)</span></h3>
              <div className="ps-search-wrap" style={{ maxWidth: 260 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input className="ps-search" placeholder="Search produce…" value={addSearch} onChange={e => setAddSearch(e.target.value)} />
              </div>
            </div>
            {!q && (
              <div className="ss-cats">
                {productCategories.map(cat => (
                  <button key={cat} type="button" className={"ss-cat" + (addCat === cat ? " on" : "")} onClick={() => setAddCat(cat)}
                    style={addCat === cat ? { borderColor: CAT_COLORS[cat] ?? "#1f7a3a", color: CAT_COLORS[cat] ?? "#1f7a3a" } : undefined}>
                    <span className="ss-cat-dot" style={{ background: CAT_COLORS[cat] ?? "#22913f" }} />
                    {cat}
                    {countInCat(cat) > 0 && <span className="ss-cat-count">{countInCat(cat)}</span>}
                  </button>
                ))}
              </div>
            )}
            <div className="ss-scroll">
              {visibleGroups.map(([group, groupItems]) => (
                <div key={group}>
                  <p className="ss-group-title">{group} <span>({groupItems.length})</span></p>
                  <div className="ss-grid">
                    {groupItems.map((c, ci) => (
                      <button key={c.group + c.name} type="button" className={"ss-item" + (isSelected(c.name, c.group) ? " sel" : "")} style={{ animationDelay: `${Math.min(ci, 14) * 0.02}s` }} onClick={() => toggleItem(c)}>
                        <span className="ss-item-av" style={{ background: CAT_COLORS[c.category] ?? "#22913f" }}>{c.name.slice(0, 2).toUpperCase()}</span>
                        <span style={{ minWidth: 0 }}>
                          <span className="ss-item-name">{c.name}</span>
                          <span className="ss-item-meta">{c.group}</span>
                        </span>
                        {isSelected(c.name, c.group) && (
                          <span className="ss-item-check">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><polyline points="20 6 9 17 4 12"/></svg>
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {visibleCatalog.length === 0 && <div className="db-empty">No produce matches "{addSearch}".</div>}
            </div>
            {addError && <p style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", marginTop: 10 }}>{addError}</p>}
            <div className="ss-foot">
              <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={() => { if (draftItems.length === 0) { setAddError("Select at least one product."); return } setAddError(""); setAddStep("details") }} disabled={draftItems.length === 0}>
                Next: Supplier &amp; Price ({draftItems.length}) →
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Who's it from, and how much?</h3>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>Set the supplier, brand and price for each item.</p>
            {suppliers.length === 0 && (
              <p style={{ fontSize: 12.5, color: "#a16207", background: "#fef9c3", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
                No suppliers yet — close this and use "+ Add Supplier" first.
              </p>
            )}
            <div className="ss-rows">
              {draftItems.map(i => (
                <div key={i.group + i.name} className="ss-row">
                  <div className="ss-row-name">{i.name}<small>{i.group} · {i.category}</small></div>
                  <select value={i.supplier} title="Supplier" onChange={e => setDraft(i.name, i.group, { supplier: e.target.value })}>
                    {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                  <input placeholder="Brand" value={i.brand} title="Brand"
                    onChange={e => setDraft(i.name, i.group, { brand: e.target.value })} />
                  <input type="number" min="0.01" step="0.01" placeholder="Price £" value={i.price}
                    onChange={e => setDraft(i.name, i.group, { price: e.target.value })} />
                </div>
              ))}
            </div>
            {addError && <p style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", marginTop: 12 }}>{addError}</p>}
            <div className="ss-foot">
              <Button variant="secondary" onClick={() => setAddStep("select")}>← Back</Button>
              <Button onClick={submitAdd} disabled={busy}>{busy ? "Saving…" : `Save ${draftItems.length} Price${draftItems.length !== 1 ? "s" : ""}`}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Buying History drill-down — everything bought on one date */}
      <Modal open={Boolean(historyDetail)} title={historyDetail ? `Buying — ${historyDetail.date}` : "Buying"} onClose={() => setHistoryDetailDate(null)} wide>
        {historyDetail && (
          <div>
            <div className="ps-stats-row" style={{ marginBottom: 14 }}>
              <div className="ps-stat"><p className="ps-stat-label">Total Buying</p><p className="ps-stat-value">£{historyDetail.total.toFixed(2)}</p></div>
              <div className="ps-stat"><p className="ps-stat-label">Items</p><p className="ps-stat-value">{historyDetail.rows.length}</p></div>
              <div className="ps-stat"><p className="ps-stat-label">Suppliers</p><p className="ps-stat-value">{historyDetail.suppliers}</p></div>
            </div>
            <div className="ps-table-wrap">
              <table className="ps-table">
                <thead><tr><th>Product</th><th>Supplier</th><th>Brand</th><th>Price</th><th>Status</th></tr></thead>
                <tbody>
                  {[...historyDetail.rows].sort((a, b) => a.product.localeCompare(b.product)).map(p => (
                    <tr key={p.id} className="ps-row">
                      <td><strong>{p.product}</strong></td>
                      <td>{p.supplier}</td>
                      <td>{p.brand || "—"}</td>
                      <td>£{p.price.toFixed(2)}</td>
                      <td>
                        <span className="ps-badge" style={p.confirmed ? { background: "#dcfce7", color: "#15803d" } : { background: "#fef9c3", color: "#a16207" }}>
                          {p.confirmed ? "Confirmed" : "Quoted"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Supplier drill-down — everything bought from this supplier in the selected range */}
      <Modal open={Boolean(supplierDetailStats)} title={supplierDetailStats ? `${supplierDetailStats.supplier.name} — ${rangeFrom} to ${rangeTo}` : "Supplier"} onClose={() => setSupplierDetail(null)} wide>
        {supplierDetailStats && (
          <div>
            <div className="ps-stats-row" style={{ marginBottom: 14 }}>
              <div className="ps-stat"><p className="ps-stat-label">Spend in Range</p><p className="ps-stat-value">£{supplierDetailStats.rangeSpend.toFixed(2)}</p></div>
              <div className="ps-stat"><p className="ps-stat-label">Items</p><p className="ps-stat-value">{supplierDetailStats.rangeRows.length}</p></div>
              <div className="ps-stat"><p className="ps-stat-label">Best-Price Wins</p><p className="ps-stat-value">{supplierDetailStats.bestWins}</p></div>
            </div>
            <div className="ps-table-wrap">
              <table className="ps-table">
                <thead><tr><th>Date</th><th>Product</th><th>Brand</th><th>Price</th><th>Status</th></tr></thead>
                <tbody>
                  {[...supplierDetailStats.rangeRows].sort((a, b) => b.date.localeCompare(a.date) || a.product.localeCompare(b.product)).map(p => (
                    <tr key={p.id} className="ps-row">
                      <td style={{ color: "#6b7280" }}>{p.date}</td>
                      <td><strong>{p.product}</strong></td>
                      <td>{p.brand || "—"}</td>
                      <td>£{p.price.toFixed(2)}</td>
                      <td>
                        <span className="ps-badge" style={p.confirmed ? { background: "#dcfce7", color: "#15803d" } : { background: "#fef9c3", color: "#a16207" }}>
                          {p.confirmed ? "Confirmed" : "Quoted"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {supplierDetailStats.rangeRows.length === 0 && (
                <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>Nothing bought from this supplier in this range.</div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Add Supplier modal */}
      <Modal open={showAddSupplier} title="Add Supplier" onClose={() => setShowAddSupplier(false)}>
        <div className="form-grid">
          <div className="wide"><Input label="Supplier Name" value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} required autoFocus /></div>
          <Input label="Contact (phone or email)" value={supplierForm.contact} onChange={e => setSupplierForm({ ...supplierForm, contact: e.target.value })} />
          <Input label="Country" value={supplierForm.country} onChange={e => setSupplierForm({ ...supplierForm, country: e.target.value })} />
          {supplierError && <p className="wide" style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{supplierError}</p>}
          <div className="wide actions-row">
            <Button onClick={submitAddSupplier} disabled={supplierBusy}>{supplierBusy ? "Adding…" : "Add Supplier"}</Button>
            <Button variant="secondary" onClick={() => setShowAddSupplier(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
