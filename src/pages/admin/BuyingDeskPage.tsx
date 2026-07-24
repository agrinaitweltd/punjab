import { useMemo, useState } from "react"
import type { BuyingPrice, BuyingSession } from "../../types"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { Input, Select, TextArea } from "../../components/ui/Input"
import { PRODUCE_CATALOG_NAMES } from "./SessionPage"

type Tab = "current" | "best" | "confirmed" | "history" | "analytics"

const DEFAULT_SUPPLIERS = ["Birmingham Wholesale Market", "New Spitalfields Market", "Western International Market"]

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
  sessions, prices, suppliers = DEFAULT_SUPPLIERS, canEdit = true,
  onStartSession, onAddPrice, onUpdatePrice, onDeletePrice, onConfirm, onEndDailyBuying, onPublish,
}: {
  sessions: BuyingSession[]
  prices: BuyingPrice[]
  suppliers?: string[]
  /** Gates Add/Edit/Delete/Confirm/Publish — history & analytics stay viewable to everyone. */
  canEdit?: boolean
  onStartSession: (date: string) => Promise<void>
  onAddPrice: (input: Omit<BuyingPrice, "id" | "confirmed">) => Promise<void>
  onUpdatePrice: (id: string, input: Partial<BuyingPrice>) => Promise<void>
  onDeletePrice: (id: string) => Promise<void>
  onConfirm: (price: BuyingPrice) => Promise<void>
  onEndDailyBuying: (session: BuyingSession, confirmedPrices: BuyingPrice[]) => Promise<void>
  onPublish: (session: BuyingSession, sellingPrices: Record<string, number>) => Promise<void>
}) {
  const [tab, setTab] = useState<Tab>("current")
  const [date, setDate] = useState(todayIso())
  const [busy, setBusy] = useState(false)
  const [startError, setStartError] = useState("")

  const session = sessions.find(s => s.date === date) ?? null
  const sessionPrices = useMemo(() => prices.filter(p => p.date === date), [prices, date])
  const unconfirmed = sessionPrices.filter(p => !p.confirmed)
  const confirmed = sessionPrices.filter(p => p.confirmed)

  // ── Add Price modal ──
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ supplier: suppliers[0] ?? "", product: "", variety: "", brand: "", size: "", unit: "box", price: "", quantity: "", notes: "" })
  const [addError, setAddError] = useState("")

  const startSession = async () => {
    setBusy(true); setStartError("")
    try { await onStartSession(date) }
    catch { setStartError("Couldn't start the buying session — please try again.") }
    setBusy(false)
  }

  const submitAdd = async () => {
    setAddError("")
    if (!form.supplier.trim()) { setAddError("Enter a supplier."); return }
    if (!form.product.trim()) { setAddError("Enter a product."); return }
    const price = parseFloat(form.price)
    const quantity = parseFloat(form.quantity)
    if (!price || price <= 0) { setAddError("Enter a valid price."); return }
    if (!quantity || quantity <= 0) { setAddError("Enter a valid quantity."); return }
    setBusy(true)
    try {
      await onAddPrice({
        sessionId: session?.id ?? "", date, supplier: form.supplier.trim(), product: form.product.trim(),
        variety: form.variety.trim(), brand: form.brand.trim(), size: form.size.trim(), unit: form.unit.trim(),
        price, quantity, notes: form.notes.trim() || undefined,
      })
      setForm({ supplier: suppliers[0] ?? "", product: "", variety: "", brand: "", size: "", unit: "box", price: "", quantity: "", notes: "" })
      setShowAdd(false)
    } catch { setAddError("Couldn't save this price — please try again.") }
    setBusy(false)
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
  const bySupplier = useMemo(() => {
    const map = new Map<string, BuyingPrice[]>()
    for (const p of confirmed) {
      if (!map.has(p.supplier)) map.set(p.supplier, [])
      map.get(p.supplier)!.push(p)
    }
    return [...map.entries()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed])
  const grandTotal = confirmed.reduce((s, p) => s + p.price * p.quantity, 0)

  const [publishing, setPublishing] = useState(false)
  const [sellingPrices, setSellingPrices] = useState<Record<string, string>>({})

  const beginPublishing = () => {
    const next: Record<string, string> = {}
    for (const p of confirmed) next[p.id] = (p.price * 1.3).toFixed(2)
    setSellingPrices(next)
    setPublishing(true)
  }

  const endDailyBuying = async () => {
    if (!session) return
    if (!window.confirm(`End daily buying for ${date}? This moves ${confirmed.length} confirmed item${confirmed.length !== 1 ? "s" : ""} into Stock (not yet visible to customers).`)) return
    setBusy(true)
    try { await onEndDailyBuying(session, confirmed); beginPublishing() } finally { setBusy(false) }
  }

  const submitPublish = async () => {
    if (!session) return
    setBusy(true)
    try {
      const map: Record<string, number> = {}
      for (const p of confirmed) map[p.id] = parseFloat(sellingPrices[p.id]) || 0
      await onPublish(session, map)
      setPublishing(false)
    } finally { setBusy(false) }
  }

  // ── Buying History ──
  const [historyQuery, setHistoryQuery] = useState("")
  const filteredHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase()
    return prices.filter(p => !q || `${p.date} ${p.supplier} ${p.product}`.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [prices, historyQuery])

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
    const totalSpend = analyticsRows.filter(r => r.confirmed).reduce((s, r) => s + r.price * r.quantity, 0)
    const pctChange = series.length >= 2 ? ((series[series.length - 1] - series[0]) / series[0]) * 100 : 0
    return { series, avg, highest, lowest, totalSpend, pctChange }
  }, [analyticsRows])

  const allSuppliers = useMemo(() => [...new Set(prices.map(p => p.supplier))].sort(), [prices])
  const allProducts = useMemo(() => [...new Set(prices.map(p => p.product))].sort(), [prices])

  return (
    <div className="stack">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Produce Buying Desk</h2>
          <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
            Record supplier quotations each morning, confirm orders, then publish today's prices to customers.
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
              ["history", "Buying History"], ["analytics", "Buying Analytics"],
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
                    <Button className="btn-sm" onClick={() => setShowAdd(true)}>+ Add Price</Button>
                  </div>
                )}
              </div>
              <div className="ps-table-wrap">
                <table className="ps-table">
                  <thead><tr>
                    <th>Supplier</th><th>Product</th><th>Variety</th><th>Brand</th><th>Size</th><th>Unit</th>
                    <th>Price</th><th>Qty</th><th>Notes</th><th>Actions</th>
                  </tr></thead>
                  <tbody>
                    {[...unconfirmed].sort((a, b) => a.product.localeCompare(b.product)).map(p => (
                      <tr key={p.id} className="ps-row">
                        <td>{p.supplier}</td>
                        <td><strong>{p.product}</strong></td>
                        <td>{p.variety || "—"}</td>
                        <td>{p.brand || "—"}</td>
                        <td>{p.size || "—"}</td>
                        <td>{p.unit || "—"}</td>
                        <td>
                          {canEdit ? (
                            <input type="number" min="0.01" step="0.01" defaultValue={p.price}
                              style={{ width: 80 }}
                              onBlur={e => { const v = parseFloat(e.target.value); if (v > 0 && v !== p.price) onUpdatePrice(p.id, { price: v }) }} />
                          ) : `£${p.price.toFixed(2)}`}
                        </td>
                        <td>
                          {canEdit ? (
                            <input type="number" min="1" defaultValue={p.quantity}
                              style={{ width: 70 }}
                              onBlur={e => { const v = parseFloat(e.target.value); if (v > 0 && v !== p.quantity) onUpdatePrice(p.id, { quantity: v }) }} />
                          ) : p.quantity}
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
                    ))}
                  </tbody>
                </table>
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
                <div className="ps-stat"><p className="ps-stat-label">Total Spend</p><p className="ps-stat-value">£{grandTotal.toFixed(2)}</p></div>
              </div>
              {bySupplier.map(([supplier, rows]) => (
                <div key={supplier} className="ps-table-card">
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid #eaecf0", fontWeight: 700 }}>{supplier}</div>
                  <div className="ps-table-wrap">
                    <table className="ps-table">
                      <thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Total</th></tr></thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r.id} className="ps-row">
                            <td>{r.product}{r.variety ? ` — ${r.variety}` : ""}</td>
                            <td>£{r.price.toFixed(2)}</td>
                            <td>{r.quantity}</td>
                            <td><strong>£{(r.price * r.quantity).toFixed(2)}</strong></td>
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
                  <Button onClick={endDailyBuying} disabled={busy}>{busy ? "Ending…" : "End Daily Buying"}</Button>
                </div>
              )}
              {canEdit && session.status === "Closed" && !session.publishedAt && (
                <div className="ps-table-card" style={{ padding: 16 }}>
                  <p style={{ fontWeight: 700, marginBottom: 10 }}>Set today's selling prices before publishing</p>
                  {!publishing ? (
                    <Button onClick={beginPublishing}>Review &amp; Publish Prices</Button>
                  ) : (
                    <>
                      <div className="ss-rows">
                        {confirmed.map(p => (
                          <div key={p.id} className="ss-row" style={{ gridTemplateColumns: "1fr 120px" }}>
                            <div className="ss-row-name">{p.product}<small>buy £{p.price.toFixed(2)} · {p.supplier}</small></div>
                            <input type="number" min="0.01" step="0.01" value={sellingPrices[p.id] ?? ""} onChange={e => setSellingPrices(prev => ({ ...prev, [p.id]: e.target.value }))} />
                          </div>
                        ))}
                      </div>
                      <div className="actions-row" style={{ marginTop: 14 }}>
                        <Button onClick={submitPublish} disabled={busy}>{busy ? "Publishing…" : "Publish Today's Prices"}</Button>
                        <Button variant="secondary" onClick={() => setPublishing(false)}>Cancel</Button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {session.publishedAt && (
                <div className="ps-table-card" style={{ padding: 16, textAlign: "center", color: "#15803d", fontWeight: 700 }}>
                  Published — live on the Stock page for customers.
                </div>
              )}
            </div>
          )}

          {/* ── Buying History ── */}
          {tab === "history" && (
            <div className="ps-table-card">
              <div className="ps-toolbar">
                <div className="ps-toolbar-right">
                  <div className="ps-search-wrap">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input className="ps-search" placeholder="Search date, supplier, product…" value={historyQuery} onChange={e => setHistoryQuery(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="ps-table-wrap">
                <table className="ps-table">
                  <thead><tr><th>Date</th><th>Supplier</th><th>Product</th><th>Price</th><th>Qty</th><th>Status</th></tr></thead>
                  <tbody>
                    {filteredHistory.slice(0, 200).map(p => (
                      <tr key={p.id} className="ps-row">
                        <td style={{ color: "#6b7280" }}>{p.date}</td>
                        <td>{p.supplier}</td>
                        <td>{p.product}</td>
                        <td>£{p.price.toFixed(2)}</td>
                        <td>{p.quantity}</td>
                        <td>
                          <span className="ps-badge" style={p.confirmed ? { background: "#dcfce7", color: "#15803d" } : { background: "#fef9c3", color: "#a16207" }}>
                            {p.confirmed ? "Confirmed" : "Quoted"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredHistory.length === 0 && <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>No buying history yet.</div>}
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
                    <div className="ps-stat"><p className="ps-stat-label">Total Spend (confirmed)</p><p className="ps-stat-value">£{analyticsStats.totalSpend.toFixed(2)}</p></div>
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
        </>
      )}

      {/* Add Price modal */}
      <Modal open={showAdd} title="Add Price" onClose={() => setShowAdd(false)}>
        <div className="form-grid">
          <label className="form-control">
            <span>Supplier</span>
            <input list="bd-suppliers" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
            <datalist id="bd-suppliers">{suppliers.map(s => <option key={s} value={s} />)}</datalist>
          </label>
          <label className="form-control">
            <span>Product</span>
            <input list="bd-products" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} />
            <datalist id="bd-products">{PRODUCE_CATALOG_NAMES.map(n => <option key={n} value={n} />)}</datalist>
          </label>
          <Input label="Variety" value={form.variety} onChange={e => setForm({ ...form, variety: e.target.value })} />
          <Input label="Brand" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
          <Input label="Size" value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} placeholder="e.g. 5kg" />
          <Input label="Unit" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="e.g. box" />
          <Input label="Price (£)" type="number" min="0.01" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
          <Input label="Quantity" type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
          <div className="wide"><TextArea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          {addError && <p className="wide" style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{addError}</p>}
          <div className="wide actions-row">
            <Button onClick={submitAdd} disabled={busy}>{busy ? "Saving…" : "Save Price"}</Button>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
