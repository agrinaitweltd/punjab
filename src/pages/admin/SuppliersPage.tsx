import { useMemo, useState } from "react"
import type { BuyingPrice, Supplier } from "../../types"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { Input } from "../../components/ui/Input"
import { confirmAction } from "../../lib/appDialogs"

function todayIso() { return new Date().toISOString().slice(0, 10) }

type Tab = "directory" | "analytics"

export function SuppliersPage({
  suppliers, prices = [], onCreate, onUpdate, onDelete, canManage = true,
}: {
  suppliers: Supplier[]
  /** Buying-price history — powers the Analytics tab's spend comparison. */
  prices?: BuyingPrice[]
  onCreate: (input: Omit<Supplier, "id">) => Promise<void>
  onUpdate: (id: string, input: Partial<Supplier>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  canManage?: boolean
}) {
  const [tab, setTab] = useState<Tab>("directory")
  const [query, setQuery] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: "", contact: "", country: "" })
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)

  // ── Analytics — compare spend per supplier over a date range, with a
  // drill-down into everything bought from them. ──
  const [rangeFrom, setRangeFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })
  const [rangeTo, setRangeTo] = useState(todayIso())
  const [supplierDetail, setSupplierDetail] = useState<string | null>(null)

  const bestByProduct = useMemo(() => {
    const map = new Map<string, BuyingPrice[]>()
    for (const p of prices) {
      const key = p.product.toLowerCase()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return [...map.values()].map(rows => [...rows].sort((a, b) => a.price - b.price)[0])
  }, [prices])

  const supplierStats = useMemo(() => {
    return suppliers.map(sup => {
      const rows = prices.filter(p => p.supplier === sup.name)
      const rangeRows = rows.filter(p => p.date >= rangeFrom && p.date <= rangeTo)
      const avg = rows.length ? rows.reduce((s, r) => s + r.price, 0) / rows.length : 0
      const bestWins = bestByProduct.filter(b => b?.supplier === sup.name).length
      return {
        supplier: sup, quotes: rows.length, avgPrice: avg, bestWins,
        rangeRows, rangeSpend: rangeRows.reduce((s, r) => s + r.price, 0),
      }
    }).sort((a, b) => b.rangeSpend - a.rangeSpend)
  }, [suppliers, prices, bestByProduct, rangeFrom, rangeTo])
  const supplierDetailStats = supplierStats.find(s => s.supplier.name === supplierDetail) ?? null

  const filtered = suppliers.filter(s =>
    !query.trim() || `${s.name} ${s.contact} ${s.country}`.toLowerCase().includes(query.trim().toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name))

  const submitAdd = async () => {
    setError("")
    if (!form.name.trim()) { setError("Enter a supplier name."); return }
    setBusy(true)
    try {
      await onCreate({ name: form.name.trim(), contact: form.contact.trim(), country: form.country.trim() })
      setForm({ name: "", contact: "", country: "" })
      setShowAdd(false)
    } catch { setError("Couldn't add this supplier — please try again.") }
    setBusy(false)
  }

  const submitEdit = async () => {
    if (!editing) return
    setError("")
    if (!editing.name.trim()) { setError("Enter a supplier name."); return }
    setBusy(true)
    try {
      await onUpdate(editing.id, { name: editing.name.trim(), contact: editing.contact.trim(), country: editing.country.trim() })
      setEditing(null)
    } catch { setError("Couldn't save changes — please try again.") }
    setBusy(false)
  }

  const remove = async (supplier: Supplier) => {
    if (!await confirmAction(`Delete supplier ${supplier.name}? This cannot be undone.`)) return
    setBusy(true)
    try { await onDelete(supplier.id) } finally { setBusy(false) }
  }

  return (
    <div className="stack">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Suppliers</h2>
          <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
            Manage the suppliers used throughout the Produce Buying Desk.
          </p>
        </div>
        {canManage && tab === "directory" && <Button onClick={() => { setForm({ name: "", contact: "", country: "" }); setError(""); setShowAdd(true) }}>+ Add Supplier</Button>}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {([["directory", "Directory"], ["analytics", "Supplier Analytics"]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            style={{ padding: "8px 14px", borderRadius: 10, cursor: "pointer", border: tab === key ? "2px solid #1f7a3a" : "1.5px solid #e5e7eb", background: tab === key ? "#f0fdf4" : "#fff", fontWeight: 700, fontSize: 13, color: tab === key ? "#14532d" : "#374151" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "directory" ? (
        <div className="ps-table-card">
          <div className="ps-toolbar">
            <div className="ps-toolbar-right">
              <div className="ps-search-wrap">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input className="ps-search" placeholder="Search supplier, contact, country…" value={query} onChange={e => setQuery(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="ps-table-wrap">
            <table className="ps-table">
              <thead><tr><th>Supplier</th><th>Contact</th><th>Country</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="ps-row">
                    <td><strong>{s.name}</strong></td>
                    <td>{s.contact || "—"}</td>
                    <td>{s.country || "—"}</td>
                    <td>
                      {canManage && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <Button variant="secondary" className="btn-sm" onClick={() => setEditing(s)}>Edit</Button>
                          <Button variant="danger" className="btn-sm" onClick={() => remove(s)} disabled={busy}>Delete</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
                No suppliers yet — add one to start recording buying prices against them.
              </div>
            )}
          </div>
        </div>
      ) : (
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
                  No suppliers yet — add one from the Directory tab.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

      <Modal open={showAdd} title="Add Supplier" onClose={() => setShowAdd(false)}>
        <div className="form-grid">
          <div className="wide"><Input label="Supplier Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required autoFocus /></div>
          <Input label="Contact (phone or email)" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} />
          <Input label="Country" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
          {error && <p className="wide" style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{error}</p>}
          <div className="wide actions-row">
            <Button onClick={submitAdd} disabled={busy}>{busy ? "Adding…" : "Add Supplier"}</Button>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(editing)} title={editing ? `Edit ${editing.name}` : "Edit Supplier"} onClose={() => setEditing(null)}>
        {editing && (
          <div className="form-grid">
            <div className="wide"><Input label="Supplier Name" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} required /></div>
            <Input label="Contact (phone or email)" value={editing.contact} onChange={e => setEditing({ ...editing, contact: e.target.value })} />
            <Input label="Country" value={editing.country} onChange={e => setEditing({ ...editing, country: e.target.value })} />
            {error && <p className="wide" style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{error}</p>}
            <div className="wide actions-row">
              <Button onClick={submitEdit} disabled={busy}>{busy ? "Saving…" : "Save Changes"}</Button>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
